import { Controller, ExternalServiceError, KuzzleRequest } from "kuzzle";
import Kepler from "../Kepler";
import * as crypto from 'crypto';
import fetch from 'node-fetch';

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

  private async getCountryFromIP(ip: string) {
    try {
      const response = await fetch(`https://api.iplocation.net?ip=${ip}`);
      if (! response.ok) {
        throw new ExternalServiceError(response.statusText);
      }

      const { country_name } = await response.json();
      return country_name === '' ? undefined : country_name;
    } catch (error) {
      this.app.log.error(`Failed to get country from IP: ${error}`);
    }
  }

  async track(request: KuzzleRequest) {
    const product = request.getString('p');
    const user = request.getString('u');
    const action = request.getString('a');
    const version = request.getString('v');
    const tags = request.getBody();

    const trackingPayload = { 
      action,
      product,
      tags,
      // To uniformize the tracking data, we hash the user id here
      user: crypto.createHash('sha256').update(user).digest('hex'), 
      version
    };

    if (request.context.connection.misc.headers['x-real-ip'] !== undefined) {
      const country = await this.getCountryFromIP(request.context.connection.misc.headers['x-real-ip']);

      if (country !== undefined) { 
        trackingPayload.tags = { ...trackingPayload.tags, country }
      }
    }

    this.app.log.debug(`Analytics data reveived: ${JSON.stringify(trackingPayload)}`);
    const doc = await this.app.sdk.document.create(
      this.app.applicationConfig.analytics.index,
      this.app.applicationConfig.analytics.collection,
      trackingPayload);
    this.app.log.debug(`Analytics document created: ${JSON.stringify(doc)}`);
  }
}