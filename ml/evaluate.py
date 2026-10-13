"""
SanketSetu Model Evaluation Script
Evaluates held-out-signer top-1 & top-3 accuracy, confusion matrix, and latency benchmarks.
Saves results report to docs/results/evaluation_report.json.
"""

import json
from pathlib import Path
import time
import numpy as np
import torch
from torch.utils.data import DataLoader

from ml.dataset import build_synthetic_dataset, VOCABULARY_CLASSES, IDX_TO_LABEL
from ml.model import SanketSetuClassifier


def evaluate_model(
    checkpoint_path: str = "ml/checkpoints/best_model.pt",
    output_report_path: str = "docs/results/evaluation_report.json",
):
    ckpt_file = Path(checkpoint_path)
    assert ckpt_file.exists(), f"Checkpoint not found at {ckpt_file}. Run ml/train.py first."

    out_file = Path(output_report_path)
    out_file.parent.mkdir(parents=True, exist_ok=True)

    print("[+] Loading held-out test split (held-out signer)...")
    _, _, test_ds = build_synthetic_dataset(num_signers=6, reps_per_label=15, seed=42)
    test_loader = DataLoader(test_ds, batch_size=1, shuffle=False)

    ckpt = torch.load(ckpt_file, map_location="cpu", weights_only=False)
    model = SanketSetuClassifier(num_classes=len(VOCABULARY_CLASSES))
    model.load_state_dict(ckpt["model_state_dict"])
    model.eval()

    num_classes = len(VOCABULARY_CLASSES)
    confusion = np.zeros((num_classes, num_classes), dtype=int)
    latencies_ms = []

    top1_correct = 0
    top3_correct = 0
    total = len(test_ds)

    with torch.no_grad():
        for x, y in test_loader:
            t0 = time.perf_counter()
            logits = model(x)
            t1 = time.perf_counter()
            latencies_ms.append((t1 - t0) * 1000.0)

            true_label = y.item()
            pred_top1 = logits.argmax(dim=1).item()
            top3_preds = logits.topk(3, dim=1).indices[0].tolist()

            confusion[true_label, pred_top1] += 1
            if pred_top1 == true_label:
                top1_correct += 1
            if true_label in top3_preds:
                top3_correct += 1

    top1_acc = float(top1_correct / max(1, total))
    top3_acc = float(top3_correct / max(1, total))

    # Calculate per-class metrics
    per_class = {}
    for i, name in enumerate(VOCABULARY_CLASSES):
        tp = confusion[i, i]
        fp = confusion[:, i].sum() - tp
        fn = confusion[i, :].sum() - tp
        precision = float(tp / (tp + fp)) if (tp + fp) > 0 else 0.0
        recall = float(tp / (tp + fn)) if (tp + fn) > 0 else 0.0
        f1 = float(2 * precision * recall / (precision + recall)) if (precision + recall) > 0 else 0.0
        per_class[name] = {
            "samples": int(confusion[i, :].sum()),
            "precision": round(precision, 4),
            "recall": round(recall, 4),
            "f1": round(f1, 4),
        }

    p50_latency = float(np.percentile(latencies_ms, 50))
    p95_latency = float(np.percentile(latencies_ms, 95))
    p99_latency = float(np.percentile(latencies_ms, 99))

    report = {
        "timestamp": int(time.time()),
        "checkpoint": str(ckpt_file),
        "held_out_signer": "signer_6",
        "total_test_samples": total,
        "metrics": {
            "top1_accuracy": round(top1_acc, 4),
            "top3_accuracy": round(top3_acc, 4),
            "p50_latency_ms": round(p50_latency, 2),
            "p95_latency_ms": round(p95_latency, 2),
            "p99_latency_ms": round(p99_latency, 2),
        },
        "per_class": per_class,
        "confusion_matrix": confusion.tolist(),
        "vocabulary": VOCABULARY_CLASSES,
    }

    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print("\n================== HELD-OUT SIGNER EVALUATION ==================")
    print(f"Held-Out Signer Top-1 Accuracy : {top1_acc * 100:.2f}%")
    print(f"Held-Out Signer Top-3 Accuracy : {top3_acc * 100:.2f}%")
    print(f"Inference Latency (p50)        : {p50_latency:.2f} ms (Target < 500 ms)")
    print(f"Inference Latency (p95)        : {p95_latency:.2f} ms (Target < 800 ms)")
    print(f"Results report saved to        : {out_file}")
    print("=================================================================\n")

    return report


if __name__ == "__main__":
    evaluate_model()
