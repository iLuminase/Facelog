import { Router } from 'express';
import { requireAuth, requireRoles, type AuthenticatedRequest } from '../../auth/middleware.js';
import { AppError } from '../../http/errors.js';
import { asyncHandler } from '../../http/async-handler.js';
import { enrollFaceSchema, verifyFaceSchema } from './faceid.schemas.js';
import { enrollFace, verifyFace } from './faceid.service.js';

export const faceIdRouter = Router();

faceIdRouter.get('/model-policy', (_req, res) => {
  res.json({
    success: true,
    data: {
      clientModel: 'MediaPipe Face Landmarker / Tasks Vision',
      clientResponsibilities: [
        'open camera with getUserMedia',
        'detect face bounding box',
        'render face mesh landmarks and guide grid',
        'collect 3-8 guided samples',
        'run liveness challenge before sending enrollment or verification payload'
      ],
      backendResponsibilities: [
        'validate landmark count and quality metrics',
        'store normalized face embedding',
        'compare descriptors with cosine similarity',
        'log recognition attempts for reliability dashboard'
      ],
      requiredLandmarks: 468,
      descriptorDimension: 128
    }
  });
});

faceIdRouter.post(
  '/enroll',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'HR_MANAGER', 'HR_STAFF'),
  asyncHandler(async (req, res) => {
    const body = enrollFaceSchema.parse(req.body);
    if (body.debug && (req as AuthenticatedRequest).auth.role !== 'SUPER_ADMIN') {
      throw new AppError(403, 'Chỉ quản trị viên được đăng ký FaceID ở chế độ debug', 'FACE_DEBUG_FORBIDDEN');
    }
    const result = await enrollFace(body.employeeId, body.samples, body.liveness, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      debug: body.debug
    });

    res.status(201).json({
      success: true,
      data: result
    });
  })
);

faceIdRouter.post(
  '/verify',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'HR_MANAGER', 'HR_STAFF'),
  asyncHandler(async (req, res) => {
    const body = verifyFaceSchema.parse(req.body);
    if (body.debug && (req as AuthenticatedRequest).auth.role !== 'SUPER_ADMIN') {
      throw new AppError(403, 'Chỉ quản trị viên được kiểm tra FaceID ở chế độ debug', 'FACE_DEBUG_FORBIDDEN');
    }
    const result = await verifyFace(body.descriptor, body.quality, body.liveness, body.deviceId, {
      skipQualityChecks: body.debug
    });

    res.json({
      success: true,
      data: result
    });
  })
);
