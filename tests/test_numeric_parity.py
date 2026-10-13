"""
Numeric Parity Test (Python)
Verifies that ml/preprocess.py produces exact numerical results matching the shared fixture.
"""

import json
from pathlib import Path
import numpy as np
import pytest
from ml.preprocess import preprocess_take_frames, calculate_motion_energy


def test_python_preprocessing_parity():
    repo_root = Path(__file__).resolve().parent.parent
    raw_fixture_path = repo_root / "data" / "fixtures" / "sample_take_raw.json"
    expected_fixture_path = repo_root / "data" / "fixtures" / "sample_take_preprocessed.json"

    assert raw_fixture_path.exists(), f"Missing {raw_fixture_path}"
    assert expected_fixture_path.exists(), f"Missing {expected_fixture_path}"

    with open(raw_fixture_path, "r", encoding="utf-8") as f:
        raw_take = json.load(f)

    with open(expected_fixture_path, "r", encoding="utf-8") as f:
        expected = json.load(f)

    expected_features = np.array(expected["features"], dtype=np.float32)

    actual_features = preprocess_take_frames(raw_take["frames"])

    assert actual_features.shape == (30, 291)
    # Check max absolute error is <= 1e-5
    max_abs_err = np.max(np.abs(actual_features - expected_features))
    assert max_abs_err < 1e-5, f"Python parity max abs err {max_abs_err} exceeded tolerance 1e-5"


def test_motion_energy_calculation():
    repo_root = Path(__file__).resolve().parent.parent
    raw_fixture_path = repo_root / "data" / "fixtures" / "sample_take_raw.json"

    with open(raw_fixture_path, "r", encoding="utf-8") as f:
        raw_take = json.load(f)

    frames = raw_take["frames"]
    assert len(frames) >= 2

    # Consecutive frame kinetic motion energy should be positive for active sign
    energy = calculate_motion_energy(frames[0], frames[1])
    assert energy >= 0.0
