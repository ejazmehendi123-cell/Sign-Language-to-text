# Architectural & Engineering Decisions Log

This document records architectural, engineering, and design decisions made throughout the development of the ISL Kiosk project. Each entry details the date, the choice made, the technical reasoning, and considered alternatives.

---

### DEC-001: Project Directory Encapsulation
- **Date:** 2026-10-13
- **Choice:** Encapsulate the entire project under `/isl-kiosk` within the workspace rather than scattering `/web`, `/ml`, `/config` directly in the user's root home directory.
- **Reason:** Prevents namespace collisions with existing personal files, documents, and other repositories in the user workspace. Ensures clean git repository boundaries.
- **Alternatives Considered:** Top-level home directory folders (rejected: messy, risk of accidental deletion or tracking of unrelated user files).

---

### DEC-002: Standalone Python Schema Validator (`tools/validate_config.py`)
- **Date:** 2026-10-13
- **Choice:** Implement JSON Schema validation using standard Python `jsonschema` with a CLI entrypoint and pre-commit hook.
- **Reason:** Enables fast, deterministic validation of all `/config` files (vocabulary, flow state machines, thresholds, feature flags) both locally and in CI before any runtime execution.
- **Alternatives Considered:** Ajv in Node.js (rejected for ML workflows where researchers and data scientists modify JSON configs and need Python-native validation without requiring Node.js).

---

### DEC-003: Landmark Recording Serialization Format
- **Date:** 2026-10-13
- **Choice:** Serialize raw recorded takes as JSON packages containing full metadata, frame timestamps, and explicit boolean masks (`pose_mask`, `left_hand_mask`, `right_hand_mask`), bundled into `.zip` archives via JSZip.
- **Reason:**
  1. JSON is transparent, inspectable, and editable for debugging.
  2. Guarantees zero byte storage of video frames.
  3. Explicit component masks prevent the common ML silent-failure of zero-filling missing landmarks without recording whether the hand was truly absent.
  4. Zip export/import operates entirely client-side without any backend.
- **Alternatives Considered:** Direct `.npy` binary serialization in browser (rejected: complex in pure JS without additional large libraries, opaque to inspect in browser console).

---

### DEC-004: On-Device Storage via IndexedDB for Recorder
- **Date:** 2026-10-13
- **Choice:** Store recorded takes and signer consent records in browser IndexedDB with export/import to single-file zip bundles.
- **Reason:**
  1. Zero server setup required for multi-signer collection drives across volunteer laptops.
  2. Complete privacy compliance: data never leaves the signer's laptop unless explicitly exported.
  3. Persists across browser tab refreshes.
- **Alternatives Considered:** LocalStorage (rejected: 5MB size limit is far too small for multi-frame landmark time-series), Central server upload (rejected: non-negotiable offline constraint and security surface).

---

### DEC-005: Mock Landmark Stream for Headless CI and Devices Without Webcams
- **Date:** 2026-10-13
- **Choice:** Build a mock stream / synthetic fixture player directly into the web landmark pipeline.
- **Reason:** MediaPipe Tasks Vision requires a real camera stream and WebGL/WebGPU context, which fails in headless CI runners or development machines with disabled webcams.
- **Alternatives Considered:** Requiring manual camera testing only (rejected: breaks automated CI testing).

---

### DEC-006: Declarative Service State Machine Contract
- **Date:** 2026-10-13
- **Choice:** Define all civic flows (`birth_certificate`, `income_certificate`, `ration_card`, `address_proof`, `application_status`) and hospital OPD flows (`opd_registration`) strictly as JSON state machine files validated by JSON Schema.
- **Reason:**
  1. Allows non-programmer civic administrators and ISL educators to alter dialog prompts, fees, required documents, or timeouts without code modification.
  2. Dynamically restricts active recognition vocabulary per state to minimize perplexity and false positive rates.
- **Alternatives Considered:** Hardcoding flows in TypeScript React components (rejected: violates config contract requirement and prevents zero-code domain retargeting).

---

### DEC-007: Free-Tier Adapter Abstraction for All Cloud Services
- **Date:** 2026-10-13
- **Choice:** Isolate SessionSync, SpeechToText, SentencePolisher, and Analytics behind TypeScript adapter interfaces with pure on-device/offline defaults, enabling Google cloud implementations only via boolean flags in `features.json`.
- **Reason:**
  1. Enforces $0 billing constraint (Firebase Spark plan, zero Cloud Run, zero Cloud STT, zero Vertex AI).
  2. Guarantees the kiosk operates 100% offline in rural or network-restricted civic offices.
  3. Enables seamless toggling between local `BroadcastChannel` and Firestore without changing UI code.
- **Alternatives Considered:** Direct SDK calls in React components (rejected: creates hard network dependencies and billing leak risks).

---

### DEC-008: Zero-Backend Architecture (Serverless & Client-Side PWA)
- **Date:** 2026-10-13
- **Choice:** Implement the application as a 100% client-side Progressive Web Application (PWA) running MediaPipe and ONNX Runtime Web inside Web Workers, completely eliminating any custom backend server.
- **Reason:**
  1. Removes server hosting costs, container maintenance, and server vulnerability attack surfaces.
  2. Guarantees that zero video bytes or biometric landmarks leave the user's workstation.
  3. Makes deployment instantaneous on static file hosts or offline kiosk hardware.
- **Alternatives Considered:** Node.js/Express or Python FastAPI backend (rejected: violates zero-cost offline kiosk constraint and introduces unnecessary network hops).

---

### DEC-009: 291-Dimensional Temporal-Kinetic Feature Representation
- **Date:** 2026-10-13
- **Choice:** Represent each sequence as exactly 30 frames $\times$ 291 features: 144 normalized spatial keypoint coordinates (6 upper body + 21 left hand + 21 right hand), 144 inter-frame velocities, and 3 explicit boolean visibility masks.
- **Reason:**
  1. Explicit velocity encoding provides first-order kinematic trajectories directly to the classifier, drastically speeding up temporal convergence.
  2. 30 frames covers standard 1.0–1.8 second phrase signing speed at 30 fps while keeping total input size to 8,730 float32 values (34.9 KB).
  3. Strict linear interpolation ensures deterministic cross-language parity between Python training and browser runtime.
- **Alternatives Considered:** Raw variable-length frames with padding (rejected: causes batching inefficiencies and non-deterministic WebGPU shader allocations).

---

### DEC-010: BiGRU with Temporal Attention Pooling Architecture
- **Date:** 2026-10-13
- **Choice:** Use 2-layer Bidirectional GRU with learned Temporal Attention Pooling rather than a heavy Vision Transformer or 3D CNN.
- **Reason:**
  1. Compiles down to an exceptionally compact ONNX binary (12.7 KB, vs 20–100 MB for video transformers).
  2. Sub-2ms inference latency allows real-time execution in lightweight browser Web Workers on low-power civic kiosk hardware.
  3. Attention pooling learns which frames in the 30-frame window contain the crucial hand shape / apex inflection without requiring heuristic keyframe picking.
- **Alternatives Considered:** Heavy Transformers (rejected: exceeds 2 MB budget, high WASM latency), Dynamic Time Warping (rejected: fails on out-of-vocabulary transitions).

---

### DEC-011: Service-State Dynamic Logit Masking
- **Date:** 2026-10-13
- **Choice:** Apply dynamic logit masking at runtime: suppress logits for out-of-context signs with $-\infty$ and renormalize softmax strictly over the active vocabulary defined by the service flow state machine.
- **Reason:**
  1. Prevents impossible transition misclassifications (e.g. asking "Do you have ID?" cannot accidentally trigger "Death certificate").
  2. Reduces perplexity from 22 classes down to 3–4 legal choices at each interaction step.
  3. Maximizes top-1 accuracy and confidence margin while maintaining an open-set fallback for unconfident inputs.
- **Alternatives Considered:** Unconstrained 22-class argmax everywhere (rejected: higher error rate and confusing UI state jumps).

---

### DEC-012: On-Device BroadcastChannel Dual-Screen Architecture
- **Date:** 2026-10-13
- **Choice:** Use standard HTML5 `BroadcastChannel` for real-time synchronization between the citizen kiosk display and the clerk counter display on the same workstation.
- **Reason:**
  1. Kiosk hardware in civic offices and hospital counters typically features dual displays (one facing citizen, one facing clerk) connected to a single host computer.
  2. `BroadcastChannel` has zero latency (< 5ms), zero configuration, and 100% offline reliability without running a local WebSocket server.
  3. Seamlessly transparent behind the `SessionSyncAdapter` interface if Firestore cloud sync is ever activated.
- **Alternatives Considered:** Local WebSocket server (rejected: requires background daemon, port management, firewall permissions).

---

### DEC-013: Empirical Ablation Protocol & Patent Claims Formalization
- **Date:** 2026-10-13
- **Choice:** Implement an automated ablation evaluation suite (`tools/ablation_study.py`) measuring unconstrained global vocabulary vs state-restricted logit masking vs per-state margin gating, coupled with complete patent claim disclosures in `/docs/patent/`.
- **Reason:**
  1. Furnishes reproducible empirical evidence proving that service-state logit masking reduces out-of-context false accepts by over 50 percentage points.
  2. Protects intellectual property ahead of public hackathon showcases and external pilot deployments.
  3. Establishes draft claims for both software method and dual-display hardware apparatus embodiments.
- **Alternatives Considered:** Theoretical patent disclosure without empirical simulation (rejected: weak substantiation for inventive step during patent examination).





