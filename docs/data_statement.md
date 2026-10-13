# Data Statement

Following the framework of Bender & Friedman (2018), this document records the curation, demographics, and characteristics of the ISL Kiosk dataset.

## 1. Curation Rationale
The dataset is collected to support offline, real-time recognition of government service counter phrases in Indian Sign Language (ISL). Classes focus on key interactions at citizen counters (certificates, applications, identification, and clarification queries).

## 2. Language & Sign Validity
- **Language Variety:** Indian Sign Language (ISL).
- **Dialect / Regional Variation:** Primary focus on Northern and Western Indian standardized signs as documented by the Indian Sign Language Research and Training Centre (ISLRTC).
- **Verification Status:** All vocabulary items must be reviewed by deaf native signers or ISLRTC certified interpreters. Unverified items remain marked `verified: false`.

## 3. Data Collection Protocol
- **Consent:** Every signer signs a digital consent form explaining that only numerical coordinates are retained.
- **Recording Repetitions:** Target of 10 repetitions per sign across multiple sessions per signer.
- **Diversity Target:** Minimum 10 unique signers (balanced for handedness, gender, arm length, and signing speed) across diverse lighting conditions (bright indoor, dim indoor, natural window light, backlit) and camera angles.
- **Negative Class (`no_sign`):** Explicit collection of realistic idle and non-signing counter actions (standing still, checking phone, adjusting glasses, scratching head, arms crossed).
