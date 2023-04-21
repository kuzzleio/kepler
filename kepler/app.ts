import Kepler from './lib/Kepler';

const app = new Kepler('kepler')

app.start()
  .then(console.log)
  .catch(console.error)