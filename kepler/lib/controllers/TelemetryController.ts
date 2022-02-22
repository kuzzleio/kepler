import { Controller, ExternalServiceError, KuzzleRequest } from "kuzzle";
import Kepler from "../Kepler";
import * as crypto from 'crypto';
import geoip from 'geoip-lite';

const IPV4_REGEX = /^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)){3}$/gm;

export default class TelemetryController extends Controller {
  public app: Kepler;
  constructor(app: Kepler) {
    super(app);

    this.definition = {
      actions: {
        register: {
          handler: async (request: KuzzleRequest) => await this.track(request),
          http: [{ verb: 'post', path: 'telemetry/register' }]
        }
      }
    }
  }

  /**
   * Instantly returns to the client to avoid delay in the response
   */
  async track (request: KuzzleRequest) {
    // never return a rejected promise
    this.saveTelemetry(request);
  }

  async saveTelemetry (request: KuzzleRequest) {
    try {
      const product = request.getString('p');
      const user = request.getString('u');
      const action = request.getString('a');
      const version = request.getString('v');
      const tags = request.getBodyObject('t', {});

      const trackingPayload = {
        action,
        product,
        tags,
        // To uniformize the tracking data, we hash the user id here
        user: crypto.createHash('sha256').update(user).digest('hex'),
        version
      };

      const ip = this.getIp(request);
      const result = geoip.lookup(ip);

      if (result) {
        trackingPayload.tags.country = result.country;
        trackingPayload.tags.city = result.city;
      }

      this.app.log.debug(`Analytics data reveived: ${JSON.stringify(trackingPayload)}`);

      const doc = await this.app.sdk.document.create(
        this.app.applicationConfig.analytics.index,
        this.app.applicationConfig.analytics.collection,
        trackingPayload);

      this.app.log.debug(`Analytics document created: ${JSON.stringify(doc)}`);
    }
    catch (error) {
      this.app.log.error(`Failed to save telemetry data: ${error}`);
    }
  }

  private getIp (request: KuzzleRequest) {
    if (request.context.connection.misc.headers['x-real-ip']) {
      return request.context.connection.misc.headers['x-real-ip'];
    }

    const ipv4 = request.context.connection.ips.find(ip => IPV4_REGEX.test(ip));

    if (ipv4) {
      return ipv4;
    }

    return request.context.connection.ips[0];
  }
}