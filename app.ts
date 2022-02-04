import Kepler from './lib/Kepler';

const app = new Kepler('kepler')

app.start()
  .then(async () => {
    app.log.info('Application started')
  })
  .catch(console.error)
