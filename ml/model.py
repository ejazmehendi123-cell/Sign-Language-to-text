"""
SanketSetu PyTorch Model Architecture
Lightweight Spatial-Kinetic 1D Projection + Bidirectional GRU + Temporal Attention
Parameters: ~200K (<800 KB FP32, well under 2 MB limit)
Inference latency: < 10ms on CPU / Web Worker
"""

import torch
import torch.nn as nn
import torch.nn.functional as F

NUM_CLASSES = 22
INPUT_DIM = 291
SEQ_LEN = 30


class TemporalAttention(nn.Module):
    def __init__(self, hidden_dim: int):
        super().__init__()
        self.fc = nn.Linear(hidden_dim, 1, bias=False)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: (batch, seq_len, hidden_dim)
        scores = self.fc(x)  # (batch, seq_len, 1)
        weights = F.softmax(scores, dim=1)  # (batch, seq_len, 1)
        context = torch.sum(weights * x, dim=1)  # (batch, hidden_dim)
        return context


class SanketSetuClassifier(nn.Module):
    def __init__(
        self,
        input_dim: int = INPUT_DIM,
        num_classes: int = NUM_CLASSES,
        proj_dim: int = 128,
        hidden_dim: int = 64,
        num_layers: int = 2,
        dropout: float = 0.25,
    ):
        super().__init__()
        self.input_dim = input_dim
        self.num_classes = num_classes

        # Spatial-kinetic feature projection
        self.proj = nn.Sequential(
            nn.Linear(input_dim, proj_dim),
            nn.LayerNorm(proj_dim),
            nn.GELU(),
            nn.Dropout(dropout),
        )

        # Bidirectional Recurrent Sequence Modeling
        self.gru = nn.GRU(
            input_size=proj_dim,
            hidden_size=hidden_dim,
            num_layers=num_layers,
            batch_first=True,
            bidirectional=True,
            dropout=dropout if num_layers > 1 else 0.0,
        )

        gru_out_dim = hidden_dim * 2  # Bidirectional

        # Temporal Attention Pooling
        self.attention = TemporalAttention(gru_out_dim)

        # Classification Head
        self.classifier = nn.Sequential(
            nn.Linear(gru_out_dim, 64),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(64, num_classes),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        x: (batch_size, 30, 291)
        returns: (batch_size, 22) logits
        """
        proj_features = self.proj(x)  # (batch, 30, 128)
        gru_out, _ = self.gru(proj_features)  # (batch, 30, 128)
        pooled = self.attention(gru_out)  # (batch, 128)
        logits = self.classifier(pooled)  # (batch, 22)
        return logits
