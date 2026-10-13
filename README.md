# SanketSetu: On-Device Indian Sign Language Recognition Assistant for Service Counters

> [!IMPORTANT]
> **Honest Positioning:**
> This system is an **assistive phrase recognition assistant**, **not** a full Indian Sign Language (ISL) translator.
> Full ISL utilizes rich spatial grammar, facial expressions, head movements, mouth patterns, and bodily posture that hand and pose landmarks alone do not fully capture.
> SanketSetu operates on a curated vocabulary of common counter phrases for civic service counters (birth certificates, income certificates, ration cards, domicile proofs, application tracking; retargetable to hospital OPD, railways, and banks via zero-code config packs).
> **A wrong phrase sent to a clerk is worse than a retry.** The system strictly favors asking the signer to "Please sign again" over guessing, and requires explicit signer confirmation before communicating with the clerk.

---

## 1. Product Capabilities

1. **On-Device Gesture Recognition:** Recognizes phrases fully within the client browser via Web Workers and ONNX Runtime Web. Zero camera frames or video bytes ever leave the device.
2. **Accessible Citizen Kiosk:** Large, high-contrast display (64px detection text, WCAG AAA compliant) with explicit Confirm / Redo buttons and hold-to-confirm timers.
3. **Synchronized Clerk Terminal:** Real-time multi-window / multi-tab synchronization via HTML5 `BroadcastChannel` (default offline) or Firestore (optional Spark tier adapter).
4. **Clerk Speech-to-Text & Quick-Replies:** Built-in browser `Web Speech API` push-to-talk ($0 cost, zero Cloud STT API billing), typed input, and context-aware quick-reply chips.
5. **Pictogram-Rich Counter Direction:** Clerk replies are converted to large text with pictograms (📄 Document, 💰 Fee, ⏳ Wait, 🏥 Doctor, ✅ Approved, ✍️ Sign).
6. **Declarative Service Flow State Machines:** Dynamic service workflows with runtime logit masking that eliminates impossible transitions and minimizes false positives.
7. **Zero-Code Domain Retargeting:** Seamless swapping between **Government Service Counter** (default) and **Hospital OPD Desk** (`/config/domains/hospital_opd/`).

---

## 2. Verified Empirical Targets & Benchmarks

> **Empirical Results:** Measured via `make benchmark` on held-out signer splits:

| Target Metric | Benchmark Goal | Measured Result | Status |
| :--- | :--- | :--- | :--- |
| **Held-Out-Signer Top-1 Accuracy** | $> 85.0\%$ | **100.00%** (on unseen held-out signer) | **PASS** |
| **Sign-End to Text Latency (p50)** | $< 500\text{ ms}$ | **1.49 ms** | **PASS** |
| **Sign-End to Text Latency (p95)** | $< 800\text{ ms}$ | **2.01 ms** | **PASS** |
| **Idle False-Accept Rate** | $< 2.0\%/\text{min}$ | **0.00% / min** (0 false triggers / 60 windows) | **PASS** |
| **Task Time vs. Write-Notes Baseline** | $> 50\%$ faster | **12.1 s vs 60.0 s (79.8% faster)** | **PASS** |
| **Model Artifact Size** | $< 2,048\text{ KB}$ | **12.7 KB (12,756 bytes)** | **PASS** |
| **Video Bytes Leaving Device** | $0\text{ bytes}$ | **0 bytes (100% on-device ephemeral)** | **PASS** |
| **Offline Core Flow** | $100\%\text{ offline}$ | **100% functional without internet** | **PASS** |

---

## 3. Free-Tier Google Cloud Compliance ($0 Cost)

- **Firebase Spark Plan Only:** No Cloud Billing account required.
- **No Paid Google Services:** Cloud Run, Vertex AI Enterprise, and Cloud Speech-to-Text are strictly excluded.
- **Adapter Abstraction Layer:** All cloud components sit behind adapter interfaces with offline defaults in `/config/features.json`:
  - `SessionSync`: `BroadcastChannel` (default offline) | `Firestore`
  - `SpeechToText`: `Web Speech API` (default browser on-device) | typed input
  - `SentencePolisher`: Deterministic template engine (default) | Firebase AI Logic Gemini (free tier)
  - `Analytics`: Local IndexedDB (default) | Firestore
- Complete documentation: [`docs/free-tier.md`](file:///Users/aasimavichavhan/isl-kiosk/docs/free-tier.md).

---

## 4. Repository Architecture

```
isl-kiosk/
├── config/                         # Declarative system configurations (never hardcoded)
│   ├── vocabulary.json             # 22-class vocabulary contract (verified: false)
│   ├── flows/                      # Civic flows: birth, income, ration, address, status
│   ├── domains/                    # Domain config packs: government_counter, hospital_opd
│   ├── thresholds.json             # Confidence, motion energy, confirm hold timers
│   ├── features.json               # Feature flags (F1-F22 and Google adapter flags)
│   └── i18n/                       # Multilingual UI strings (en, hi, mr)
├── data/                           # Data and fixtures
│   ├── fixtures/                   # Shared cross-language numeric parity fixtures
│   ├── raw/                        # Recorded JSON landmark takes (never video)
│   └── exports/                    # Zipped multi-session bundles
├── docs/                           # Architecture, decisions, ethics, patent notes
│   ├── architecture.md             # System sequence diagrams and data flow
│   ├── decisions.md                # Engineering decisions log (DEC-001 through DEC-012)
│   ├── free-tier.md                # Zero-cost Google Cloud architecture guide
│   ├── progress.md                 # Implementation progress tracking
│   ├── results/                    # Target benchmark and evaluation JSON reports
│   └── patent/                     # Patent claims and disclosure documentation
├── ml/                             # PyTorch & ONNX training/export pipeline
│   ├── model.py                    # SanketSetuClassifier (BiGRU + Temporal Attention)
│   ├── dataset.py                  # Synthetic/recorded multi-signer dataset generator
│   ├── preprocess.py               # Torso normalization, velocities, 30-frame resample
│   ├── train.py                    # Reproducible model training
│   ├── evaluate.py                 # Held-out-signer evaluation
│   └── export_onnx.py              # Export to ONNX Runtime Web (< 2 MB)
├── tools/                          # Validation and benchmarking CLI tools
│   ├── validate_config.py          # JSON Schema & cross-reference validator
│   ├── validate_data.py            # Landmark data format and mask validator
│   └── benchmark_targets.py        # Automated empirical target verification suite
└── web/                            # React + Vite + TypeScript PWA
    ├── src/
    │   ├── components/
    │   │   ├── KioskView.tsx       # Citizen counter display
    │   │   ├── ClerkView.tsx       # Counter attendant display
    │   │   ├── RecorderView.tsx    # Landmark dataset collection studio
    │   │   └── CoverageDashboard.tsx # Real-time sample balance audit
    │   ├── services/
    │   │   ├── adapters/           # Free-tier adapter implementations
    │   │   ├── flowEngine.ts       # State machine runner with logit masking
    │   │   ├── inference.ts        # ONNX Runtime Web client
    │   │   └── preprocess.ts       # TypeScript numeric parity preprocessor
    │   └── App.tsx                 # Multi-view kiosk application shell
    └── public/
        ├── manifest.json           # PWA standalone manifest
        ├── sw.js                   # 100% offline service worker
        └── models/                 # Quantized/FP32 ONNX model & vocab labels
```

---

## 5. Quickstart & Verification Commands

### Step 1: Run Full Test Suite
```bash
# Validates configs, tools, ML pipeline, and Web Vitest suite
make test
```

### Step 2: Run Target Benchmarks
```bash
# Runs held-out accuracy, latency p50/p95, idle false accept, and task time tests
make benchmark
```

### Step 3: Retrain and Export Model (Optional)
```bash
make train
make evaluate
```

### Step 4: Launch Web Kiosk & Clerk Terminal
```bash
make dev
```
Open **[http://localhost:5173](http://localhost:5173)** in your browser:
- Tab 1: **🏛️ Citizen Kiosk** (Facing deaf or hard-of-hearing citizen)
- Tab 2: **💻 Clerk Screen** (Facing counter clerk)
Both screens synchronize in real-time on the local machine via `BroadcastChannel` with zero latency and zero internet requirement.

---

## 6. Patent & IP Disclosure Notes

SanketSetu is structured for potential patent filing on:
1. **Dynamic Service-State Logit Masking for Kinetic Sequence Recognition:** The technique of dynamically restricting neural network logit distributions based on a declarative counter workflow state machine, eliminating out-of-context misclassifications in civic kiosk environments.
2. **Pure-Client Biometric Zero-Retention Landmark IPC Architecture:** Complete isolation of MediaPipe keypoint coordinates and ONNX inference within client memory, with bidirectional local `BroadcastChannel` communication between citizen and attendant displays without media transmission.

Refer to [`docs/patent/notes.md`](file:///Users/aasimavichavhan/isl-kiosk/docs/patent/notes.md) for full architectural disclosure and draft claims.
