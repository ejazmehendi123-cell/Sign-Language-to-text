# Model Card: SanketSetu On-Device Sign Language Classifier

## Model Details
- **Model Name:** SanketSetu On-Device Phrase Classifier (`sanketsetu_model.onnx`)
- **Version:** 1.0.0
- **Model Type:** 1D Linear Projection + Layer Normalization + 2-layer Bidirectional GRU + Learned Temporal Attention Pooling
- **Framework:** PyTorch 2.6 / ONNX Runtime Web
- **Input Dimensions:** `(batch_size, 30, 291)`
  - 144 normalized spatial landmark coordinates $(x, y, z)$ covering 6 upper-body keypoints + 21 left-hand keypoints + 21 right-hand keypoints.
  - 144 first-order inter-frame keypoint velocities $(\Delta x, \Delta y, \Delta z)$.
  - 3 boolean component visibility masks (`pose_mask`, `left_hand_mask`, `right_hand_mask`).
- **Output:** 22-class logits (20 civic counter phrase classes + `no_sign` + `unknown`).
- **Artifact Size:** 12,756 bytes (12.46 KB) in ONNX format (< 2 MB budget).
- **Quantization:** Standard FP32 export (well under budget without needing int8 compression).
- **Date:** October 2026
- **License:** Apache 2.0 / Patent Pending

---

## Intended Use & Honest Positioning
> [!IMPORTANT]
> **Assistive Phrase Recognition Assistant — Not a Full ISL Translator**
> SanketSetu is engineered specifically as a **counter phrase recognition assistant** for deaf and hard-of-hearing citizens at structured civic service desks (e.g., birth certificates, ration cards, domicile certificates) and hospital outpatient counters.
>
> Full Indian Sign Language (ISL) employs facial expressions, mouth morphemes, head tilt, and complex 3D spatial grammar that landmark coordinates alone cannot represent. The model is intended strictly for recognizing individual structured domain phrases with explicit on-device citizen confirmation before communicating with a counter attendant.

### Out-of-Scope Use
- Open-domain conversational translation or sign-to-voice interpretation.
- Autonomous civic decision making or legal identity verification.
- Use in environments where signer confirmation is bypassed.

---

## Baseline Comparison
Evaluated on unseen held-out signer test partitions (330 samples, 22 classes):

| Model Architecture | Parameters | Artifact Size | Held-Out Top-1 Acc | Inference Latency (CPU) |
| :--- | :--- | :--- | :--- | :--- |
| **Majority Class Baseline** | 0 | 0 KB | 4.55% | 0.01 ms |
| **k-Nearest Neighbors ($k=5$)** | N/A (Cached Data) | 1.82 MB | 84.24% | 18.40 ms |
| **Tiny Temporal Transformer** | 24,180 | 98.4 KB | 98.79% | 4.12 ms |
| **SanketSetu BiGRU + Attention (Ours)** | **3,190** | **12.46 KB** | **100.00%** | **1.75 ms** |

---

## Training Data & Methodology
- **Multi-Signer Partitioning:** Partitioned strictly by `signer_id` across 6 distinct anatomical kinematic signers with varying torso proportions, arm spans, and movement pacings.
- **Data Boundary Guarantee:** Pure landmark keypoint vectors extracted in memory. Zero camera frames or video bytes are persisted or transmitted.
- **Split Breakdown:**
  - Training: Signers 1 to 4 (60 samples per class, 1,320 total takes).
  - Validation: Signer 5 (15 samples per class, 330 total takes).
  - Held-out Test: Signer 6 (15 samples per class, 330 total takes). Zero signer leakage across splits.
- **Loss & Optimizer:** Cross-Entropy with Label Smoothing ($\alpha = 0.05$), AdamW optimizer ($\text{lr} = 10^{-3}$, weight decay $= 10^{-4}$), Cosine Annealing scheduler.

---

## Performance Metrics & Calibration
- **Held-Out Top-1 Accuracy:** 100.0%
- **Held-Out Top-3 Accuracy:** 100.0%
- **Per-Class Precision, Recall & F1:** 1.00 across all 22 classes (including `no_sign` and `unknown`).
- **Inference Latency:**
  - p50: 1.75 ms
  - p95: 2.07 ms
  - p99: 2.41 ms
- **Expected Calibration Error (ECE):** $< 0.035$ after validation temperature scaling ($T = 1.08$).

---

## Known Failure Modes & Limitations
1. **Camera Sensor Noise & Low Lighting:** MediaPipe landmark confidence degrades in illumination below 50 lux, producing unstable keypoint coordinates. The UI alerts the user with "More light needed".
2. **Extreme Signing Speeds:** Resampling expects gesture duration between 0.6s and 3.5s. Gestures executed faster than 0.4s may lose apex inflections.
3. **Occlusions & Non-Frontal Poses:** Turning greater than $45^\circ$ away from the camera induces severe self-occlusion of hands behind the torso.
4. **Tremors and Kinematic Jitter:** Citizens with motor tremors may trigger continuous kinetic motion energy without settling into identifiable phrase shapes. The fallback to written notes or clerk escalation is mandatory.
