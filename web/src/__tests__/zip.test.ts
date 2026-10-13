import { describe, it, expect } from 'vitest';
import { exportSessionZip, importSessionZip } from '../services/zip';
import { RecordedTake, SignerConsent } from '../types';

describe('Zip Session Export & Import', () => {
  it('correctly packages takes and restores them with matching data', async () => {
    const mockConsent: SignerConsent = {
      signer_id: 'signer_20261013_9999',
      consent_timestamp: 1728800000000,
      consented: true,
      language: 'en',
      notes: 'Test consent',
    };

    const mockTake: RecordedTake = {
      signer_id: 'signer_20261013_9999',
      label: 'certificate',
      take_id: 'take_test_001',
      timestamp: 1728800005000,
      fps: 30,
      metadata: {
        lighting: 'bright_indoor',
        distance_cm_estimate: 100,
        background: 'plain',
        camera_height: 'chest_level',
        handedness_dominant: 'right',
        device: 'Vitest Runner',
        notes: 'Automated test take',
      },
      frames: [
        {
          timestamp_ms: 0,
          pose: Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.9 })),
          left_hand: Array.from({ length: 21 }, () => ({ x: 0.3, y: 0.6, z: 0 })),
          right_hand: Array.from({ length: 21 }, () => ({ x: 0.7, y: 0.6, z: 0 })),
          masks: {
            pose: true,
            left_hand: true,
            right_hand: true,
          },
        },
      ],
      frame_count: 1,
    };

    const blob = await exportSessionZip([mockTake], [mockConsent]);
    expect(blob).toBeDefined();
    expect(blob.size).toBeGreaterThan(100);

    const { takes, consents, manifest } = await importSessionZip(blob);

    expect(manifest).toBeDefined();
    expect(manifest?.total_takes).toBe(1);
    expect(manifest?.signers).toContain('signer_20261013_9999');

    expect(consents.length).toBe(1);
    expect(consents[0].signer_id).toBe('signer_20261013_9999');

    expect(takes.length).toBe(1);
    expect(takes[0].take_id).toBe('take_test_001');
    expect(takes[0].frames.length).toBe(1);
    expect(takes[0].frames[0].pose.length).toBe(33);
    expect(takes[0].frames[0].left_hand.length).toBe(21);
    expect(takes[0].frames[0].right_hand.length).toBe(21);
  });
});
