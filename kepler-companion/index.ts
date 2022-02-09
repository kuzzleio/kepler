import getMAC from 'getmac';
import * as crypto from 'crypto';
import fetch from 'node-fetch';
import { merge } from 'lodash';

export type KeplerCompanionConfiguration = {
  server?: {
    host: string,
    port: number,
    ssl: boolean,
    trackingPath: string,
  },
  analytics?: {
    enabled: boolean,
    mode: KeplerCompanionMode,
  }
};

export type KeplerCompanionMode = 'browser' | 'node';

export type TrackingOpts = {
  action: string,
  product: string,
  version: string,
  tags?: { [key: string]: string },
}

export default class KeplerCompanion {
  public config: KeplerCompanionConfiguration = {
    server: {
      host: 'analytics.app.kuzzle.io',
      port: 443,
      ssl: true,
      trackingPath: '/_/analytics/track'
    },
    analytics: {
      enabled: true,
      mode: 'node',
    },
  };
  constructor(config?: KeplerCompanionConfiguration) {
    this.config = config ? merge(this.config, config) : this.config;
  }

  public get server_url() {
    const config = this.config.server;
    return `http${config.ssl ? 's' : ''}://${config.host}:${config.port}${config.trackingPath}`;
  }

  private forgeUserID(): string {
    let identifier: string;
    switch (this.config.analytics.mode) {
      case 'browser':
        identifier = 'browser';
        break;
      case 'node':
        identifier = getMAC();
      break;
    }

    return crypto.createHash('sha256').update(identifier).digest('hex');
  }

  public turnOff() {
    this.config.analytics.enabled = false;
  }

  public track(opts: TrackingOpts, timeout = 1000) {
    if (!this.config.analytics.enabled) {
      return;
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
    const url = `${this.server_url}?a=${opts.action}&p=${opts.product}&v=${opts.version}&u=${user}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(opts.tags || {}),
    });
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }
  }
}
