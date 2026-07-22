import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { pingDatabase } from './db/pool.js';
import { createApp } from './app.js';

async function bootstrap() {
  await pingDatabase();

  const app = createApp();
  app.listen(env.PORT, () => {
    logger.info(`FaceLog backend is running on http://localhost:${env.PORT}`);
  });
}

bootstrap().catch((error) => {
  logger.error(error, 'Failed to start FaceLog backend');
  process.exit(1);
});
