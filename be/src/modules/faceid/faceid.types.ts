export type FaceLandmark = {
  x: number;
  y: number;
  z?: number;
};

export type FaceQualityInput = {
  faceBoxAreaRatio: number;
  brightnessScore: number;
  sharpnessScore: number;
  yaw: number;
  pitch: number;
  roll: number;
};

export type LivenessInput = {
  score: number;
  blinkScore?: number;
  headTurnScore?: number;
  textureScore?: number;
  challengeId?: string;
};

export type FaceSampleInput = {
  sampleType: 'FRONT' | 'LEFT' | 'RIGHT' | 'UP' | 'DOWN' | 'WITH_MASK' | 'OTHER';
  descriptor: number[];
  landmarks: FaceLandmark[];
  quality: FaceQualityInput;
  imagePath?: string | null;
};

export type StoredFaceProfile = {
  employeeId: number;
  employeeCode: string;
  fullName: string;
  faceProfileId: number;
  threshold: number;
  embedding: Buffer;
};

export type FaceMatch = {
  employeeId: number;
  employeeCode: string;
  fullName: string;
  confidence: number;
  threshold: number;
};
