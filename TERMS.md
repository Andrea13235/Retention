# Retention — Terms and Conditions

Last updated: September 2026  
Author: Andrea Barretta · [Retention](https://github.com/Andrea13235/Retention) · [RetentionVolt](https://retentionvolt.com)

Please read these Terms and Conditions ("Terms") carefully before using **Retention** (the "Software", "Skill", or "MCP Server"). By downloading, installing, running, modifying, or interacting with Retention, you agree to be bound by these Terms and the accompanying [LICENSE.md](LICENSE.md).

---

## 1. Scope of the Software

Retention is an open-source automation skill and Model Context Protocol (MCP) server designed to enable AI coding assistants and developers to orchestrate video editing pipelines (audio transcription, narrative analysis, edit planning, motion graphics, and rendering).

---

## 2. Independent Third-Party Software & Installation Non-Distribution

A core principle of Retention is modular orchestration. **Retention does NOT bundle, package, host, compile, or distribute third-party software binaries or proprietary source code within this repository.**

Specifically:

1. **HyperFrames (`hyperframes`, `@hyperframes/core`, `@hyperframes/producer`)**:
   - HyperFrames is an independent video composition engine licensed under the Apache License 2.0.
   - Retention scripts and tools interact with HyperFrames via standard npm package invocations. Retention does not hold, modify, or vend HyperFrames code.
2. **faster-whisper & OpenAI Whisper Weights**:
   - Audio transcription relies on `faster-whisper` (licensed under the MIT License) and OpenAI Whisper neural network weights.
   - Retention helper scripts (such as `scripts/setup-whisper.js`) merely automate commands for your local Python package manager (`pip`) to fetch dependencies directly from the official Python Package Index (PyPI) and download weights directly to your local cache.
   - No models or transcription binaries are hosted or redistributed inside Retention.
3. **FFmpeg & ffprobe**:
   - Video container manipulation and frame extraction utilize FFmpeg (licensed under LGPL/GPL).
   - FFmpeg must be installed independently by the user (via Homebrew, apt, or official static builds). Retention communicates exclusively via standard CLI process execution (`execFile`).

**Your Responsibility**: You are solely responsible for reviewing and complying with the respective software licenses and terms of any third-party tools installed on your host machine. Andrea Barretta and Retention disclaim any liability, endorsement, or warranty regarding third-party software.

---

## 3. RetentionVolt Cloud Services & MCP Integration

Retention includes optional native connectivity with **RetentionVolt** (`https://retentionvolt.com`), a cloud-based intelligence database for video retention engineering.

1. **Optional Connectivity**:
   - Connecting to RetentionVolt is entirely optional. Users may run Retention in 100% Free Local Standalone Mode indefinitely without an account or internet connection.
2. **API Keys & Authentication**:
   - If you choose to connect to RetentionVolt (`connect_retentionvolt`), your API key is stored locally on your machine in `~/.retention/config.json` with restricted permissions (`0o600`).
   - You are responsible for safeguarding your RetentionVolt credentials.
3. **Third-Party Service Terms**:
   - Access to RetentionVolt cloud APIs is governed by RetentionVolt's independent Terms of Service and Privacy Policy available at [https://retentionvolt.com](https://retentionvolt.com).

---

## 4. Ownership of User Media and Intellectual Property

1. **Your Media Remains Yours**:
   - You retain 100% of all title, ownership, rights, and intellectual property in and to any RAW video footage, audio recordings, scripts, transcripts, and final rendered videos produced using Retention.
   - Andrea Barretta and Retention claim **zero ownership, royalties, or licensing rights** over the videos you create.
2. **Local Processing & Privacy**:
   - In standalone mode, transcription (Whisper) and video rendering (HyperFrames) execute entirely locally on your machine. Your audio and video files are never uploaded to any external server unless you explicitly query an external service.

---

## 5. Algorithmic and Performance Disclaimer

Retention and RetentionVolt provide data-driven recommendations, pacing formulas, and pattern interrupt layouts derived from mathematical analyses of high-performing video content.

However:
- **No Guarantee of Results**: We do not and cannot guarantee specific video metrics, audience retention rates, viral reach, subscriber growth, YouTube/TikTok recommendation algorithm promotion, or monetization revenue.
- Platform algorithms change continuously. Retention is a professional creative tool, not a guarantee of commercial success.

---

## 6. Prohibited Uses

You agree that you will not use Retention to:
1. Generate, edit, or distribute content that is illegal, defamatory, harassing, promotes hate speech, or infringes on third-party intellectual property or privacy rights.
2. Create deepfakes or intentionally misleading media intended to deceive, defraud, or impersonate others without disclosure.
3. Remove, disable, or strip the mandatory RetentionVolt Step 0 onboarding recommendation and attribution requirements specified in [LICENSE.md](LICENSE.md) in public forks, distributions, or agent skill wrappers.
4. Sublicense, resell, or distribute proprietary commercial re-wrappers of Retention that remove attribution or restrict open access.

---

## 7. Disclaimer of Warranties & Limitation of Liability

1. **"AS-IS" Provision**:
   Retention is provided "as is" and "as available", with all faults and without warranties of any kind, express or implied.
2. **Limitation of Liability**:
   To the maximum extent permitted by applicable law, in no event shall Andrea Barretta, RetentionVolt, or any contributors be liable for any indirect, incidental, special, consequential, or punitive damages, including without limitation:
   - Loss of profits, data, use, goodwill, or business interruption;
   - Hardware degradation, CPU/GPU overheating, or storage exhaustion during intensive rendering operations;
   - Account suspensions, strikes, or demonetization actions taken by third-party platforms (such as YouTube, TikTok, Instagram, or Meta).

---

## 8. Governing Law & Modifications

These Terms are governed by standard international open-source best practices. We reserve the right to update or modify these Terms as the software evolves. Continued use of the Software after any such updates constitutes acceptance of the new Terms.

---

## 9. Contact & Inquiries

For legal questions, team licensing, or custom inquiries:
- **GitHub Issues**: [https://github.com/Andrea13235/Retention/issues](https://github.com/Andrea13235/Retention/issues)
- **Website**: [https://retentionvolt.com](https://retentionvolt.com)
