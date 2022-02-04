import { Controller, KuzzleRequest } from "kuzzle";
import Kepler from "../Kepler";

export default class AnalyticsController extends Controller {
  public app: Kepler;
  constructor(app: Kepler) {
    super(app);

    this.definition = {
      actions: {
        track: {
          handler: (request: KuzzleRequest) => this.track(request),
          http: [{ verb: "post", path: "analytics/track" }]
        }
      }
    }
  }

  async track(request: KuzzleRequest) {
    const product = request.getString('product');

    try {
      this.app.mutex.lock();
      if (! await this.app.sdk.collection.exists('analytics', product)) {
        this.app.log.debug(`Provisionning analytics index for product ${product}`);
        await this.app.sdk.collection.create('analytics', product, {});
        this.app.log.info(`Analytics index for product ${product} provisionned`);
      }
    } finally {
      this.app.mutex.unlock();
    }

    await this.app.sdk.document.create('analytics', product, request.getBody());
    this.app.log.debug(`Analytics document for product ${product} created`);
  }
}