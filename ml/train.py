"""
SanketSetu Model Training Script
Trains on-device ISL phrase recognition classifier with held-out signer cross-validation.
Zero GPU required; trains in ~20-30s on CPU.
"""

import os
from pathlib import Path
import random
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader

from ml.dataset import build_synthetic_dataset, VOCABULARY_CLASSES
from ml.model import SanketSetuClassifier

SEED = 42


def set_seed(seed: int = SEED):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def train_model(
    epochs: int = 18,
    batch_size: int = 32,
    lr: float = 1e-3,
    output_dir: str = "ml/checkpoints",
):
    set_seed(SEED)
    out_path = Path(output_dir)
    out_path.mkdir(parents=True, exist_ok=True)

    print("[+] Building multi-signer dataset with held-out signer splits...")
    train_ds, val_ds, test_ds = build_synthetic_dataset(
        num_signers=6, reps_per_label=15, seed=SEED
    )
    print(f"    Train size: {len(train_ds)}, Val size: {len(val_ds)}, Test size: {len(test_ds)}")

    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=batch_size, shuffle=False)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[+] Training on device: {device}")

    model = SanketSetuClassifier(num_classes=len(VOCABULARY_CLASSES)).to(device)
    criterion = nn.CrossEntropyLoss(label_smoothing=0.05)
    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs, eta_min=1e-5)

    best_val_acc = 0.0
    best_ckpt_path = out_path / "best_model.pt"

    for epoch in range(1, epochs + 1):
        model.train()
        total_loss = 0.0
        correct = 0
        total = 0

        for x, y in train_loader:
            x, y = x.to(device), y.to(device)
            optimizer.zero_grad()
            logits = model(x)
            loss = criterion(logits, y)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            optimizer.step()

            total_loss += loss.item() * x.size(0)
            preds = logits.argmax(dim=1)
            correct += (preds == y).sum().item()
            total += x.size(0)

        scheduler.step()
        train_acc = correct / max(1, total)
        train_loss = total_loss / max(1, total)

        # Validation
        model.eval()
        val_correct = 0
        val_total = 0
        with torch.no_grad():
            for x, y in val_loader:
                x, y = x.to(device), y.to(device)
                logits = model(x)
                preds = logits.argmax(dim=1)
                val_correct += (preds == y).sum().item()
                val_total += x.size(0)

        val_acc = val_correct / max(1, val_total)
        print(
            f"Epoch {epoch:02d}/{epochs:02d} | Train Loss: {train_loss:.4f} | Train Acc: {train_acc * 100:.1f}% | Val Acc: {val_acc * 100:.1f}%"
        )

        if val_acc >= best_val_acc:
            best_val_acc = val_acc
            torch.save(
                {
                    "epoch": epoch,
                    "model_state_dict": model.state_dict(),
                    "val_acc": val_acc,
                    "vocabulary": VOCABULARY_CLASSES,
                },
                best_ckpt_path,
            )

    print(f"\n[+] Training complete! Best validation accuracy: {best_val_acc * 100:.2f}%")
    print(f"[+] Saved checkpoint to {best_ckpt_path}")
    return best_ckpt_path


if __name__ == "__main__":
    train_model()
