# RetentionEdit ⚡

> **Autonomous AI Video Editor** — From RAW Footage to Publish-Ready Video with Maximum Audience Retention.

**RetentionEdit** unifies:
1. **Open-Source Retention Skill (`retention.editing`)**: Ingestion, deterministic narrative analysis, filler cuts, and pacing cadence.
2. **Native RetentionVolt Engine**: Self-contained blueprint matching against reverse-engineered top creator videos (MrBeast, Hormozi, Ali Abdaal, MKBHD) without external Vercel network latency or timeout limits.
3. **Meta Muse Voice STT**: Speech-to-text with millisecond-accurate word timestamps and pause detection ($0.18/h).
4. **User-Configured GenAI Video Tier**:
   - **Eco (0$ GenAI)**: 100% HyperFrames code animations, vector lower-thirds, zero generative video cost.
   - **Balanced (Recommended)**: 1-2 strategic Higgsfield GenAI B-Roll clips for opening hook & core climax.
   - **Cinematic Pro**: Up to 4 GenAI B-Roll clips with dynamic DoP camera motions (pan, zoom, orbit).
5. **Modal.com Serverless GPU Worker**: Accelerated FFmpeg NVENC hardware rendering, HyperFrames compilation, and Frame-by-Frame Quality Gate verification.

---

## 🚀 Quickstart

### 1. Install Dependencies

```bash
cd retentionedit
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

### 3. Launch Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🛠 Modal.com GPU Worker Deployment

The serverless GPU worker is defined in `modal/app.py`:

```bash
cd modal
pip install -r requirements.txt
modal setup
modal deploy app.py
```

Copy the generated endpoint URL into `.env.local` as `MODAL_RENDER_ENDPOINT`.

---

## 📁 Project Architecture

```
retentionedit/
├── src/
│   ├── app/
│   │   ├── page.tsx               # Interactive Dashboard & Orchestrator
│   │   ├── layout.tsx             # Root Layout
│   │   ├── globals.css            # Dark Luxury Styling
│   │   └── api/
│   │       ├── upload/route.ts    # File Ingestion
│   │       └── pipeline/          # Start, Status polling & Result delivery
│   ├── components/
│   │   ├── app-shell.tsx          # Rebranded Navigation Shell
│   │   ├── brand.tsx              # RetentionEdit Logo
│   │   ├── uploader.tsx           # Drag & Drop Uploader (Format & Tier selector)
│   │   ├── pipeline-tracker.tsx   # Real-time Stage Progression & Terminal
│   │   ├── video-result-view.tsx  # Video Player, Cover & Deliverables Hub
│   │   └── retention-metrics.tsx  # Watch-Time Curve Prediction
│   └── lib/
│       ├── types.ts               # Complete Data Contracts
│       ├── retentionvolt-native.ts# Native Blueprint & Similarity Engine
│       ├── meta-muse.ts           # Meta Muse Voice STT Client
│       ├── narrative-analyzer.ts  # Hook & Silence/Filler Cut Candidate Analyzer
│       ├── genai-dispatcher.ts    # Higgsfield Camera Motion & B-Roll Router
│       ├── edit-planner.ts        # EditPlan v1.3 Builder
│       ├── modal-client.ts        # Modal GPU Dispatcher
│       └── pipeline-orchestrator.ts # Autonomous Pipeline Coordinator
└── modal/
    ├── app.py                     # Modal GPU NVENC Worker (Python)
    └── requirements.txt           # Container dependencies
```
