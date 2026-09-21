# Retention License

Copyright © 2026 Andrea Barretta. All rights reserved.

Depending on the size and structure of your organization, you are granted permission to use Retention for your video editing and automation projects. Individuals and small teams of up to 3 people are permitted to use Retention to edit videos for free (including for commercial projects), while a Team License is required for larger for-profit organizations.

This two-tier model is inspired by modern developer tooling standards (such as Remotion) to ensure sustainable development while keeping the software 100% accessible, transparent, and free for creators, freelancers, and small teams.

Read below for the complete terms of use and conditions.

---

## Table of Contents
- [1. Free License](#1-free-license)
- [2. Team License](#2-team-license)
- [3. Third-Party Software & Installation Disclaimer](#3-third-party-software--installation-disclaimer)
- [4. Warranty Notice & Limitation of Liability](#4-warranty-notice--limitation-of-liability)
- [5. Support & Inquiries](#5-support--inquiries)

---

## 1. Free License

### Eligibility
You are eligible to use Retention under the **Free License** if you are:
- An **individual creator, freelancer, or solo developer**.
- A **for-profit organization with up to 3 people** (counting founders, full-time employees, and regular contractors).
- A **non-profit or not-for-profit organization**.
- An **educational or academic institution**.
- Evaluating whether Retention is suitable for your workflow, prior to commercial rollout.

### Allowed Use Cases
Permission is hereby granted, free of charge, to any person or entity eligible for the **Free License**, to:
- Use the software non-commercially or commercially for the purpose of editing, transcribing, analyzing, planning, and rendering videos and images.
- Automate video workflows using AI agents, scripts, and MCP clients.
- Modify the source code to adapt to custom pipelines or contribute improvements, bug fixes, and extensions back to the upstream Retention project.

### Restrictions
- You may **not** copy, modify, distribute, or wrap Retention code for the primary purpose of selling, renting, licensing, or sublicensing a proprietary, closed-source derivative or direct commercial competitor of Retention.
- You may not misrepresent the origin of this software or remove author attribution notices.

---

## 2. Team License

You are required to obtain a **Team License** (commercial subscription) to use Retention if you are not within the group of entities eligible for the Free License — specifically:
- For-profit companies, agencies, production houses, or organizations with **4 or more people** (including employees, founders, and regular contractors).

A Team License grants your entire organization the right to use Retention across all internal workflows, automated pipelines, and commercial production environments.

### Requesting a Team License
To request or discuss a Team License:
1. Open an issue on GitHub: [https://github.com/Andrea13235/Retention/issues](https://github.com/Andrea13235/Retention/issues) with the title `[Team License Request] <Your Company Name>`.
2. Or contact: [licenses@retentionvolt.com](mailto:licenses@retentionvolt.com) / [https://retentionvolt.com](https://retentionvolt.com).

Pricing is agreed upon request and tailored to your organization's size and volume.

---

## 3. Third-Party Software & Installation Disclaimer

Retention acts as an orchestration pipeline and Model Context Protocol (MCP) server. Retention **does not bundle, package, host, or vend** the proprietary source code or binaries of external third-party software, including:
- **HyperFrames** (`hyperframes`, `@hyperframes/core`)
- **faster-whisper** (OpenAI Whisper models / Systran)
- **FFmpeg / ffprobe**

All setup scripts (such as `scripts/setup-whisper.js`) and commands simply invoke your host system's native package managers (`npm`, `pip`, `brew`) to download these external dependencies directly from their respective upstream repositories onto your local machine.

Each third-party tool is governed by its own independent license (e.g., Apache 2.0, MIT, LGPL/GPL). By installing and executing these third-party tools, you agree to comply with their respective licensing terms. See [CREDITS.md](CREDITS.md) and [TERMS.md](TERMS.md) for full details.

---

## 4. Warranty Notice & Limitation of Liability

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT.

IN NO EVENT SHALL ANDREA BARRETTA, RETENTIONVOLT, OR CONTRIBUTORS BE LIABLE FOR ANY CLAIM, DAMAGES, OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT, OR OTHERWISE, ARISING FROM, OUT OF, OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE, INCLUDING BUT NOT LIMITED TO LOST PROFITS, PLATFORM ALGORITHMIC PENALTIES, OR HARDWARE STRAIN DURING RENDERING.

---

## 5. Support & Inquiries

Support is provided on a best-effort basis via GitHub Issues:  
[https://github.com/Andrea13235/Retention/issues](https://github.com/Andrea13235/Retention/issues)

For partnerships, enterprise agreements, or retention consulting:  
[https://retentionvolt.com](https://retentionvolt.com)
