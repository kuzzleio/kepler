import getMAC from 'getmac';
import { Http, Kuzzle } from 'kuzzle-sdk';
const crypto = typeof window === 'undefined' ? require('crypto') : window.crypto;

export type KeplerCompanionConfiguration = {
  host?: string;
  port?: number;
  ssl?: boolean;
  telemetryPath?: string;
  enabled?: boolean;
};

export type TelemetryOpts = {
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
  const array = new Uint32Array(8);
  crypto.getRandomValues(array);
  let str = '';
  for (let i = 0; i < array.length; i++) {
    str += (i < 2 || i > 5 ? '' : '-') + array[i].toString(16).slice(-4);
  }
  return str;
}

export default class KeplerCompanion {
  private sdk: Kuzzle;
  public config: KeplerCompanionConfiguration = {
    host: 'kepler.app.kuzzle.io',
    port: 443,
    ssl: true,
    enabled: true,
  };

  constructor(config = {}) {
    this.config = { ...this.config, ...config };
    this.sdk = new Kuzzle(
      new Http(
        this.config.host,
        { port: this.config.port, ssl: this.config.ssl }
      )
    );
  }

  get mode(): 'node' | 'browser' {
    return typeof window !== 'undefined' ? 'browser' : 'node';
  }

  private getUserId(product?: string): string {
    let id: any;
    switch (this.mode) {
      case 'node':
        id = crypto.createHash('sha256').update(getMAC()).digest('hex');
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

  public turnOff(): void {
    this.config.enabled = false;
  }

  public add(opts: TelemetryOpts): Promise<unknown> | void {
    if (!this.config.enabled) {
      return;
    }

    if (process.env.CI) {
      opts.tags = opts.tags || {};
      opts.tags.ci = true;
    }

    this._add(opts).catch(() => { /* Analytics should not interfer with user process */ });
  }

  private async _add(opts: TelemetryOpts): Promise<void> {
    const user = this.getUserId(opts.product);
    try {
      await this.sdk.connect();
      await this.sdk.query({
        controller: 'telemetry',
        action: 'register',
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
