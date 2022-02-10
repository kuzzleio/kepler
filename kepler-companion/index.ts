import getMAC from 'getmac';
import * as crypto from 'crypto';
import axios from 'axios';

export type KeplerCompanionConfiguration = {
  host?: string,
  port?: number,
  ssl?: boolean,
  trackingPath?: string,
  enabled?: boolean,
  mode?: KeplerCompanionMode,
};

export type KeplerCompanionMode = 'browser' | 'node';

export type TrackingOpts = {
  action: string,
  product: string,
  version: string,
  tags?: { [key: string]: any },
}

export default class KeplerCompanion {
  public config: KeplerCompanionConfiguration = {
    host: 'analytics.app.kuzzle.io',
    port: 443,
    ssl: true,
    trackingPath: '/_/analytics/track',
    enabled: true,
    mode: 'node',
  };

  constructor(config = {}) {
    this.config = { ...this.config, ...config };
  }

  public get server_url() {
    return `http${this.config.ssl ? 's' : ''}://${this.config.host}:${this.config.port}${this.config.trackingPath}`;
  }

  private forgeUserID(): string {
    let identifier: string;
    switch (this.config.mode) {
      case 'browser':
        if (typeof window === 'undefined') {
          throw Error('Kepler Companion browser mode is enabled but you are not in a browser');
        }
        identifier = window.localStorage.getItem('kepler-user-id');

        if (identifier === null) {
          identifier = crypto.randomBytes(16).toString('hex');
          window.localStorage.setItem('kepler-user-id', identifier);
        }
      break;
      case 'node':
        identifier = getMAC();
      break;
    }

    return crypto.createHash('sha256').update(identifier).digest('hex');
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
        try {
          return innerTrack(opts);
        } catch (_) { /* Analytics should not interfer with user process */ }
      }),
      new Promise((resolve) => setTimeout(resolve, timeout))
    ]);
  }

  private async _track(opts: TrackingOpts) {
    const user = this.forgeUserID();
    await axios({
      method: 'post',
      url: this.server_url,
      data: opts.tags || {},
      params: {
        a: opts.action,
        p: opts.product,
        v: opts.version,
        u: user,
      },
    });
  }
}