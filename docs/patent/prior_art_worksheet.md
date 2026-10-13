# Prior Art Search Worksheet

> **Document Type:** Patent Counsel Preparation Worksheet  
> **Search Scope:** Worldwide (USPTO, EPO, WIPO/PCT, Indian Patent Office IPO)  
> **Target Date:** October 2026  

---

## 1. Classification Codes to Search
- **G06F 3/017:** Gesture-based user interfaces
- **G06V 40/20:** Movements or active gestures of the human body (e.g. gesture recognition)
- **G06V 10/82:** Neural networks for image or video recognition
- **G10L 15/22:** Dialog systems, procedures used during a speech recognition process
- **G07F 17/00:** Coin-freed or kiosk apparatus for civic and commercial services

---

## 2. Search Query Strings
1. `("sign language" OR "gesture recognition") AND ("state machine" OR "dialog state") AND ("logit mask*" OR "vocabulary constraint")`
2. `("kiosk" OR "counter") AND ("sign language" OR "deaf") AND ("dual screen" OR "clerk") AND ("on-device" OR "privacy")`
3. `("hand landmark*" OR "mediapipe") AND ("BiGRU" OR "attention") AND ("confidence margin") AND ("service flow")`
4. `("Indian Sign Language" OR "ISL") AND ("kiosk") AND ("broadcastchannel" OR "local IPC")`

---

## 3. Prior Art Comparison Matrix

| Reference / Category | Typical Mechanism in Art | Shortcomings Addressed by SanketSetu | Differentiating Novelty in SanketSetu |
| :--- | :--- | :--- | :--- |
| **Generic Vision Sign Translators** (e.g. Google SignAll, AI4Bharat) | Unconstrained global vocabulary, cloud video processing, open-ended sentence generation. | High latency, cloud privacy/bandwidth concerns, frequent catastrophic false positives. | Ephemeral on-device landmarks (0 video bytes stored/sent), sub-2ms latency, dynamic state logit masking. |
| **Speech Dialogue Grammars** (e.g. Nuance, Dialogflow) | Acoustic phoneme decoding constrained by finite state grammars. | Designed solely for 1D audio phonemes, zero adaptation for 3D spatio-temporal kinetic landmarks. | Spatio-temporal kinetic landmark masking directly on GRU attention logits coupled with kinetic margin gating. |
| **Assistive Kiosks** (Standard Civic Terminals) | Touchscreen menus or rigid recorded audio prompts. | Completely inaccessible to signers unable to read complex regional legal texts or use audio. | Interactive ISL phrase recognition, dual-screen synchronized BroadcastChannel IPC, pictogram clerk speech transcription. |
| **On-Device Gesture Controls** (e.g. smart TVs, automotive) | Single static gesture trigger (swipe, pinch, thumbs up). | Fixed vocabulary of 5-10 navigational gestures; no service workflow or counter dialog progression. | Declarative multi-step service state machines with dynamic vocabulary swapping and zero-code domain retargeting. |

---

## 4. Counsel Action Items
- [ ] Run formal novelty clearance on WIPO PATENTSCOPE and Indian Patent Office (IPO) InPASS.
- [ ] Review differentiation of dynamic logit masking in neural sequence models vs traditional Viterbi path pruning in HMMs.
- [ ] Confirm patentable subject matter eligibility under Section 3(k) of the Indian Patents Act (computer software per se exception: highlight technical effect on hardware latency, memory footprint, and false-positive reduction).
