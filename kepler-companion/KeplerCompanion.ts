import getMAC from 'getmac';
import * as crypto from 'crypto';
import { Http, Kuzzle } from 'kuzzle-sdk';

export type KeplerCompanionConfiguration = {
  host?: string;
  port?: number;
  ssl?: boolean;
  trackingPath?: string;
  enabled?: boolean;
};

export type TrackingOpts = {
  action: string;
  product: string;
  version: string;
  tags?: { [key: string]: any };
}

/**
 * This is a function gave by Mozilla MDN to generate 
 * an UUID compatible with all browsers (HTTPS AND HTTP) and using vanilla JS
 */
function generateUniqueIdForBrowser(): string {
  const array = new Uint32Array(8)
  window.crypto.getRandomValues(array)
  let str = ''
  for (let i = 0; i < array.length; i++) {
    str += (i < 2 || i > 5 ? '' : '-') + array[i].toString(16).slice(-4)
  }
  return str
}

export default class KeplerCompanion {
  private sdk: Kuzzle;
  public config: KeplerCompanionConfiguration = {
    host: 'analytics.app.kuzzle.io',
    port: 443,
    ssl: true,
    trackingPath: '/_/analytics/track',
    enabled: true,
  };

  constructor(config = {}) {
    this.config = { ...this.config, ...config };
    this.sdk = new Kuzzle(
      new Http(
        this.config.host as string, 
        { port: this.config.port, ssl: this.config.ssl }
      )
    );
  }

  private getUserId(mode: 'node' | 'browser', product: string): string {
    let id: any;
    switch (mode) {
      case 'node':
        id = getMAC();
      break;
      case 'browser':
        id = window.localStorage.getItem(`${product}-kepler-id`);
        if (! id) {
          id = generateUniqueIdForBrowser();
          window.localStorage.setItem(`${product}-kepler-id`, id);
        }
      break;
    }

    return id;
  }

  public turnOff() {
    this.config.enabled = false;
  }

  public track(opts: TrackingOpts, timeout = 1000) {
    if (!this.config.enabled) {
      return;
    }

    if (process.env.CI) {
      opts.tags = opts.tags || {};
      opts.tags.ci = true;
    }

    const innerTrack = this._track.bind(this);
    return Promise.race([
      new Promise(() => {
        return innerTrack(opts).catch(() => { /* Analytics should not interfer with user process */ });
      }),
      new Promise((resolve) => setTimeout(resolve, timeout))
    ]);
  }

  private async _track(opts: TrackingOpts) {
    const user = this.getUserId(typeof window !== 'undefined' ? 'browser' : 'node', opts.product);
    try {
      await this.sdk.connect();
      await this.sdk.query({
        controller: 'analytics',
        action: 'track',
        a: opts.action,
        p: opts.product,
        v: opts.version,
        u: user,
        body: opts.tags || {},
      });
    } finally {
      this.sdk.disconnect();
    }
  }
}
