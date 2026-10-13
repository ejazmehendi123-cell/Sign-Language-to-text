import json
import math
import sys
from pathlib import Path
import pytest

# Add repo root to path
REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from tools.validate_data import validate_take_dict, load_vocabulary_labels
from tools.validate_config import load_json, validate_schema


def test_validate_config_schemas():
    """Verify that all production configuration files adhere to their JSON schemas."""
    config_dir = REPO_ROOT / "config"
    vocab_schema = load_json(config_dir / "vocabulary.schema.json")
    vocab_data = load_json(config_dir / "vocabulary.json")
    assert validate_schema(vocab_data, vocab_schema, "vocab_test") is True

    thresh_schema = load_json(config_dir / "thresholds.schema.json")
    thresh_data = load_json(config_dir / "thresholds.json")
    assert validate_schema(thresh_data, thresh_schema, "thresh_test") is True

    flow_schema = load_json(config_dir / "flow.schema.json")
    birth_flow = load_json(config_dir / "flows" / "birth_certificate.json")
    assert validate_schema(birth_flow, flow_schema, "birth_test") is True


def test_validate_data_valid_fixture():
    """Verify that a syntactically correct take with 15 frames passes validation."""
    valid_labels = {"certificate", "help", "no_sign"}
    sample_take = {
        "signer_id": "signer_20261013_0001",
        "label": "certificate",
        "take_id": "take_001",
        "timestamp": 1728800000000,
        "fps": 30,
        "metadata": {
            "lighting": "bright_indoor",
            "distance_cm_estimate": 100,
            "background": "plain",
            "camera_height": "chest_level",
            "handedness_dominant": "right",
            "device": "macbook_facetime_cam",
            "notes": "Test take fixture"
        },
        "frames": [
            {
                "timestamp_ms": i * 33,
                "pose": [{"x": 0.5, "y": 0.5, "z": 0.0, "visibility": 0.9} for _ in range(33)],
                "left_hand": [{"x": 0.4, "y": 0.6, "z": 0.0} for _ in range(21)],
                "right_hand": [{"x": 0.6, "y": 0.6, "z": 0.0} for _ in range(21)],
                "masks": {
                    "pose": True,
                    "left_hand": True,
                    "right_hand": True
                }
            }
            for i in range(15)
        ]
    }

    is_valid, errors, warnings = validate_take_dict(sample_take, valid_labels, min_frames=10)
    assert is_valid is True
    assert len(errors) == 0


def test_validate_data_detects_nan():
    """Verify that NaN coordinates trigger validation failure."""
    valid_labels = {"certificate"}
    take_with_nan = {
        "signer_id": "signer_20261013_0001",
        "label": "certificate",
        "take_id": "take_nan_001",
        "timestamp": 1728800000000,
        "fps": 30,
        "frames": [
            {
                "timestamp_ms": 0,
                "pose": [{"x": float("nan"), "y": 0.5, "z": 0.0} for _ in range(33)],
                "left_hand": [],
                "right_hand": [],
                "masks": {"pose": True, "left_hand": False, "right_hand": False}
            }
            for _ in range(15)
        ]
    }
    is_valid, errors, _ = validate_take_dict(take_with_nan, valid_labels)
    assert is_valid is False
    assert any("NaN" in e for e in errors)


def test_validate_data_detects_label_typo():
    """Verify that unlisted vocabulary labels trigger validation failure."""
    valid_labels = {"certificate", "help"}
    take_bad_label = {
        "signer_id": "signer_20261013_0001",
        "label": "certificte_typo",
        "take_id": "take_bad_001",
        "timestamp": 1728800000000,
        "fps": 30,
        "frames": [
            {
                "timestamp_ms": i * 33,
                "pose": [{"x": 0.5, "y": 0.5, "z": 0.0} for _ in range(33)],
                "masks": {"pose": True, "left_hand": False, "right_hand": False}
            }
            for i in range(15)
        ]
    }
    is_valid, errors, _ = validate_take_dict(take_bad_label, valid_labels)
    assert is_valid is False
    assert any("typo" in e.lower() or "invalid label" in e.lower() for e in errors)


def test_validate_data_detects_too_few_frames():
    """Verify that takes under the minimum frame count are flagged."""
    valid_labels = {"help"}
    take_short = {
        "signer_id": "signer_20261013_0001",
        "label": "help",
        "take_id": "take_short_001",
        "timestamp": 1728800000000,
        "fps": 30,
        "frames": [
            {
                "timestamp_ms": 0,
                "pose": [{"x": 0.5, "y": 0.5, "z": 0.0} for _ in range(33)],
                "masks": {"pose": True, "left_hand": False, "right_hand": False}
            }
        ]
    }
    is_valid, errors, _ = validate_take_dict(take_short, valid_labels, min_frames=10)
    assert is_valid is False
    assert any("below minimum" in e for e in errors)
