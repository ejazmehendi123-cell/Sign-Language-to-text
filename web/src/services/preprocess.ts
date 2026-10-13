/**
 * SanketSetu Preprocessing Pipeline (TypeScript)
 * Normalizes, resamples to 30 frames, and extracts velocities and masks.
 * Strictly parity-tested against ml/preprocess.py.
 */

import { FrameLandmarks } from '../types';

export const UPPER_BODY_POSE_INDICES = [11, 12, 13, 14, 15, 16]; // shoulders, elbows, wrists
export const NUM_POSE_KEYPOINTS = UPPER_BODY_POSE_INDICES.length; // 6 -> 18 coords
export const NUM_HAND_KEYPOINTS = 21; // 21 -> 63 coords each
export const SPATIAL_DIM = (NUM_POSE_KEYPOINTS + NUM_HAND_KEYPOINTS * 2) * 3; // 18 + 63 + 63 = 144
export const TOTAL_FEATURE_DIM = SPATIAL_DIM + SPATIAL_DIM + 3; // 144 coords + 144 velocities + 3 masks = 291
export const TARGET_FRAMES = 30;

/**
 * Extracts normalized spatial coordinates (144 floats) and mask vector (3 floats)
 */
export function extractFrameSpatialAndMask(frame: FrameLandmarks): {
  spatial: Float32Array;
  mask: Float32Array;
} {
  const pose = frame.pose || [];
  const leftHand = frame.left_hand || [];
  const rightHand = frame.right_hand || [];
  const masks = frame.masks || { pose: false, left_hand: false, right_hand: false };

  const poseMask = Boolean(masks.pose) && pose.length >= 17;
  const leftMask = Boolean(masks.left_hand) && leftHand.length === 21;
  const rightMask = Boolean(masks.right_hand) && rightHand.length === 21;

  let centerX = 0.5;
  let centerY = 0.5;
  let centerZ = 0.0;
  let scale = 1.0;

  if (poseMask) {
    const p11 = pose[11];
    const p12 = pose[12];
    centerX = (p11.x + p12.x) / 2.0;
    centerY = (p11.y + p12.y) / 2.0;
    centerZ = ((p11.z || 0.0) + (p12.z || 0.0)) / 2.0;

    const dx = p11.x - p12.x;
    const dy = p11.y - p12.y;
    const dz = (p11.z || 0.0) - (p12.z || 0.0);
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    scale = dist > 1e-4 ? dist : 1.0;
  }

  const spatial = new Float32Array(SPATIAL_DIM);
  let offset = 0;

  // 1. Upper body pose (6 keypoints * 3)
  if (poseMask) {
    for (const idx of UPPER_BODY_POSE_INDICES) {
      const lm = pose[idx];
      spatial[offset] = (lm.x - centerX) / scale;
      spatial[offset + 1] = (lm.y - centerY) / scale;
      spatial[offset + 2] = ((lm.z || 0.0) - centerZ) / scale;
      offset += 3;
    }
  } else {
    offset += NUM_POSE_KEYPOINTS * 3;
  }

  // 2. Left hand (21 keypoints * 3)
  if (leftMask) {
    for (const lm of leftHand) {
      spatial[offset] = (lm.x - centerX) / scale;
      spatial[offset + 1] = (lm.y - centerY) / scale;
      spatial[offset + 2] = ((lm.z || 0.0) - centerZ) / scale;
      offset += 3;
    }
  } else {
    offset += NUM_HAND_KEYPOINTS * 3;
  }

  // 3. Right hand (21 keypoints * 3)
  if (rightMask) {
    for (const lm of rightHand) {
      spatial[offset] = (lm.x - centerX) / scale;
      spatial[offset + 1] = (lm.y - centerY) / scale;
      spatial[offset + 2] = ((lm.z || 0.0) - centerZ) / scale;
      offset += 3;
    }
  } else {
    offset += NUM_HAND_KEYPOINTS * 3;
  }

  const mask = new Float32Array([
    poseMask ? 1.0 : 0.0,
    leftMask ? 1.0 : 0.0,
    rightMask ? 1.0 : 0.0,
  ]);

  return { spatial, mask };
}

/**
 * Linearly resamples temporal sequence of length T to targetLen (30) frames
 */
export function resampleTemporalSequence(
  spatialSeq: Float32Array[],
  maskSeq: Float32Array[],
  targetLen: number = TARGET_FRAMES
): {
  resampledSpatial: Float32Array[];
  resampledMask: Float32Array[];
} {
  const T = spatialSeq.length;
  if (T === 0) {
    const emptySpatial = Array.from({ length: targetLen }, () => new Float32Array(SPATIAL_DIM));
    const emptyMask = Array.from({ length: targetLen }, () => new Float32Array(3));
    return { resampledSpatial: emptySpatial, resampledMask: emptyMask };
  }

  if (T === 1) {
    const singleSpatial = spatialSeq[0];
    const singleMask = maskSeq[0];
    const resSpatial = Array.from({ length: targetLen }, () => new Float32Array(singleSpatial));
    const resMask = Array.from({ length: targetLen }, () => new Float32Array(singleMask));
    return { resampledSpatial: resSpatial, resampledMask: resMask };
  }

  const resampledSpatial: Float32Array[] = [];
  const resampledMask: Float32Array[] = [];

  for (let j = 0; j < targetLen; j++) {
    const u = (j * (T - 1)) / (targetLen - 1);
    const i0 = Math.floor(u);
    const i1 = Math.min(i0 + 1, T - 1);
    const alpha = u - i0;

    const s0 = spatialSeq[i0];
    const s1 = spatialSeq[i1];
    const targetS = new Float32Array(SPATIAL_DIM);
    for (let k = 0; k < SPATIAL_DIM; k++) {
      targetS[k] = (1.0 - alpha) * s0[k] + alpha * s1[k];
    }
    resampledSpatial.push(targetS);

    const m0 = maskSeq[i0];
    const m1 = maskSeq[i1];
    const targetM = new Float32Array(3);
    for (let k = 0; k < 3; k++) {
      targetM[k] = (1.0 - alpha) * m0[k] + alpha * m1[k];
    }
    resampledMask.push(targetM);
  }

  return { resampledSpatial, resampledMask };
}

/**
 * Computes inter-frame velocities across the 30 resampled frames
 */
export function computeVelocities(spatialSeq: Float32Array[]): Float32Array[] {
  const targetLen = spatialSeq.length;
  const velocities: Float32Array[] = [];

  for (let j = 0; j < targetLen; j++) {
    const vel = new Float32Array(SPATIAL_DIM);
    if (j > 0) {
      const prev = spatialSeq[j - 1];
      const curr = spatialSeq[j];
      for (let k = 0; k < SPATIAL_DIM; k++) {
        vel[k] = curr[k] - prev[k];
      }
    }
    velocities.push(vel);
  }

  return velocities;
}

/**
 * Preprocesses a raw frames sequence into a flattened Float32Array of length 30 * 291 = 8,730
 * or a 2D array [30][291].
 */
export function preprocessTakeFrames(frames: FrameLandmarks[]): Float32Array {
  const result = new Float32Array(TARGET_FRAMES * TOTAL_FEATURE_DIM);

  if (!frames || frames.length === 0) {
    return result;
  }

  const spatialList: Float32Array[] = [];
  const maskList: Float32Array[] = [];

  for (const f of frames) {
    const { spatial, mask } = extractFrameSpatialAndMask(f);
    spatialList.push(spatial);
    maskList.push(mask);
  }

  const { resampledSpatial, resampledMask } = resampleTemporalSequence(spatialList, maskList, TARGET_FRAMES);
  const velocities = computeVelocities(resampledSpatial);

  for (let j = 0; j < TARGET_FRAMES; j++) {
    const rowOffset = j * TOTAL_FEATURE_DIM;
    const s = resampledSpatial[j];
    const v = velocities[j];
    const m = resampledMask[j];

    // Copy spatial coords (144)
    result.set(s, rowOffset);
    // Copy velocities (144)
    result.set(v, rowOffset + SPATIAL_DIM);
    // Copy masks (3)
    result.set(m, rowOffset + SPATIAL_DIM * 2);
  }

  return result;
}

/**
 * Computes kinetic motion energy between consecutive frames for boundary trigger
 */
export function calculateMotionEnergy(prevFrame: FrameLandmarks, currFrame: FrameLandmarks): number {
  const pointsPrev: { x: number; y: number; z?: number }[] = [];
  const pointsCurr: { x: number; y: number; z?: number }[] = [];

  const posePrev = prevFrame.pose || [];
  const poseCurr = currFrame.pose || [];
  const masksPrev = prevFrame.masks || { pose: false, left_hand: false, right_hand: false };
  const masksCurr = currFrame.masks || { pose: false, left_hand: false, right_hand: false };

  if (masksPrev.pose && masksCurr.pose) {
    if (posePrev.length > 16 && poseCurr.length > 16) {
      pointsPrev.push(posePrev[15], posePrev[16]);
      pointsCurr.push(poseCurr[15], poseCurr[16]);
    }
  }

  const lhPrev = prevFrame.left_hand || [];
  const lhCurr = currFrame.left_hand || [];
  if (masksPrev.left_hand && masksCurr.left_hand && lhPrev.length > 0 && lhCurr.length > 0) {
    pointsPrev.push(lhPrev[0]);
    pointsCurr.push(lhCurr[0]);
  }

  const rhPrev = prevFrame.right_hand || [];
  const rhCurr = currFrame.right_hand || [];
  if (masksPrev.right_hand && masksCurr.right_hand && rhPrev.length > 0 && rhCurr.length > 0) {
    pointsPrev.push(rhPrev[0]);
    pointsCurr.push(rhCurr[0]);
  }

  if (pointsPrev.length === 0) {
    return 0.0;
  }

  let totalDist = 0.0;
  for (let i = 0; i < pointsPrev.length; i++) {
    const p0 = pointsPrev[i];
    const p1 = pointsCurr[i];
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const dz = (p1.z || 0.0) - (p0.z || 0.0);
    totalDist += Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  return totalDist / pointsPrev.length;
}
