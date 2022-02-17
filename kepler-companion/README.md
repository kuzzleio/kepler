# Kepler Companon

## Installation

```
npm install kepler-companion
```

## Usage

```js
import KeplerCompanion from 'kepler-companion';

const tracker = new KeplerCompanion();

tracker.track({
  action: 'action:to:track',
  product: 'my-product',
  version: '1.0.0',
});

```