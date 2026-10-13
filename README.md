# ISL Kiosk: On-Device Indian Sign Language Recognition for Government Service Counters

> **Honest Positioning:**
> This system is an **assistive phrase recognition kiosk**, **not** a full Indian Sign Language (ISL) translator.
> Full ISL utilizes rich spatial grammar, facial expressions, head movements, mouth patterns, and bodily posture that hand and pose landmarks alone do not fully capture.
> The system operates on a curated vocabulary of high-frequency counter phrases for government services (certificates, ration, Aadhaar, tax, address proof).
> **A wrong phrase sent to a clerk is worse than a retry.** The system strictly favors asking the signer to "Please sign again" over hazardous misclassifications, and requires explicit signer confirmation before communicating with the clerk.

---

## 1. Core Principles & Guarantees

- **100% On-Device & Zero Video Leaving Device:** Recognition runs entirely inside the client browser using Web Workers and local landmark extractors. No camera frames or video bytes ever touch a network socket or server disk.
- **Offline First:** The full recognition pipeline, state machine flow engine, confirmation UI, local clerk view (via `BroadcastChannel`), and template sentence generator function without internet connectivity.
- **Signer Respect & Community Integrity:** Unverified vocabulary entries are strictly flagged as `verified: false`. Signs are validated only against official ISLRTC standards in consultation with deaf community members.
- **Held-Out Signer Honesty:** All reported ML metrics are evaluated on unseen signers (leave-one-signer-out or disjoint signer splits).

---

## 2. Repository Layout

```
isl-kiosk/
├── config/             # Declarative system configurations (Never hardcoded)
│   ├── vocabulary.schema.json
│   ├── vocabulary.json
│   ├── flow.schema.json
│   ├── flows/          # Service state machines (birth, income, etc.)
│   ├── thresholds.schema.json
│   ├── thresholds.json
│   ├── features.json   # Feature flags (F1 through F22)
│   └── i18n/           # Localized strings (en, hi, mr)
├── data/               # Landmark datasets (Git-ignored large files)
│   ├── raw/            # Raw JSON landmark takes
│   ├── splits/         # Signer-stratified splits
│   └── exports/        # Zipped multi-session archives
├── docs/               # Architecture, decisions, ethics, patents
│   ├── architecture.md
│   ├── decisions.md
│   ├── privacy.md
│   ├── data_statement.md
│   ├── validation_protocol.md
│   └── patent/
├── ml/                 # PyTorch/Keras training & ONNX export pipeline
├── tests/              # E2E & cross-cutting integration tests
├── tools/              # Data recorder validation & schema checkers
│   ├── validate_config.py
│   └── validate_data.py
└── web/                # React + Vite + TypeScript PWA (Kiosk, Clerk, Recorder)
```

---

## 3. Quick Start

### Prerequisites
- Node.js >= 18 (Tested on v20+)
- Python >= 3.10 (Tested on 3.11 / 3.13)
- Modern browser with WebGL/WebGPU and webcam access

### Setup and Validation
```bash
# Clone and enter directory
cd isl-kiosk

# Validate all configuration schemas
python3 tools/validate_config.py

# Run tool unit tests
pytest tools/ -v

# Install web dependencies
cd web
npm install

# Run web test suite
npm run test

# Launch local development server (includes Recorder & Kiosk)
npm run dev
```

Visit `http://localhost:5173` to access the application.
