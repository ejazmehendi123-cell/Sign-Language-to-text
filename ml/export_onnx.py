"""
SanketSetu ONNX Export & Verification Script
Exports PyTorch checkpoint to ONNX Runtime Web compatible format under 2 MB.
Verifies numerical parity with onnxruntime and saves class map to web/public/models/.
"""

import json
import os
from pathlib import Path
import numpy as np
import onnx
import onnxruntime as ort
import torch

from ml.dataset import VOCABULARY_CLASSES
from ml.model import SanketSetuClassifier


def export_and_verify_onnx(
    checkpoint_path: str = "ml/checkpoints/best_model.pt",
    output_onnx_path: str = "web/public/models/sanketsetu_model.onnx",
    labels_path: str = "web/public/models/vocab_labels.json",
):
    ckpt_file = Path(checkpoint_path)
    assert ckpt_file.exists(), f"Checkpoint {ckpt_file} not found. Run ml/train.py first."

    out_onnx = Path(output_onnx_path)
    out_onnx.parent.mkdir(parents=True, exist_ok=True)

    print(f"[+] Loading checkpoint from {ckpt_file}...")
    ckpt = torch.load(ckpt_file, map_location="cpu", weights_only=False)
    model = SanketSetuClassifier(num_classes=len(VOCABULARY_CLASSES))
    model.load_state_dict(ckpt["model_state_dict"])
    model.eval()

    # Dummy input of shape (batch=1, seq_len=30, feature_dim=291)
    dummy_input = torch.randn(1, 30, 291, dtype=torch.float32)

    print(f"[+] Exporting to ONNX at {out_onnx}...")
    torch.onnx.export(
        model,
        dummy_input,
        str(out_onnx),
        export_params=True,
        opset_version=17,
        do_constant_folding=True,
        input_names=["input"],
        output_names=["logits"],
        dynamic_axes={
            "input": {0: "batch_size"},
            "logits": {0: "batch_size"},
        },
    )

    # Check file size
    size_bytes = out_onnx.stat().st_size
    size_mb = size_bytes / (1024 * 1024)
    print(f"[+] ONNX model file size: {size_bytes} bytes ({size_mb:.2f} MB)")
    assert size_mb < 2.0, f"ONNX model exceeded 2.0 MB limit ({size_mb:.2f} MB)"

    # Verify ONNX model structure
    onnx_proto = onnx.load(str(out_onnx))
    onnx.checker.check_model(onnx_proto)
    print("[+] ONNX model structure verified with onnx.checker.")

    # Verify ONNX Runtime numerical equivalence
    session = ort.InferenceSession(str(out_onnx), providers=["CPUExecutionProvider"])
    with torch.no_grad():
        pt_logits = model(dummy_input).numpy()

    ort_inputs = {"input": dummy_input.numpy()}
    ort_logits = session.run(["logits"], ort_inputs)[0]

    max_abs_err = np.max(np.abs(pt_logits - ort_logits))
    print(f"[+] Max absolute discrepancy between PyTorch and ONNX Runtime: {max_abs_err:.6e}")
    assert max_abs_err < 1e-4, f"ONNX Runtime parity failed (diff: {max_abs_err})"

    # Save vocabulary labels mapping
    labels_file = Path(labels_path)
    labels_file.parent.mkdir(parents=True, exist_ok=True)
    with open(labels_file, "w", encoding="utf-8") as f:
        json.dump(
            {
                "vocabulary": VOCABULARY_CLASSES,
                "num_classes": len(VOCABULARY_CLASSES),
                "model_size_bytes": size_bytes,
                "input_shape": [1, 30, 291],
            },
            f,
            indent=2,
        )
    print(f"[+] Saved vocabulary labels mapping to {labels_file}")
    print("✅ Model successfully exported and verified!")


if __name__ == "__main__":
    export_and_verify_onnx()
