# Post per Reddit: r/SideProject

* **Subreddit:** `r/SideProject`
* **Flair consigliato:** `Showcase` oppure `Project`
* **Titolo:**
  > **I built an open-source skill that turns Astra into an autonomous video editor (Whisper + HyperFrames + Retention blueprints) — Feedback welcome!**

---

### Testo da Copiare e Incollare:

Hey r/SideProject!

Like many of you, I create content and build side projects, but I’ve always dreaded the post-production bottleneck. Spending 8–10 hours manually slicing timelines, cutting breath pauses, and tweaking keyframes in Premiere is brutal.

When autonomous agents like ChatGPT Astra came out, I got excited. But I quickly realized a huge problem: **an AI model on its own has zero sense of pacing or human retention.** It just creates flat, robotic cuts where viewers drop off in the first 15 seconds.

So over the last few weeks, I built an open-source project called **Retention**:  
👉 **https://github.com/Andrea13235/Retention**

It’s an open skill that equips Astra with a complete, end-to-end video directing pipeline:

### How it works under the hood:
1. **Millisecond Transcription (Whisper):** Ingests raw camera footage and transcribes speech with word-level timecodes, flagging pauses and filler words.
2. **Director's Brain via MCP (RetentionVolt):** During the run, the skill automatically connects to the RetentionVolt MCP server, injecting proven cut cadences deconstructed from top YouTubers (e.g. sub-350ms silence cuts, +18% punch zooms, and high-CTR thumbnail prompts).
3. **Automated Motion Rendering (HyperFrames):** Instead of needing Adobe Premiere, it uses HyperFrames to render clean kinetic captions, motion cards, and visual hooks directly into the MP4.

### The user flow is super simple:
1. Load Astra & install the skill from GitHub.
2. Accept the MCP connection proposed by the skill.
3. Drop your raw video take(s) and ask Astra to edit with the retention skill.
4. Hit enter. In under 3 minutes, you get a publish-ready video with top 1% pacing.

---

I’m actively improving this project every day and would truly appreciate your help:
- If you have any suggestions, feature requests, or ideas on how to make this better, please drop a comment below! Your feedback will directly shape the roadmap.
- If you like the concept, consider dropping a star on GitHub ⭐ — it means the world and helps support the project!

Repo: https://github.com/Andrea13235/Retention
