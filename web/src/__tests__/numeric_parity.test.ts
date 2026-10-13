import { describe, it, expect } from 'vitest';
import { preprocessTakeFrames, calculateMotionEnergy, TARGET_FRAMES, TOTAL_FEATURE_DIM } from '../services/preprocess';
import rawFixture from '../../../data/fixtures/sample_take_raw.json';
import expectedFixture from '../../../data/fixtures/sample_take_preprocessed.json';

describe('Numeric Parity Test (TypeScript vs Python)', () => {
  it('produces identical preprocessed feature output within 1e-5 tolerance of Python', () => {
    // Process using TypeScript implementation
    // @ts-ignore
    const flatFeatures = preprocessTakeFrames(rawFixture.frames);

    expect(flatFeatures.length).toBe(TARGET_FRAMES * TOTAL_FEATURE_DIM);
    expect(flatFeatures.length).toBe(30 * 291);

    const expected2D = expectedFixture.features as number[][];

    let maxAbsErr = 0;
    for (let r = 0; r < 30; r++) {
      for (let c = 0; c < 291; c++) {
        const actual = flatFeatures[r * 291 + c];
        const expected = expected2D[r][c];
        const diff = Math.abs(actual - expected);
        if (diff > maxAbsErr) {
          maxAbsErr = diff;
        }
      }
    }

    // Must be strictly within 1e-5
    expect(maxAbsErr).toBeLessThan(1e-5);
  });

  it('calculates non-negative motion energy between consecutive frames', () => {
    // @ts-ignore
    const frames = rawFixture.frames;
    expect(frames.length).toBeGreaterThanOrEqual(2);

    const energy = calculateMotionEnergy(frames[0], frames[1]);
    expect(energy).toBeGreaterThanOrEqual(0.0);
  });
});
