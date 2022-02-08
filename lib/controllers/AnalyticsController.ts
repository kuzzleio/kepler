import { Controller, KuzzleRequest } from "kuzzle";
import Kepler from "../Kepler";

export default class AnalyticsController extends Controller {
  public app: Kepler;
  constructor(app: Kepler) {
    super(app);

    this.definition = {
      actions: {
        track: {
          handler: async (request: KuzzleRequest) => await this.track(request),
          http: [{ verb: 'post', path: 'analytics/track' }]
        }
      }
    }
  }

  async track(request: KuzzleRequest) {
    const product = request.getString('p');
    const user = request.getString('u');
    const action = request.getString('a');
    const version = request.getString('v');
    const tags = request.getBody();

    const trackingPayload = { action, product, tags, user, version };

    this.app.log.debug(`Analytics data reveived: ${JSON.stringify(trackingPayload)}`);
    const doc = await this.app.sdk.document.create(
      this.app.applicationConfig.analytics.index,
      this.app.applicationConfig.analytics.collection,
      trackingPayload);
    this.app.log.debug(`Analytics document created: ${JSON.stringify(doc)}`);
  }
}