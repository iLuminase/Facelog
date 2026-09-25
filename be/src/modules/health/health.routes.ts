import { Router } from 'express';
import { pingDatabase } from '../../db/pool.js';
import { asyncHandler } from '../../http/async-handler.js';

export const healthRouter = Router();

healthRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    await pingDatabase();
    res.set('Cache-Control', 'no-store');
    res.json({
      success: true,
      service: 'FaceLog',
      database: 'ok',
      timestamp: new Date().toISOString()
    });
  })
);
