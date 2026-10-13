export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export interface FrameLandmarks {
  timestamp_ms: number;
  pose: Landmark[];
  left_hand: Landmark[];
  right_hand: Landmark[];
  masks: {
    pose: boolean;
    left_hand: boolean;
    right_hand: boolean;
  };
}

export type LightingCondition =
  | 'bright_indoor'
  | 'dim_indoor'
  | 'backlit'
  | 'natural_window'
  | 'mixed';

export type BackgroundType = 'plain' | 'cluttered' | 'moving_background';

export type CameraHeight = 'desk_level' | 'chest_level' | 'eye_level' | 'high_angle';

export type Handedness = 'right' | 'left' | 'ambidextrous';

export interface TakeMetadata {
  lighting: LightingCondition;
  distance_cm_estimate: number;
  background: BackgroundType;
  camera_height: CameraHeight;
  handedness_dominant: Handedness;
  device: string;
  notes: string;
}

export interface RecordedTake {
  signer_id: string;
  label: string;
  take_id: string;
  timestamp: number;
  fps: number;
  metadata: TakeMetadata;
  frames: FrameLandmarks[];
  frame_count: number;
}

export interface SignerConsent {
  signer_id: string;
  consent_timestamp: number;
  consented: boolean;
  language: string;
  notes?: string;
}

export interface VocabularyItem {
  id: string;
  gloss: string;
  labels: Record<string, string>;
  category: string;
  verified: boolean;
  verified_by: string | null;
  source_ref: string | null;
  regional_variant: string | null;
  two_handed: boolean;
  notes: string;
}

export interface VocabularyConfig {
  version: string;
  description: string;
  vocabulary: VocabularyItem[];
}

export interface CoverageStats {
  totalTakes: number;
  uniqueSigners: number;
  byLabel: Record<string, number>;
  bySigner: Record<string, number>;
  byLighting: Record<string, number>;
  signersPerLabel: Record<string, Set<string>>;
  labelsNeedingSigners: string[]; // labels with < 5 signers
  labelsNeedingReps: string[]; // labels with < target reps
}
