import { describe, it, expect } from 'vitest';
import vocabData from '../../../config/vocabulary.json';
import thresholdsData from '../../../config/thresholds.json';
import birthFlow from '../../../config/flows/birth_certificate.json';

describe('Configuration Contracts Integrity', () => {
  it('loads vocabulary with all entries initially set to verified: false', () => {
    expect(vocabData.vocabulary.length).toBeGreaterThanOrEqual(20);

    const unverifiedCount = vocabData.vocabulary.filter((v: any) => v.verified === false).length;
    expect(unverifiedCount).toBe(vocabData.vocabulary.length);
  });

  it('contains reserved no_sign and unknown classes', () => {
    const ids = vocabData.vocabulary.map((v: any) => v.id);
    expect(ids).toContain('no_sign');
    expect(ids).toContain('unknown');
  });

  it('defines valid global thresholds', () => {
    expect(thresholdsData.confidence_default).toBeGreaterThan(0.5);
    expect(thresholdsData.min_margin_default).toBeGreaterThan(0);
    expect(thresholdsData.motion_window_min_frames).toBeGreaterThanOrEqual(10);
  });

  it('defines birth certificate flow with legitimate initial state and transitions', () => {
    expect(birthFlow.service_id).toBe('birth_certificate');
    expect(birthFlow.initial_state).toBe('select_service_type');
    expect((birthFlow.states as Record<string, any>)[birthFlow.initial_state]).toBeDefined();
  });
});
