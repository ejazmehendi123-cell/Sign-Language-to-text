#!/usr/bin/env python3
"""
ISL Kiosk Data Validator
Validates recorded landmark takes against shapes, NaN/Infs, frame counts, label typos, and missing metadata.
"""

import argparse
import json
import math
import sys
from pathlib import Path
from typing import Any, Dict, List, Set, Tuple


EXPECTED_POSE_LANDMARKS = 33
EXPECTED_HAND_LANDMARKS = 21


def load_vocabulary_labels(vocab_path: Path) -> Set[str]:
    try:
        with open(vocab_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            return {item["id"] for item in data.get("vocabulary", [])}
    except Exception as e:
        print(f"[-] Warning: Failed to load vocabulary from {vocab_path}: {e}", file=sys.stderr)
        return set()


def is_valid_coord(val: Any) -> bool:
    if not isinstance(val, (int, float)):
        return False
    if math.isnan(val) or math.isinf(val):
        return False
    return True


def validate_take_dict(
    take_data: Dict[str, Any],
    valid_labels: Set[str],
    min_frames: int = 10,
    max_frames: int = 180,
) -> Tuple[bool, List[str], List[str]]:
    """
    Validates a single take dictionary.
    Returns: (is_valid, errors, warnings)
    """
    errors: List[str] = []
    warnings: List[str] = []

    # Required top-level fields
    required_fields = ["signer_id", "label", "take_id", "timestamp", "fps", "frames"]
    for field in required_fields:
        if field not in take_data:
            errors.append(f"Missing required field: '{field}'")

    if errors:
        return False, errors, warnings

    # Metadata checks
    metadata = take_data.get("metadata", {})
    required_meta = [
        "lighting",
        "distance_cm_estimate",
        "background",
        "camera_height",
        "handedness_dominant",
        "device",
    ]
    for meta_key in required_meta:
        if meta_key not in metadata and meta_key not in take_data:
            warnings.append(f"Missing recommended metadata: '{meta_key}'")

    # Label validation (detect label typos)
    label = take_data.get("label", "")
    if valid_labels and label not in valid_labels:
        errors.append(f"Invalid label / typo '{label}'. Not in vocabulary.json")

    # Frame count check
    frames = take_data.get("frames", [])
    if not isinstance(frames, list):
        errors.append("Field 'frames' must be a list")
        return False, errors, warnings

    frame_count = len(frames)
    if frame_count < min_frames:
        errors.append(f"Frame count {frame_count} is below minimum {min_frames}")
    if frame_count > max_frames:
        warnings.append(f"Frame count {frame_count} exceeds recommended maximum {max_frames}")

    # Inspect each frame
    for f_idx, frame in enumerate(frames):
        if not isinstance(frame, dict):
            errors.append(f"Frame {f_idx}: Must be a dictionary")
            continue

        masks = frame.get("masks", {})
        pose_present = masks.get("pose", True)
        left_hand_present = masks.get("left_hand", True)
        right_hand_present = masks.get("right_hand", True)

        # 1. Pose landmarks check (33 landmarks)
        pose_landmarks = frame.get("pose", [])
        if pose_landmarks is not None:
            if not isinstance(pose_landmarks, list):
                errors.append(f"Frame {f_idx}: 'pose' must be a list of landmarks")
            elif len(pose_landmarks) > 0 and len(pose_landmarks) != EXPECTED_POSE_LANDMARKS:
                errors.append(
                    f"Frame {f_idx}: Pose landmark count is {len(pose_landmarks)}, expected {EXPECTED_POSE_LANDMARKS}"
                )
            else:
                for p_idx, lm in enumerate(pose_landmarks):
                    if not isinstance(lm, dict) or "x" not in lm or "y" not in lm or "z" not in lm:
                        errors.append(f"Frame {f_idx}, Pose {p_idx}: missing x/y/z coordinates")
                        break
                    if not (is_valid_coord(lm["x"]) and is_valid_coord(lm["y"]) and is_valid_coord(lm["z"])):
                        errors.append(f"Frame {f_idx}, Pose {p_idx}: contains NaN or Inf coordinates")
                        break

        # 2. Left hand check (21 landmarks)
        left_hand = frame.get("left_hand", [])
        if left_hand_present and left_hand:
            if len(left_hand) != EXPECTED_HAND_LANDMARKS:
                errors.append(
                    f"Frame {f_idx}: Left hand landmark count is {len(left_hand)}, expected {EXPECTED_HAND_LANDMARKS}"
                )
            else:
                for h_idx, lm in enumerate(left_hand):
                    if not isinstance(lm, dict) or "x" not in lm or "y" not in lm:
                        errors.append(f"Frame {f_idx}, LeftHand {h_idx}: missing coordinates")
                        break
                    if not (is_valid_coord(lm["x"]) and is_valid_coord(lm["y"]) and is_valid_coord(lm.get("z", 0))):
                        errors.append(f"Frame {f_idx}, LeftHand {h_idx}: contains NaN/Inf coordinates")
                        break

        # 3. Right hand check (21 landmarks)
        right_hand = frame.get("right_hand", [])
        if right_hand_present and right_hand:
            if len(right_hand) != EXPECTED_HAND_LANDMARKS:
                errors.append(
                    f"Frame {f_idx}: Right hand landmark count is {len(right_hand)}, expected {EXPECTED_HAND_LANDMARKS}"
                )
            else:
                for h_idx, lm in enumerate(right_hand):
                    if not isinstance(lm, dict) or "x" not in lm or "y" not in lm:
                        errors.append(f"Frame {f_idx}, RightHand {h_idx}: missing coordinates")
                        break
                    if not (is_valid_coord(lm["x"]) and is_valid_coord(lm["y"]) and is_valid_coord(lm.get("z", 0))):
                        errors.append(f"Frame {f_idx}, RightHand {h_idx}: contains NaN/Inf coordinates")
                        break

        if len(errors) > 25:
            errors.append("... aborting further frame checks due to excessive errors.")
            break

    is_valid = len(errors) == 0
    return is_valid, errors, warnings


def main():
    parser = argparse.ArgumentParser(description="Validate ISL landmark takes against dataset integrity rules.")
    parser.add_argument("--dir", type=str, help="Directory containing JSON landmark takes.")
    parser.add_argument("--file", type=str, help="Specific JSON take file to validate.")
    parser.add_argument(
        "--vocab",
        type=str,
        default="config/vocabulary.json",
        help="Path to vocabulary.json for label verification.",
    )
    parser.add_argument("--min-frames", type=int, default=10, help="Minimum allowable frames per take.")
    parser.add_argument("--max-frames", type=int, default=180, help="Maximum recommended frames per take.")

    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parent.parent
    vocab_path = Path(args.vocab)
    if not vocab_path.is_absolute():
        vocab_path = repo_root / vocab_path

    valid_labels = load_vocabulary_labels(vocab_path)
    if not valid_labels:
        print("[-] Warning: No vocabulary labels loaded; label check disabled.", file=sys.stderr)

    files_to_check: List[Path] = []
    if args.file:
        files_to_check.append(Path(args.file))
    elif args.dir:
        dpath = Path(args.dir)
        if not dpath.is_absolute():
            dpath = repo_root / dpath
        if dpath.exists():
            files_to_check.extend(dpath.rglob("*.json"))

    if not files_to_check:
        print("[!] No take files provided or found to validate. Run with --file or create takes in --dir.")
        sys.exit(0)

    seen_take_ids: Set[str] = set()
    total_valid = 0
    total_invalid = 0

    print(f"=== Validating {len(files_to_check)} take file(s) ===")

    for fpath in files_to_check:
        try:
            with open(fpath, "r", encoding="utf-8") as f:
                take_data = json.load(f)
        except Exception as e:
            print(f"[-] [FAIL] {fpath.name}: Failed to read JSON - {e}")
            total_invalid += 1
            continue

        take_id = take_data.get("take_id")
        if take_id in seen_take_ids:
            print(f"[-] [FAIL] {fpath.name}: Duplicate take_id detected ('{take_id}')")
            total_invalid += 1
            continue
        if take_id:
            seen_take_ids.add(take_id)

        is_valid, errors, warnings = validate_take_dict(
            take_data,
            valid_labels,
            min_frames=args.min_frames,
            max_frames=args.max_frames,
        )

        if is_valid:
            warn_str = f" ({len(warnings)} warnings)" if warnings else ""
            print(f"[+] [PASS] {fpath.name} | Signer: {take_data.get('signer_id')} | Label: {take_data.get('label')}{warn_str}")
            total_valid += 1
        else:
            print(f"[-] [FAIL] {fpath.name}:")
            for err in errors[:5]:
                print(f"    Error: {err}")
            total_invalid += 1

    print("\n=== Validation Summary ===")
    print(f"Total Takes Evaluated: {len(files_to_check)}")
    print(f"Valid: {total_valid}")
    print(f"Invalid: {total_invalid}")

    if total_invalid > 0:
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
