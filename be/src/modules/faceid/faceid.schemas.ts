import { z } from 'zod';
import { env } from '../../config/env.js';

// MediaPipe can return a small overflow outside the normalized image when a face
// touches the frame. Accept that documented edge case, then normalize before use.
const normalizedCoordinateSchema = z.number().finite().min(-0.25).max(1.25)
  .transform((value) => Math.min(1, Math.max(0, value)));

const landmarkSchema = z.object({
  x: normalizedCoordinateSchema,
  y: normalizedCoordinateSchema,
  z: z.number().optional()
});

const qualitySchema = z.object({
  faceBoxAreaRatio: z.number().min(0).max(1),
  brightnessScore: z.number().min(0).max(1),
  sharpnessScore: z.number().min(0),
  yaw: z.number(),
  pitch: z.number(),
  roll: z.number()
});

const descriptorSchema = z.array(z.number()).length(env.FACE_DESCRIPTOR_DIMENSION);

export const livenessSchema = z.object({
  score: z.number().min(0).max(1),
  blinkScore: z.number().min(0).max(1).optional(),
  headTurnScore: z.number().min(0).max(1).optional(),
  textureScore: z.number().min(0).max(1).optional(),
  challengeId: z.string().max(120).optional()
});

export const faceSampleSchema = z.object({
  sampleType: z.enum(['FRONT', 'LEFT', 'RIGHT', 'UP', 'DOWN', 'WITH_MASK', 'OTHER']),
  descriptor: descriptorSchema,
  landmarks: z.array(landmarkSchema).min(468),
  quality: qualitySchema,
  imagePath: z.string().max(500).optional().nullable()
});

export const enrollFaceSchema = z.object({
  employeeId: z.number().int().positive(),
  samples: z.array(faceSampleSchema).min(3).max(8),
  liveness: livenessSchema,
  debug: z.boolean().default(false)
});

export const verifyFaceSchema = z.object({
  descriptor: descriptorSchema,
  landmarks: z.array(landmarkSchema).min(468),
  quality: qualitySchema,
  liveness: livenessSchema,
  deviceId: z.number().int().positive().optional().nullable(),
  debug: z.boolean().default(false)
});
