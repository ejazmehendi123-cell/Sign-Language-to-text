# Patent Disclosure Notes & Prior-Art Tracking

> **Disclaimer:** This document is technical engineering documentation to assist patent counsel and does not constitute formal legal advice.

---

## 1. Core Inventive Concept
**Method and System for Service-State-Aware Dynamic Vocabulary Masking and Margin Gating in Sign Language Interaction Kiosks**

### Key Differentiating Mechanisms:
1. **Dynamic Logit Masking Bound to Service State Machines:**
   - Traditional sign language recognition treats every frame against the full global dictionary $\mathcal{V}$ ($|\mathcal{V}| = N$).
   - The inventive system couples a deterministic, declarative dialog state machine with the ML inference layer.
   - For a given dialog state $S_k$, the allowed active vocabulary subset $\mathcal{V}_{S_k} \subset \mathcal{V}$ dynamically filters logits prior to softmax normalization:
     $$P(y = c \mid \mathbf{x}, S_k) = \frac{\exp(z_c)}{\sum_{j \in \mathcal{V}_{S_k}} \exp(z_j)} \quad \text{for } c \in \mathcal{V}_{S_k}$$
   - This eliminates out-of-context misclassifications and drastically reduces false positive rates.

2. **State-Adaptive Margin and Energy Gating:**
   - Instead of a single static global confidence threshold, each state defines its own $(\tau_{conf}, \tau_{margin})$ based on the criticality of the step (e.g., fee payment verification demands higher margin than a generic query).

3. **Multi-Modal Signer Confirmation Loop:**
   - Mandatory on-device confirmation before transmission across the local boundary (via BroadcastChannel) to the clerk terminal.

---

## 2. Prior-Art Search Worksheet
- **Keywords:** Sign language kiosk, landmark recognition, state machine vocabulary restriction, dynamic logit masking, gesture dialog system.
- **Databases to Query:** Google Patents, USPTO, EPO, WIPO, Indian Patent Office (IPO).
- **Provisional Filing Pre-requisites:**
  - File provisional specification prior to any public demo or open-source release.
  - Retain ablation data proving accuracy and error-reduction improvements under state-aware masking.
