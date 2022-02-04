import { Backend, Mutex } from "kuzzle";
import AnalyticsController from "./controllers/AnalyticsController";

export default class Kepler extends Backend {
  public mutex: Mutex;
  
  constructor(name = 'kepler') {
    super(name);
    this.controller.use(new AnalyticsController(this));
  }

  public async start() {
    await super.start();
    this.mutex = new Mutex('concurrentAutoprovisioning');

    try {
      await this.mutex.lock();
      if (! await this.sdk.index.exists('analytics')) {
        await this.sdk.index.create('analytics');
      }
    } finally {
      await this.mutex.unlock();
    }
  }
}