# RETENTIONVOLT — The Mobbin for Video Editing & Motion Design

A high-performance reference library and retention intelligence platform for video editors, YouTube creators, and AI video agents. 

Built with the **layout principles of [Mobbin](https://mobbin.com/discover/sites/latest)** and the **futuristic visual aesthetic of [Higgsfield AI](https://higgsfield.ai)** (deep dark neutrals, `#d1fe17` neon lime accents, glassmorphic panels, and glowing borders).

---

## ⚡ Key Departments & Features

### 1. 🎬 Discover Videos (Mobbin-Style Feed)
* **Real YouTube Video Embeds:** Fully responsive cards showcasing top creators (*MrBeast, Ali Abdaal, Vox / Johnny Harris, Marques Brownlee, Cleo Abram, 3Blue1Brown*).
* **Granular Filtering & Search:** Filter by Category (*Long-form 16:9, Shorts/Reels 9:16, Documentaries, Ads, Talking Head*), Niche (*Tech, Productivity, Finance, Entertainment*), and Pacing (*Hyper-Fast >25 CPM, Moderate 14-24 CPM, Cinematic <14 CPM*).
* **Interactive Cut Timeline Modal:**
  * Embedded YouTube player that seeks to exact cut seconds on click.
  * Interactive cut ribbon with color-coded markers (*Jump cut, Punch zoom, B-roll, Motion graphic, Audio riser*).
  * Metrics dashboard: **Cuts Per Minute (CPM)**, **Average Shot Length (ASL)**, **Words Per Minute (WPM)**, and **0-30s Hook CPM**.
  * AI-generated retention tactics and editing advice.

### 2. 🖼️ Thumbnails Intelligence Vault ("Reparto Miniature")
* Curated library of high-CTR thumbnails.
* Deep psychological analysis: Curiosity gap formula, rule-of-thirds composition, facial emotion detection (*Shock, Excitement, Curiosity, Serious*), and text density.
* 1-Click Generative AI Prompt copy for **Midjourney v6, FLUX, and DALL-E**.

### 3. 🌀 Motion Design Vault ("Reparto Motion Graphics")
* Reusable atomic motion design patterns based on verified creator references (`MG-001` through `MG-006`):
  * **MG-001:** Kinetic Word-Pop Hook (Apple / Ali Abdaal style)
  * **MG-002:** iOS-Style Timer Card & Proof Object
  * **MG-003:** Fake Player Mockup (Context frame)
  * **MG-004:** High-Impact Price/Stat Stamp (MrBeast style)
  * **MG-005:** Topographic Vector Path Sweep (Vox / Johnny Harris style)
  * **MG-006:** Paper Texture Whip Transition
* Live interactive animation previews, rebuild formulas, and copyable CSS/Tailwind code snippets.

### 4. 📊 AI Video Retention Audit ("Audit My Video")
* Paste any YouTube video link or title.
* Instant automated retention scorecard calculating pacing risks, silence gaps, and benchmark comparisons against top 1% creators.

### 5. 💳 Creator Pro Paywall & Pricing
* Annual / Monthly billing toggle ($12/mo annual or $16/mo monthly).
* Tier breakdown: **Starter ($0)**, **Creator Pro ($12/mo)**, and **Studio Team ($49/mo)**.
* Integrated simulated Stripe checkout flow with feedback states.

### 6. 🤖 Native Remote MCP Server (`/api/mcp`)
* Serves the Anthropic **Model Context Protocol** directly from Next.js Edge Functions.
* Exposes 4 agent tools:
  * `search_retention_patterns`: Search videos by creator or pacing.
  * `get_cut_cadence`: Retrieve exact cut timestamps and shot durations.
  * `get_thumbnail_inspiration`: Retrieve high-CTR composition patterns.
  * `get_motion_graphic_template`: Retrieve animation easings and CSS code.
* Built-in 1-click configuration for **Claude Code, Cursor IDE, and Antigravity**.

---

## 🛠️ Tech Stack & Color System

* **Framework:** Next.js 14 (App Router), React 18, TypeScript.
* **Styling:** Tailwind CSS with custom Higgsfield color palette:
  * Brand Neon Lime: `#d1fe17` (`rgba(209, 254, 23, ...)`)
  * Deep Background: `#08090a` / `#0f1013`
  * Card Surfaces: `#14161b` / `#1b1d24`
  * Electric Accents: Cyan (`#4df0ff`), Pink (`#ff005b`), Orange (`#ff7324`).
* **Icons:** Lucide React.
* **Deployment Target:** Vercel Edge Serverless (zero maintenance, scales to zero).

---

## 🚀 Getting Started

```bash
# Navigate to the project directory
cd "mcp reference video editing/design"

# Run development server
npm run dev

# Or build for production
npm run build
npm run start
```

Visit `http://localhost:3000` in your browser.

---

## 🔌 Connecting to Claude & Cursor via MCP

### In Claude Code CLI:
```bash
claude mcp add --transport http retentionvolt http://localhost:3000/api/mcp
```

### In Cursor (`settings.json`):
```json
{
  "mcpServers": {
    "retentionvolt": {
      "url": "http://localhost:3000/api/mcp",
      "headers": {
        "Authorization": "Bearer rv_live_<your-key-here>"
      }
    }
  }
}
```
