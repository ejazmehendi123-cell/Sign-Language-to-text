# SanketSetu Free-Tier Google Architecture Guide

> **Zero-Cost Hard Constraint:** SanketSetu runs entirely at $0 cost on the **Firebase Spark Plan** with zero Cloud Billing account linkage. Under no circumstances should Cloud Run, paid Cloud Speech-to-Text, Vertex AI Enterprise, or paid GPU clusters be provisioned.

---

## 1. Inventory of Services & Free-Tier Conditions

| Service Component | Implementation / Adapter | Free-Tier Condition & Quota | Fallback / Default Offline Adapter |
| :--- | :--- | :--- | :--- |
| **Kiosk & Clerk Sync** | Firebase Firestore + Anonymous Auth | Spark Plan: 50,000 reads/day, 20,000 writes/day, 1 GiB storage, 10 GiB egress/month. Tested exclusively via **Firebase Emulator Suite** during development. | **`BroadcastChannel` Adapter**: 100% offline IPC between browser tabs on same device. Zero network usage. |
| **Clerk Speech-to-Text** | Web Speech API (`webkitSpeechRecognition`) | Built-in browser API (Chrome/Edge). Free and on-device/browser managed. No Cloud Speech API calls. | **Typed Input & Quick-Reply Chips**: Zero external dependency, instantaneous touch/keyboard input. |
| **Sign Sequence Polisher** | Firebase AI Logic (Gemini 1.5 Flash Free Tier via Firebase SDK) | Free quota: 15 RPM, 1,500 RPD on Google AI Studio / Firebase free tier. Strictly optional, behind `adapter_sentence_polisher` flag. **Strict Guardrails:** Output capped to 120 chars, vocabulary strictly validated against verified ISL gloss tokens; zero PII sent. | **Deterministic Template Engine**: Instantaneous string interpolation for English, Hindi, and Marathi (`f4_template_sentence_engine`). |
| **ML Model Training** | Local CPU / Google Colab (Free T4/CPU runtime) | Zero cost. Training takes < 60 seconds on CPU using lightweight sequence models. | Local training script (`ml/train.py`) and reproducible notebook (`ml/train_colab.ipynb`). |
| **Inference Runtime** | ONNX Runtime Web + WebGPU / WASM | Runs 100% on-device inside client browser Web Worker. Zero cloud inference, zero server cost. | WebAssembly (WASM) multi-threaded SIMD fallback for browsers lacking WebGPU. |
| **Telemetry & Metrics** | Local IndexedDB | Spark Plan Firestore: aggregated anonymized error rate only if flag enabled. | **Local IndexedDB**: 100% on-device session storage and zero cloud leakage. |

---

## 2. Hard Anti-Billing Guardrails

1. **No Cloud Billing Linkage:** The Firebase project is strictly on the default **Spark** tier. Never link a credit card or billing account.
2. **Localhost & Emulator First:** All Firestore sync tests run against the Firebase Local Emulator (`firebase emulators:start --only firestore,auth`).
3. **No Cloud Video Streaming:** Webcam frames never leave the device memory; landmark coordinates are extracted frame-by-frame and ephemerally processed.
4. **Adapter Boundary Contract:** All services implement the TypeScript interface patterns defined in `web/src/services/adapters/`. If any cloud adapter is disabled in `config/features.json`, the offline implementation executes with zero network attempts.

---

## 3. Reminder to Verify Current Quotas

> [!WARNING]
> Google Firebase Spark and AI Studio quotas are subject to periodic platform policy adjustments. Always verify active limits at [firebase.google.com/pricing](https://firebase.google.com/pricing) and [ai.google.dev/pricing](https://ai.google.dev/pricing) prior to public counter deployment.
