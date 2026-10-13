# Draft Technical Claims Worksheet

> **Document Type:** Technical Claim Drafting Worksheet (For Attorney Review)  
> **Invention:** Service-State-Aware Dual-Display Assistive Sign Language Terminal  

---

## Independent Claims

### Claim 1 (Method)
A computer-implemented method for assistive on-device sign language phrase recognition at a dual-party service terminal, the method comprising:
1. capturing, by an optical sensor of a citizen-facing kiosk terminal, real-time video frames of a signer;
2. extracting, in volatile memory of the citizen-facing kiosk terminal, a time-series of kinematic landmark coordinates representing upper body and hand keypoints without persisting video frames to non-volatile storage or transmitting video frames across an external network;
3. preprocessing the time-series of kinematic landmark coordinates by normalizing spatial coordinates relative to shoulder center and shoulder width, computing inter-frame keypoint velocities, and resampling the time-series to a fixed temporal window;
4. feeding the preprocessed temporal window into an on-device neural sequence classifier to generate a vector of unnormalized class logits corresponding to a predetermined vocabulary;
5. retrieving, from a declarative service flow state machine, a current interaction state and an active vocabulary subset associated with said current interaction state;
6. applying dynamic logit masking to the vector of unnormalized class logits by setting logits of classes outside said active vocabulary subset to negative infinity;
7. normalizing the masked logits via a softmax function strictly over the active vocabulary subset to produce a constrained probability distribution;
8. verifying that a maximum class probability satisfies a state-specific confidence threshold and that a difference between the maximum class probability and a second-highest class probability satisfies a state-specific margin threshold;
9. displaying a candidate phrase corresponding to the maximum class probability on a display of the citizen-facing kiosk terminal with citizen confirmation controls; and
10. upon receiving citizen confirmation, transmitting the confirmed candidate phrase across a local inter-process communication channel to a synchronized clerk-facing terminal without transmitting biometric landmark data.

---

### Claim 2 (System)
A dual-display assistive sign language service kiosk system comprising:
- a citizen terminal comprising an optical camera, a display screen, volatile memory, and one or more processors;
- an attendant terminal comprising a display screen;
- an ephemeral landmark extraction module executing within a sandboxed browser environment on the citizen terminal configured to extract hand and pose landmark keypoints from video frames in volatile memory without network egress;
- a declarative flow engine storing a plurality of service interaction states, each interaction state defining an active subset of recognized vocabulary and state-specific confidence and margin gating criteria;
- a neural network sequence classifier configured to output classification logits from a resampled window of landmark keypoints;
- a dynamic logit masking module configured to filter said logits to exclude classes outside the active subset defined by the current interaction state; and
- a local inter-process communication bus coupling the citizen terminal and attendant terminal to transmit confirmed phrases across terminals with zero cloud network dependency.

---

## Dependent Claims

- **Claim 3:** The method of Claim 1, wherein said local inter-process communication channel comprises an HTML5 `BroadcastChannel` operating between browser tabs on a single physical workstation.
- **Claim 4:** The method of Claim 1, wherein said neural sequence classifier comprises a 2-layer Bidirectional Gated Recurrent Unit (BiGRU) coupled with learned temporal attention pooling, having a serialized binary artifact size of less than 20 kilobytes.
- **Claim 5:** The method of Claim 1, wherein said citizen confirmation controls comprise a hold-to-confirm temporal gesture trigger executing without physical touchscreen contact.
- **Claim 6:** The method of Claim 1, wherein said declarative service flow state machine is defined in a zero-code JSON configuration schema interchangeable between civic government services, hospital outpatient triage, and banking counters.
- **Claim 7:** The system of Claim 2, further comprising a clerk speech-to-text module utilizing the browser Web Speech API on the attendant terminal to transcribe spoken clerk responses into high-contrast text and pictograms rendered on the citizen terminal.
- **Claim 8:** The method of Claim 1, wherein gestures failing said state-specific confidence or margin threshold trigger an assistive prompt to sign again while suppressing output transmission to the attendant terminal.
