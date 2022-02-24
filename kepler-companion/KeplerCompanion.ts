import getMAC from 'getmac';

const crypto = typeof window === 'undefined' ? require('crypto') : window.crypto;

export type KeplerCompanionConfiguration = {
  host: string;
  port: number;
  ssl: boolean;
  enabled: boolean;
  timeout: number;
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
  public config: KeplerCompanionConfiguration = {
    host: 'kepler.app.kuzzle.io',
    port: 443,
    ssl: true,
    enabled: true,
    timeout: 500,
  };

  constructor(config: Partial<KeplerCompanionConfiguration> = {}) {
    this.config = { ...this.config, ...config };
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

  /**
   * Add telemetry.
   * Never returns a rejected promise
   */
  public async add (opts: TelemetryOpts): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    if (process.env.CI) {
      opts.tags = opts.tags || {};
      opts.tags.ci = true;
    }

    const user = this.getUserId(opts.product);

    try {
      await this.sendHttpRequest({
        method: 'POST',
        path: '/_/telemetry/register',
        params: {
          a: opts.action,
          p: opts.product,
          v: opts.version,
          u: user,
        },
        body: {
          t: opts.tags,
        },
      });
    }
    catch (error) {
      // Do nothing
    }
  }

  private sendHttpRequest ({ method, path, params, body }: {
    method: string,
    path: string,
    params: any,
    body: any,
  }) {
    const queryArgs = new URLSearchParams(params);
    const url = `http${this.config.ssl ? 's' : ''}://${this.config.host}:${this.config.port}${path}?${queryArgs}`;

    if (typeof XMLHttpRequest === 'undefined') {
      // NodeJS implementation, using http.request:

      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const httpClient = require('min-req-promise');

      return httpClient.request(url, method, {
        body: JSON.stringify(body),
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: this.config.timeout
      });
    }

    // Browser implementation, using XMLHttpRequest:
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.timeout = this.config.timeout;

      xhr.onreadystatechange = () => {
        if (xhr.readyState === 4 && xhr.status === 0) {
          reject(new Error('Cannot connect to host. Is the host online?'));
        }
      };

      xhr.open(method, url);
      xhr.setRequestHeader('Content-Type', 'application/json');

      xhr.onload = () => {
        try {
          resolve(xhr.responseText);
        }
        catch (err) {
          reject(err);
        }
      };

      xhr.send(JSON.stringify(body));
    });
  }
}
