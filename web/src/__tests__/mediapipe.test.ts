import { describe, it, expect } from 'vitest';
import { generateMockLandmarks } from '../services/mediapipe';

describe('MediaPipe Mock Pipeline & Landmark Masks', () => {
  it('generates consistent skeletal landmark counts (33 pose, 21 per hand)', () => {
    const frame = generateMockLandmarks(1000);

    expect(frame.pose.length).toBe(33);
    expect(frame.left_hand.length).toBe(21);
    expect(frame.right_hand.length).toBe(21);

    expect(frame.masks.pose).toBe(true);
    expect(frame.masks.left_hand).toBe(true);
    expect(frame.masks.right_hand).toBe(true);
  });

  it('guarantees coordinates are finite numbers without NaNs or Infs', () => {
    const frame = generateMockLandmarks(500);

    for (const lm of frame.pose) {
      expect(Number.isFinite(lm.x)).toBe(true);
      expect(Number.isFinite(lm.y)).toBe(true);
      expect(Number.isFinite(lm.z)).toBe(true);
    }

    for (const lm of frame.left_hand) {
      expect(Number.isFinite(lm.x)).toBe(true);
      expect(Number.isFinite(lm.y)).toBe(true);
    }

    for (const lm of frame.right_hand) {
      expect(Number.isFinite(lm.x)).toBe(true);
      expect(Number.isFinite(lm.y)).toBe(true);
    }
  });
});
