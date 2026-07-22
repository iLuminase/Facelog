import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { logger } from './config/logger.js';
import { errorHandler, notFoundHandler } from './http/errors.js';
import { attendanceRouter } from './modules/attendance/attendance.routes.js';
import { accountRouter } from './modules/accounts/account.routes.js';
import { auditRouter } from './modules/audit/audit.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { employeeRouter } from './modules/employees/employee.routes.js';
import { faceIdRouter } from './modules/faceid/faceid.routes.js';
import { healthRouter } from './modules/health/health.routes.js';
import { shiftRouter } from './modules/shifts/shift.routes.js';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '15mb' }));
  app.use(pinoHttp({ logger }));

  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/accounts', accountRouter);
  app.use('/api/shifts', shiftRouter);
  app.use('/api/employees', employeeRouter);
  app.use('/api/faceid', faceIdRouter);
  app.use('/api/attendance', attendanceRouter);
  app.use('/api/audit-logs', auditRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
