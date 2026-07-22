import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { env } from '../../config/env.js';
import { writeAuditLog } from '../../db/audit.js';
import { pool } from '../../db/pool.js';
import { AppError } from '../../http/errors.js';
import type { FaceMatch, FaceQualityInput, FaceSampleInput, LivenessInput, StoredFaceProfile } from './faceid.types.js';

const MAX_POSE_DEGREES = 22;
const MIN_FACE_AREA_RATIO = 0.08;
const MIN_SHARPNESS_SCORE = 45;

function normalizeVector(vector: number[]) {
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (!Number.isFinite(magnitude) || magnitude === 0) {
    throw new AppError(400, 'Dữ liệu khuôn mặt không hợp lệ', 'INVALID_FACE_DESCRIPTOR');
  }
  return vector.map((value) => value / magnitude);
}

function averageDescriptors(samples: FaceSampleInput[]) {
  const descriptorLength = env.FACE_DESCRIPTOR_DIMENSION;
  const accumulator = new Array<number>(descriptorLength).fill(0);

  for (const sample of samples) {
    const normalized = normalizeVector(sample.descriptor);
    for (let index = 0; index < descriptorLength; index += 1) {
      accumulator[index] += normalized[index];
    }
  }

  return normalizeVector(accumulator.map((value) => value / samples.length));
}

function descriptorToBuffer(descriptor: number[]) {
  const buffer = Buffer.allocUnsafe(descriptor.length * Float32Array.BYTES_PER_ELEMENT);
  descriptor.forEach((value, index) => buffer.writeFloatLE(value, index * Float32Array.BYTES_PER_ELEMENT));
  return buffer;
}

function bufferToDescriptor(buffer: Buffer) {
  if (buffer.length % Float32Array.BYTES_PER_ELEMENT !== 0) {
    throw new AppError(500, 'Dữ liệu FaceID đã lưu bị hỏng', 'CORRUPTED_FACE_DESCRIPTOR');
  }

  const descriptor = new Array<number>(buffer.length / Float32Array.BYTES_PER_ELEMENT);
  for (let index = 0; index < descriptor.length; index += 1) {
    descriptor[index] = buffer.readFloatLE(index * Float32Array.BYTES_PER_ELEMENT);
  }
  return descriptor;
}

function cosineSimilarity(left: number[], right: number[]) {
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] * left[index];
    rightMagnitude += right[index] * right[index];
  }

  if (leftMagnitude === 0 || rightMagnitude === 0) {
    return 0;
  }

  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

function scoreQuality(quality: FaceQualityInput) {
  const posePenalty = Math.min(
    1,
    (Math.abs(quality.yaw) + Math.abs(quality.pitch) + Math.abs(quality.roll)) / (MAX_POSE_DEGREES * 3)
  );
  const faceAreaScore = Math.min(1, quality.faceBoxAreaRatio / MIN_FACE_AREA_RATIO);
  const sharpnessScore = Math.min(1, quality.sharpnessScore / MIN_SHARPNESS_SCORE);

  return Number(
    (
      faceAreaScore * 0.25 +
      quality.brightnessScore * 0.2 +
      sharpnessScore * 0.25 +
      (1 - posePenalty) * 0.3
    ).toFixed(4)
  );
}

function assertQuality(samples: FaceSampleInput[], liveness: LivenessInput) {
  if (liveness.score < env.FACE_MIN_LIVENESS_SCORE) {
    throw new AppError(422, 'Không đạt yêu cầu xác thực người thật', 'LOW_LIVENESS_SCORE');
  }

  const badSample = samples.find((sample) => scoreQuality(sample.quality) < env.FACE_MIN_QUALITY_SCORE);
  if (badSample) {
    throw new AppError(422, `Mẫu khuôn mặt ${badSample.sampleType} có chất lượng quá thấp`, 'LOW_FACE_QUALITY');
  }
}

async function getEmployeeExists(employeeId: number) {
  const [rows] = await pool.query<RowDataPacket[]>('SELECT employee_id FROM employees WHERE employee_id = ? LIMIT 1', [
    employeeId
  ]);
  return rows.length > 0;
}

async function getActiveProfiles() {
  const [rows] = await pool.query<RowDataPacket[]>(
    `
    SELECT
      e.employee_id AS employeeId,
      e.employee_code AS employeeCode,
      e.full_name AS fullName,
      fp.face_profile_id AS faceProfileId,
      fp.threshold,
      fp.face_embedding AS embedding
    FROM face_profiles fp
    JOIN employees e ON e.employee_id = fp.employee_id
    WHERE fp.status = 'ACTIVE'
      AND fp.face_embedding IS NOT NULL
      AND e.employment_status = 'ACTIVE'
      AND (e.termination_date IS NULL OR e.termination_date > CURDATE())
    `
  );

  return rows.map((row) => ({
    employeeId: Number(row.employeeId),
    employeeCode: String(row.employeeCode),
    fullName: String(row.fullName),
    faceProfileId: Number(row.faceProfileId),
    threshold: Number(row.threshold),
    embedding: row.embedding as Buffer
  })) satisfies StoredFaceProfile[];
}

export async function enrollFace(
  employeeId: number,
  samples: FaceSampleInput[],
  liveness: LivenessInput,
  requestMeta?: { ipAddress?: string | null; userAgent?: string | null; debug?: boolean }
) {
  const exists = await getEmployeeExists(employeeId);
  if (!exists) {
    throw new AppError(404, 'Không tìm thấy nhân viên', 'EMPLOYEE_NOT_FOUND');
  }

  if (!requestMeta?.debug) assertQuality(samples, liveness);

  const averagedDescriptor = averageDescriptors(samples);
  const profileQuality = Number((samples.reduce((sum, sample) => sum + scoreQuality(sample.quality), 0) / samples.length).toFixed(4));
  const embeddingBuffer = descriptorToBuffer(averagedDescriptor);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    await connection.execute(
      `
      INSERT INTO face_profiles (
        employee_id, embedding_model, embedding_version, embedding_dimension,
        face_embedding, quality_score, liveness_score, samples_count,
        threshold, status, enrolled_at, last_verified_at
      )
      VALUES (?, 'mediapipe-face-landmarker', '1.0', ?, ?, ?, ?, ?, ?, 'ACTIVE', NOW(), NOW())
      ON DUPLICATE KEY UPDATE
        embedding_model = VALUES(embedding_model),
        embedding_version = VALUES(embedding_version),
        embedding_dimension = VALUES(embedding_dimension),
        face_embedding = VALUES(face_embedding),
        quality_score = VALUES(quality_score),
        liveness_score = VALUES(liveness_score),
        samples_count = VALUES(samples_count),
        threshold = VALUES(threshold),
        status = VALUES(status),
        enrolled_at = COALESCE(enrolled_at, NOW()),
        last_verified_at = NOW()
      `,
      [
        employeeId,
        env.FACE_DESCRIPTOR_DIMENSION,
        embeddingBuffer,
        profileQuality,
        liveness.score,
        samples.length,
        env.FACE_MATCH_THRESHOLD
      ]
    );

    const [profileRows] = await connection.query<RowDataPacket[]>(
      'SELECT face_profile_id FROM face_profiles WHERE employee_id = ? LIMIT 1',
      [employeeId]
    );
    const faceProfileId = Number(profileRows[0].face_profile_id);

    await connection.execute('DELETE FROM face_samples WHERE face_profile_id = ?', [faceProfileId]);

    for (const sample of samples) {
      await connection.execute(
        `
        INSERT INTO face_samples (
          face_profile_id, sample_type, image_path, embedding_blob,
          quality_score, brightness_score, sharpness_score,
          pose_yaw, pose_pitch, pose_roll, is_primary
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          faceProfileId,
          sample.sampleType,
          sample.imagePath ?? null,
          descriptorToBuffer(normalizeVector(sample.descriptor)),
          scoreQuality(sample.quality),
          sample.quality.brightnessScore,
          sample.quality.sharpnessScore,
          sample.quality.yaw,
          sample.quality.pitch,
          sample.quality.roll,
          sample.sampleType === 'FRONT' ? 1 : 0
        ]
      );
    }

    await writeAuditLog(connection, {
      action: 'FACE_ID_ENROLLED',
      entityType: 'FACE_PROFILE',
      entityId: faceProfileId,
      after: { employeeId, samplesCount: samples.length, qualityScore: profileQuality, livenessScore: liveness.score, debug: Boolean(requestMeta?.debug) },
      ipAddress: requestMeta?.ipAddress,
      userAgent: requestMeta?.userAgent
    });

    await connection.commit();

    return {
      employeeId,
      faceProfileId,
      status: 'ACTIVE',
      samplesCount: samples.length,
      qualityScore: profileQuality,
      livenessScore: liveness.score
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function verifyFace(
  descriptor: number[],
  quality: FaceQualityInput,
  liveness: LivenessInput,
  deviceId?: number | null,
  options?: { skipQualityChecks?: boolean }
) {
  const qualityScore = scoreQuality(quality);
  const normalizedDescriptor = normalizeVector(descriptor);

  let result = 'UNKNOWN_FACE';
  let bestMatch: FaceMatch | null = null;

  if (!options?.skipQualityChecks && qualityScore < env.FACE_MIN_QUALITY_SCORE) {
    result = 'LOW_CONFIDENCE';
  } else if (!options?.skipQualityChecks && liveness.score < env.FACE_MIN_LIVENESS_SCORE) {
    result = 'LIVENESS_FAILED';
  } else {
    const profiles = await getActiveProfiles();

    for (const profile of profiles) {
      const storedDescriptor = bufferToDescriptor(profile.embedding);
      const confidence = Number(cosineSimilarity(normalizedDescriptor, storedDescriptor).toFixed(4));

      if (!bestMatch || confidence > bestMatch.confidence) {
        bestMatch = {
          employeeId: profile.employeeId,
          employeeCode: profile.employeeCode,
          fullName: profile.fullName,
          confidence,
          threshold: profile.threshold
        };
      }
    }

    result = bestMatch && bestMatch.confidence >= bestMatch.threshold ? 'MATCHED' : 'UNKNOWN_FACE';
  }

  const [insertResult] = await pool.execute<ResultSetHeader>(
    `
    INSERT INTO recognition_attempts (
      employee_id, device_id, result, confidence, liveness_score,
      face_quality_score, threshold, processing_ms
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      result === 'MATCHED' ? bestMatch?.employeeId ?? null : null,
      deviceId ?? null,
      result,
      bestMatch?.confidence ?? null,
      liveness.score,
      qualityScore,
      bestMatch?.threshold ?? env.FACE_MATCH_THRESHOLD,
      null
    ]
  );

  if (result === 'MATCHED' && bestMatch) {
    await pool.execute('UPDATE face_profiles SET last_verified_at = NOW() WHERE employee_id = ?', [bestMatch.employeeId]);
  }

  return {
    attemptId: insertResult.insertId,
    matched: result === 'MATCHED',
    result,
    match: result === 'MATCHED' ? bestMatch : null,
    qualityScore,
    livenessScore: liveness.score
  };
}
