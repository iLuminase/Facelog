import { Router } from 'express';
import { asyncHandler } from '../../http/async-handler.js';
import { pingDatabase } from '../../db/pool.js';

export const healthRouter = Router();

healthRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    await pingDatabase();
    res.json({
      success: true,
      service: 'FaceLog',
      database: 'ok',
      timestamp: new Date().toISOString()
    });
  })
);
