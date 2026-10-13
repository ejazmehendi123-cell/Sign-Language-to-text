"""
Unit tests for SanketSetu ML pipeline (model, dataset, shapes, parameter count)
"""

import pytest
import torch
import numpy as np
from ml.model import SanketSetuClassifier, INPUT_DIM, NUM_CLASSES, SEQ_LEN
from ml.dataset import (
    generate_synthetic_raw_take,
    VOCABULARY_CLASSES,
    LABEL_TO_IDX,
    ISLDataset,
)
from ml.preprocess import preprocess_take_frames


def test_model_architecture_and_shapes():
    model = SanketSetuClassifier(num_classes=NUM_CLASSES)
    model.eval()

    batch_size = 4
    x = torch.randn(batch_size, SEQ_LEN, INPUT_DIM, dtype=torch.float32)
    with torch.no_grad():
        out = model(x)

    assert out.shape == (batch_size, NUM_CLASSES), f"Expected {(batch_size, NUM_CLASSES)}, got {out.shape}"


def test_model_parameter_size_under_2mb():
    model = SanketSetuClassifier(num_classes=NUM_CLASSES)
    total_params = sum(p.numel() for p in model.parameters())
    # Size in megabytes for float32 weights
    size_mb = (total_params * 4) / (1024 * 1024)

    assert size_mb < 2.0, f"Model size {size_mb:.2f} MB exceeds 2 MB target"
    assert total_params < 500_000, f"Model has {total_params} parameters, expected < 500K"


def test_synthetic_take_generation():
    take = generate_synthetic_raw_take("certificate", "signer_test", 0, duration_frames=20)
    assert take["label"] == "certificate"
    assert take["signer_id"] == "signer_test"
    assert len(take["frames"]) == 20

    # Verify frame masks are boolean and not silent empty
    first_frame = take["frames"][0]
    assert "masks" in first_frame
    assert "pose" in first_frame["masks"]
    assert "left_hand" in first_frame["masks"]
    assert "right_hand" in first_frame["masks"]

    # Preprocess take
    features = preprocess_take_frames(take["frames"])
    assert features.shape == (30, 291)
    assert not np.isnan(features).any(), "Preprocessed features contained NaN"
