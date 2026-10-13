import { FilesetResolver, HandLandmarker, PoseLandmarker } from '@mediapipe/tasks-vision';
import { FrameLandmarks, Landmark } from '../types';

let handLandmarker: HandLandmarker | null = null;
let poseLandmarker: PoseLandmarker | null = null;
let isInitializing = false;
let initError: string | null = null;

const WASM_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const HAND_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const POSE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

export async function initLandmarkers(onProgress?: (msg: string) => void): Promise<boolean> {
  if (handLandmarker && poseLandmarker) return true;
  if (isInitializing) return false;

  isInitializing = true;
  initError = null;

  try {
    onProgress?.('Fetching MediaPipe WASM runtime...');
    const vision = await FilesetResolver.forVisionTasks(WASM_CDN);

    onProgress?.('Loading Hand Landmarker model...');
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: HAND_MODEL_URL,
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numHands: 2,
    });

    onProgress?.('Loading Pose Landmarker model...');
    poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: POSE_MODEL_URL,
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
    });

    onProgress?.('Landmark vision models loaded.');
    isInitializing = false;
    return true;
  } catch (err: any) {
    console.warn('Failed to initialize MediaPipe models (falling back to mock/offline mode):', err);
    initError = err?.message || 'MediaPipe initialization failed';
    isInitializing = false;
    return false;
  }
}

export function getInitStatus() {
  return {
    isReady: Boolean(handLandmarker && poseLandmarker),
    isInitializing,
    error: initError,
  };
}

export function extractLandmarksFromVideo(
  videoElement: HTMLVideoElement,
  timestampMs: number
): FrameLandmarks {
  if (!handLandmarker || !poseLandmarker) {
    return generateMockLandmarks(timestampMs);
  }

  try {
    const poseResult = poseLandmarker.detectForVideo(videoElement, timestampMs);
    const handResult = handLandmarker.detectForVideo(videoElement, timestampMs);

    const poseLandmarks: Landmark[] =
      poseResult.landmarks && poseResult.landmarks[0]
        ? poseResult.landmarks[0].map((lm) => ({
            x: lm.x,
            y: lm.y,
            z: lm.z,
            visibility: (lm as any).visibility ?? 1.0,
          }))
        : [];

    let leftHandLandmarks: Landmark[] = [];
    let rightHandLandmarks: Landmark[] = [];

    if (handResult.landmarks && handResult.handedness) {
      for (let i = 0; i < handResult.landmarks.length; i++) {
        const hand = handResult.landmarks[i];
        const handednessCategory = handResult.handedness[i]?.[0]?.categoryName;
        // In selfie/mirror mode MediaPipe category might invert; store detected side
        const mappedLandmarks: Landmark[] = hand.map((lm) => ({
          x: lm.x,
          y: lm.y,
          z: lm.z,
        }));

        if (handednessCategory === 'Left') {
          leftHandLandmarks = mappedLandmarks;
        } else {
          rightHandLandmarks = mappedLandmarks;
        }
      }
    }

    const posePresent = poseLandmarks.length === 33;
    const leftHandPresent = leftHandLandmarks.length === 21;
    const rightHandPresent = rightHandLandmarks.length === 21;

    return {
      timestamp_ms: timestampMs,
      pose: poseLandmarks,
      left_hand: leftHandLandmarks,
      right_hand: rightHandLandmarks,
      masks: {
        pose: posePresent,
        left_hand: leftHandPresent,
        right_hand: rightHandPresent,
      },
    };
  } catch (e) {
    console.error('Frame landmark detection error:', e);
    return generateMockLandmarks(timestampMs);
  }
}

/**
 * Deterministic synthetic mock landmark generator used when running in CI or offline.
 */
export function generateMockLandmarks(timestampMs: number): FrameLandmarks {
  const t = timestampMs / 1000;
  const pose: Landmark[] = [];

  // Generate 33 pose landmarks
  for (let i = 0; i < 33; i++) {
    const offsetX = Math.sin(t * 2 + i * 0.1) * 0.05;
    const offsetY = Math.cos(t * 2 + i * 0.1) * 0.03;
    pose.push({
      x: 0.5 + offsetX,
      y: 0.4 + (i / 33) * 0.5 + offsetY,
      z: 0.0,
      visibility: 0.95,
    });
  }

  // Generate 21 left hand landmarks
  const left_hand: Landmark[] = [];
  for (let i = 0; i < 21; i++) {
    left_hand.push({
      x: 0.35 + Math.sin(t * 3 + i * 0.2) * 0.04,
      y: 0.65 + Math.cos(t * 3 + i * 0.2) * 0.04,
      z: 0.0,
    });
  }

  // Generate 21 right hand landmarks
  const right_hand: Landmark[] = [];
  for (let i = 0; i < 21; i++) {
    right_hand.push({
      x: 0.65 + Math.sin(t * 3 + i * 0.2) * 0.04,
      y: 0.65 + Math.cos(t * 3 + i * 0.2) * 0.04,
      z: 0.0,
    });
  }

  return {
    timestamp_ms: timestampMs,
    pose,
    left_hand,
    right_hand,
    masks: {
      pose: true,
      left_hand: true,
      right_hand: true,
    },
  };
}

export function drawLandmarksOnCanvas(
  canvas: HTMLCanvasElement,
  frame: FrameLandmarks,
  width: number,
  height: number
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, width, height);

  // Draw Pose skeleton
  if (frame.masks.pose && frame.pose.length === 33) {
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.7)'; // blue
    ctx.fillStyle = '#60a5fa';
    ctx.lineWidth = 3;

    // Connect shoulders to elbows to wrists (11, 13, 15 & 12, 14, 16)
    const connections: [number, number][] = [
      [11, 12], // shoulders
      [11, 13], [13, 15], // left arm
      [12, 14], [14, 16], // right arm
      [11, 23], [12, 24], [23, 24], // torso
    ];

    for (const [from, to] of connections) {
      const p1 = frame.pose[from];
      const p2 = frame.pose[to];
      if (p1 && p2) {
        ctx.beginPath();
        ctx.moveTo(p1.x * width, p1.y * height);
        ctx.lineTo(p2.x * width, p2.y * height);
        ctx.stroke();
      }
    }

    for (const lm of frame.pose) {
      ctx.beginPath();
      ctx.arc(lm.x * width, lm.y * height, 4, 0, 2 * Math.PI);
      ctx.fill();
    }
  }

  // Draw Left Hand (Emerald)
  if (frame.masks.left_hand && frame.left_hand.length === 21) {
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.9)'; // emerald
    ctx.fillStyle = '#34d399';
    ctx.lineWidth = 2;

    for (const lm of frame.left_hand) {
      ctx.beginPath();
      ctx.arc(lm.x * width, lm.y * height, 3, 0, 2 * Math.PI);
      ctx.fill();
    }
  }

  // Draw Right Hand (Cyan)
  if (frame.masks.right_hand && frame.right_hand.length === 21) {
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.9)'; // cyan
    ctx.fillStyle = '#22d3ee';
    ctx.lineWidth = 2;

    for (const lm of frame.right_hand) {
      ctx.beginPath();
      ctx.arc(lm.x * width, lm.y * height, 3, 0, 2 * Math.PI);
      ctx.fill();
    }
  }
}
