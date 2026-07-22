import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8000),
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_USER: z.string().default('root'),
  DB_PASSWORD: z.string().default(''),
  DB_NAME: z.string().default('facelog_db'),
  AUTH_SECRET: z.string().min(16).default('facelog-development-secret-change-me'),
  AUTH_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(28800),
  ATTENDANCE_EARLY_CHECK_IN_MINUTES: z.coerce.number().int().min(0).max(120).default(5),
  FACE_DESCRIPTOR_DIMENSION: z.coerce.number().int().positive().default(128),
  FACE_MATCH_THRESHOLD: z.coerce.number().min(0).max(1).default(0.7),
  FACE_MIN_QUALITY_SCORE: z.coerce.number().min(0).max(1).default(0.75),
  FACE_MIN_LIVENESS_SCORE: z.coerce.number().min(0).max(1).default(0.85)
});

export const env = envSchema.parse(process.env);
