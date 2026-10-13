"""
SanketSetu Synthetic & Recorded Dataset Generator
Generates realistic multi-signer temporal landmark sequences across all 22 vocabulary classes.
Provides proper signer-disjoint train / validation / test splits for held-out evaluation.
"""

import json
from pathlib import Path
from typing import Dict, List, Tuple
import numpy as np
import torch
from torch.utils.data import Dataset

from ml.preprocess import (
    SPATIAL_DIM,
    TOTAL_FEATURE_DIM,
    TARGET_FRAMES,
    UPPER_BODY_POSE_INDICES,
    extract_frame_spatial_and_mask,
    preprocess_take_frames,
)

VOCABULARY_CLASSES = [
    "i",
    "need",
    "certificate",
    "birth",
    "death",
    "income",
    "address",
    "form",
    "help",
    "where",
    "wait",
    "fee",
    "yes",
    "no",
    "repeat",
    "slow",
    "thank_you",
    "name",
    "document",
    "status",
    "no_sign",
    "unknown",
]

LABEL_TO_IDX = {name: idx for idx, name in enumerate(VOCABULARY_CLASSES)}
IDX_TO_LABEL = {idx: name for idx, name in enumerate(VOCABULARY_CLASSES)}


def generate_synthetic_raw_take(
    label: str,
    signer_id: str,
    take_idx: int,
    duration_frames: int = 25,
    rng: np.random.Generator = None,
) -> Dict:
    """
    Synthesizes a realistic raw take containing MediaPipe-structured landmark coordinates
    with kinematics matching the designated ISL sign or negative motion pattern.
    """
    if rng is None:
        rng = np.random.default_rng()

    # Signer biological variations
    shoulder_w = float(rng.uniform(0.18, 0.26))
    shoulder_y = float(rng.uniform(0.42, 0.52))
    shoulder_x = 0.5 + float(rng.uniform(-0.03, 0.03))
    p11_x = shoulder_x + shoulder_w / 2.0
    p12_x = shoulder_x - shoulder_w / 2.0

    frames = []
    class_idx = LABEL_TO_IDX.get(label, 21)

    # Class-specific kinematic trajectory archetypes
    two_handed_classes = {"need", "certificate", "birth", "death", "income", "address", "form", "help", "where", "wait", "fee", "name", "document", "slow"}
    is_two_handed = label in two_handed_classes

    phase_offset = float(rng.uniform(0, 0.1))

    for t in range(duration_frames):
        progress = float(t) / max(1, duration_frames - 1)

        # Baseline pose skeleton (33 landmarks)
        pose = []
        for i in range(33):
            pose.append({"x": 0.5, "y": 0.5, "z": 0.0, "visibility": 0.95})

        # Set upper body pose
        pose[11] = {"x": p11_x, "y": shoulder_y, "z": 0.0, "visibility": 0.98}
        pose[12] = {"x": p12_x, "y": shoulder_y, "z": 0.0, "visibility": 0.98}

        # Kinematic arm motion based on class
        if label == "i":
            # Right hand points to chest center
            rh_center = (
                shoulder_x + 0.05 * np.cos(progress * np.pi),
                shoulder_y + 0.12 + 0.02 * np.sin(progress * np.pi),
            )
            lh_center = (p11_x + 0.1, shoulder_y + 0.35)
            has_lh = False
            has_rh = True
        elif label == "thank_you":
            # Right hand starts at chin and arcs forward/downward
            rh_center = (
                shoulder_x + 0.02,
                shoulder_y - 0.08 + progress * 0.20,
            )
            lh_center = (p11_x + 0.1, shoulder_y + 0.35)
            has_lh = False
            has_rh = True
        elif label == "certificate":
            # Both hands frame a rectangle moving outward and forward
            rh_center = (shoulder_x + 0.12 + 0.04 * np.sin(progress * np.pi), shoulder_y + 0.15)
            lh_center = (shoulder_x - 0.12 - 0.04 * np.sin(progress * np.pi), shoulder_y + 0.15)
            has_lh = True
            has_rh = True
        elif label == "birth":
            # Downward motion from abdomen
            rh_center = (shoulder_x + 0.06, shoulder_y + 0.15 + progress * 0.22)
            lh_center = (shoulder_x - 0.06, shoulder_y + 0.15 + progress * 0.22)
            has_lh = True
            has_rh = True
        elif label == "death":
            # Both hands rotate/overturn
            rh_center = (shoulder_x + 0.10, shoulder_y + 0.18 + 0.05 * np.sin(progress * np.pi))
            lh_center = (shoulder_x - 0.10, shoulder_y + 0.18 + 0.05 * np.sin(progress * np.pi))
            has_lh = True
            has_rh = True
        elif label == "income":
            # Rubbing fingers near chest
            rh_center = (shoulder_x + 0.04, shoulder_y + 0.16 + 0.02 * np.sin(progress * 4 * np.pi))
            lh_center = (shoulder_x - 0.04, shoulder_y + 0.16 + 0.02 * np.sin(progress * 4 * np.pi))
            has_lh = True
            has_rh = True
        elif label == "yes":
            # Nodding right fist vertically
            rh_center = (shoulder_x + 0.10, shoulder_y + 0.10 + 0.06 * np.sin(progress * 3 * np.pi))
            lh_center = (p11_x + 0.1, shoulder_y + 0.35)
            has_lh = False
            has_rh = True
        elif label == "no":
            # Snapping fingers horizontally
            rh_center = (shoulder_x + 0.10 + 0.05 * np.sin(progress * 3 * np.pi), shoulder_y + 0.12)
            lh_center = (p11_x + 0.1, shoulder_y + 0.35)
            has_lh = False
            has_rh = True
        elif label == "wait":
            # Extended flat palms held stationary
            rh_center = (shoulder_x + 0.12, shoulder_y + 0.22 + 0.005 * rng.standard_normal())
            lh_center = (shoulder_x - 0.12, shoulder_y + 0.22 + 0.005 * rng.standard_normal())
            has_lh = True
            has_rh = True
        elif label == "where":
            # Palms shrugging outwards
            rh_center = (shoulder_x + 0.10 + progress * 0.08, shoulder_y + 0.20)
            lh_center = (shoulder_x - 0.10 - progress * 0.08, shoulder_y + 0.20)
            has_lh = True
            has_rh = True
        elif label == "no_sign":
            # Negative actions: idle, scratching head, phone, resting
            sub_type = take_idx % 4
            if sub_type == 0:  # Rest / lap
                rh_center = (p12_x, shoulder_y + 0.38 + 0.005 * np.sin(progress))
                lh_center = (p11_x, shoulder_y + 0.38 + 0.005 * np.cos(progress))
                has_lh = bool(rng.uniform() > 0.4)
                has_rh = bool(rng.uniform() > 0.4)
            elif sub_type == 1:  # Scratch head
                rh_center = (p12_x - 0.02, shoulder_y - 0.15 + 0.02 * np.sin(progress * 2 * np.pi))
                lh_center = (p11_x, shoulder_y + 0.38)
                has_lh = False
                has_rh = True
            elif sub_type == 2:  # Adjust glasses
                rh_center = (shoulder_x + 0.03, shoulder_y - 0.08)
                lh_center = (p11_x, shoulder_y + 0.38)
                has_lh = False
                has_rh = True
            else:  # Fold arms
                rh_center = (shoulder_x - 0.05, shoulder_y + 0.25)
                lh_center = (shoulder_x + 0.05, shoulder_y + 0.25)
                has_lh = True
                has_rh = True
        elif label == "unknown":
            # Random erratic trajectory
            rh_center = (
                0.5 + 0.15 * np.sin(progress * 5 * np.pi + phase_offset),
                0.6 + 0.15 * np.cos(progress * 3 * np.pi),
            )
            lh_center = (
                0.5 - 0.15 * np.cos(progress * 4 * np.pi),
                0.6 + 0.15 * np.sin(progress * 2 * np.pi),
            )
            has_lh = bool(rng.uniform() > 0.5)
            has_rh = True
        else:
            # Default generic distinct ISL spatial trajectory parameterized by class_idx
            freq = 1.0 + (class_idx % 5) * 0.5
            amp = 0.08 + (class_idx % 3) * 0.03
            rh_center = (
                shoulder_x + 0.08 + amp * np.sin(progress * freq * np.pi),
                shoulder_y + 0.15 + amp * np.cos(progress * freq * np.pi),
            )
            if is_two_handed:
                lh_center = (
                    shoulder_x - 0.08 - amp * np.sin(progress * freq * np.pi),
                    shoulder_y + 0.15 + amp * np.cos(progress * freq * np.pi),
                )
                has_lh = True
            else:
                lh_center = (p11_x + 0.05, shoulder_y + 0.35)
                has_lh = False
            has_rh = True

        # Wrists in pose follow hand centers
        pose[15] = {"x": lh_center[0], "y": lh_center[1], "z": 0.0, "visibility": 0.95}
        pose[16] = {"x": rh_center[0], "y": rh_center[1], "z": 0.0, "visibility": 0.95}
        pose[13] = {"x": (p11_x + lh_center[0]) / 2, "y": (shoulder_y + lh_center[1]) / 2, "z": 0.0, "visibility": 0.95}
        pose[14] = {"x": (p12_x + rh_center[0]) / 2, "y": (shoulder_y + rh_center[1]) / 2, "z": 0.0, "visibility": 0.95}

        # Generate 21 hand landmarks relative to hand centers
        left_hand = []
        if has_lh:
            for k in range(21):
                kx = lh_center[0] + float(rng.uniform(-0.025, 0.025))
                ky = lh_center[1] + float(rng.uniform(-0.025, 0.025))
                left_hand.append({"x": kx, "y": ky, "z": float(rng.uniform(-0.01, 0.01))})

        right_hand = []
        if has_rh:
            for k in range(21):
                kx = rh_center[0] + float(rng.uniform(-0.025, 0.025))
                ky = rh_center[1] + float(rng.uniform(-0.025, 0.025))
                right_hand.append({"x": kx, "y": ky, "z": float(rng.uniform(-0.01, 0.01))})

        frame = {
            "timestamp_ms": t * 33,
            "pose": pose,
            "left_hand": left_hand,
            "right_hand": right_hand,
            "masks": {
                "pose": True,
                "left_hand": has_lh,
                "right_hand": has_rh,
            },
        }
        frames.append(frame)

    return {
        "signer_id": signer_id,
        "label": label,
        "take_id": f"take_{signer_id}_{label}_{take_idx:03d}",
        "timestamp": int(1728800000000 + take_idx * 1000),
        "fps": 30,
        "frame_count": len(frames),
        "metadata": {
            "lighting": "bright_indoor",
            "distance_cm_estimate": 100,
            "background": "plain",
            "camera_height": "chest_level",
            "handedness_dominant": "right",
            "device": "Synthetic Generator",
            "notes": f"Synthetic generator take for {label}",
        },
        "frames": frames,
    }


class ISLDataset(Dataset):
    def __init__(self, samples: List[Tuple[np.ndarray, int, str]]):
        """
        samples: list of (features (30, 291), label_idx, signer_id)
        """
        self.samples = samples

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, torch.Tensor]:
        features, label_idx, _ = self.samples[idx]
        return torch.tensor(features, dtype=torch.float32), torch.tensor(
            label_idx, dtype=torch.long
        )


def build_synthetic_dataset(
    num_signers: int = 6,
    reps_per_label: int = 15,
    seed: int = 42,
) -> Tuple[ISLDataset, ISLDataset, ISLDataset]:
    """
    Builds full multi-signer dataset with strictly held-out signer split:
    - Train: signers 1 to 4
    - Validation: signer 5
    - Held-out Test: signer 6
    """
    rng = np.random.default_rng(seed)
    train_samples = []
    val_samples = []
    test_samples = []

    signers = [f"signer_{i + 1}" for i in range(num_signers)]
    train_signers = set(signers[:4])
    val_signers = {signers[4]}
    test_signers = {signers[5]}

    for signer_id in signers:
        for label in VOCABULARY_CLASSES:
            label_idx = LABEL_TO_IDX[label]
            for rep in range(reps_per_label):
                dur = int(rng.integers(18, 38))
                take = generate_synthetic_raw_take(
                    label=label,
                    signer_id=signer_id,
                    take_idx=rep,
                    duration_frames=dur,
                    rng=rng,
                )
                features = preprocess_take_frames(take["frames"])

                item = (features, label_idx, signer_id)
                if signer_id in train_signers:
                    train_samples.append(item)
                elif signer_id in val_signers:
                    val_samples.append(item)
                else:
                    test_samples.append(item)

    return (
        ISLDataset(train_samples),
        ISLDataset(val_samples),
        ISLDataset(test_samples),
    )
