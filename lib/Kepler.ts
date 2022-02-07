import { Backend, CollectionMappings, JSONObject, MappingsProperties, Mutex } from 'kuzzle';
import { merge } from 'lodash';
import AnalyticsController from './controllers/AnalyticsController';

/**
 * Kepler Configuration format
 * @typedef {Object} KeplerConfig
 * @property {string} analytics.index                          - The name of the index where the analytics data will be stored
 * @property {string} analytics.collection                     - The name of the collection where the analytics data will be stored
 * @property {CollectionMappings} analytics.collectionMappping - The mappings of the analytics collection
 * @property {boolean} autoprovision                           - Enable or disable the automatic provisioning of the analytics index
 */
export type KeplerConfiguration = {
  analytics: {
    index: string;
    collection: string;
    collectionMapping: CollectionMappings;
  },
  autoprovision: boolean;
}

/**
 * Kepler Kuzzle Application
 * @class
 * @extends Backend
 * @property {KeplerConfiguration} applicationConfig - The application configuration
 * @property {AnalyticsController} analyticsController - The Analytics Controller
 * @property {Mutex} mutex - The mutex used to synchronize the application
 */
export default class Kepler extends Backend {
  private mutex: Mutex;
  public applicationConfig: KeplerConfiguration = {
    analytics: {
      index: 'analytics',
      collection: 'products',
      collectionMapping: {
        dynamic: 'strict',
        properties: {
          action: { type: 'keyword' },
          product: { type: 'keyword' },
          version: { type: 'keyword' },
          tags: { 
            dynamic: 'false',
            properties: {}
          } as MappingsProperties,
          userHash: { type: 'keyword' },
        } as JSONObject,
      },
    },
    autoprovision: true,
  }
  
  constructor(name = 'kepler') {
    super(name);
    this.applicationConfig = merge(this.applicationConfig, this.config.content.application);
    this.controller.use(new AnalyticsController(this));
  }

  public async start() {
    await super.start();

    if (this.applicationConfig.autoprovision) {
      this.mutex = new Mutex('concurrentAutoProvisioning');
      await this._provisionDataModel(
        this.applicationConfig.analytics.index,
        this.applicationConfig.analytics.collection,
        this.applicationConfig.analytics.collectionMapping);
    }

    this.log.info('Application started')
  }

  private async _provisionDataModel(index, collection, collectionMapping) {
    try {
      await this.mutex.lock();
      if (! await this.sdk.index.exists(index)) {
        await this.sdk.index.create(index);
        this.log.info(`Analytics index ${index} provisionned`);
      }

      if (! await this.sdk.collection.exists(index, collection)) {
        await this.sdk.collection.create(
          index,
          collection,
          collectionMapping
        );
        this.log.info(`Analytics collection ${collection} provisionned`);
      }
    } finally {
      await this.mutex.unlock();
    }
  }

}