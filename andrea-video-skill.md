# Andrea Video Skill — AI Video Editing con HyperFrames + Whisper

## 1. Obiettivo del progetto

Creare una **skill AI open-source** per il montaggio video automatico, pubblicata su GitHub, installabile da Codex / Claude Code / altri agenti compatibili MCP.

L'utente carica i propri video RAW e la skill:

1. Trascrive l'audio con timecode (Whisper, locale).
2. Analizza la struttura narrativa (hook, sezioni, cali di attenzione, momenti forti).
3. Genera un **Action Plan** dettagliato (tagli, animazioni, testi overlay, b-roll, pattern-interrupt per mantenere alta l'attenzione dello spettatore).
4. Applica automaticamente l'Action Plan usando **HyperFrames** per produrre un video finale (MP4) pronto alla pubblicazione.

Nessun software NLE esterno richiesto (no DaVinci, no Premiere): tutta la pipeline gira in locale con Node.js, Python (opzionale), FFmpeg, Whisper e HyperFrames.

## 2. Perché HyperFrames

- Framework open-source (Apache License 2.0) per generare video da HTML/CSS/JS via headless Chrome + FFmpeg.
- Pensato nativamente per essere pilotato da agenti AI (skill già pronte per Claude Code, Codex, Cursor).
- Supporta rendering fino a 4K e HDR10, con preset di qualità configurabili (draft / standard / high, CRF 28-15).
- Nessuna dipendenza da software NLE con licenza a pagamento: solo Node.js, FFmpeg, e il package HyperFrames stesso.
- Licenza Apache 2.0: uso commerciale, distribuzione e modifica sono permessi, unico obbligo è preservare copyright/licenza originali (nessuna restrizione sul nostro modello di business).

## 3. Architettura generale

```
Utente
  │
  │ 1. "Ecco i miei RAW, montami un video da 10 minuti stile YouTube"
  ▼
LLM / Agente (Codex, Claude Code, Astra, ecc.)
  │
  │ 2. Carica la skill "andrea-video-skill"
  ▼
┌─────────────────────────────────────────────┐
│           ANDREA VIDEO SKILL (nostro repo)    │
│                                               │
│  SKILL.md          → istruzioni per il modello│
│  mcp-server/        → server MCP (Node.js/TS) │
│    ├─ tools_ingest.ts   → import RAW          │
│    ├─ tools_transcribe.ts → trascrizione (Whisper)│
│    ├─ tools_analyze.ts  → analisi narrativa    │
│    ├─ tools_plan.ts     → genera Action Plan   │
│    └─ tools_render.ts   → chiama HyperFrames   │
│                                               │
│  package.json                                │
│    dependencies:                             │
│      @hyperframes/core                       │
│      @hyperframes/producer                   │
│      @hyperframes/sdk                        │
└─────────────────────────────────────────────┘
  │
  │ 3. npm install → HyperFrames scaricato automaticamente
  │    pip install faster-whisper → Whisper scaricato automaticamente
  ▼
┌─────────────────────────────────────────────┐
│   HYPERFRAMES (dependency)  │  WHISPER (dependency) │
│                                               │
│  - Composition HTML/CSS/JS    │  - Trascrizione locale │
│  - Headless Chrome compositing│  - Timecode per parola │
│  - FFmpeg per l'encoding      │  - Modello scaricato al │
│    finale                     │    primo uso            │
└─────────────────────────────────────────────┘
  │
  │ 4. npx hyperframes render → MP4 finale
  ▼
Output: video.mp4 (pronto alla pubblicazione)
```

## 4. Flusso dettagliato

### Step 1 — Ingest
- L'utente fornisce i percorsi dei file RAW.
- Tool `import_raw_media(paths)` registra i file e ne estrae metadati base (durata, risoluzione, fps).

### Step 2 — Trascrizione (Whisper)
- Tool `transcribe_media(media_id)` produce una trascrizione allineata a timecode usando Whisper (locale, licenza MIT).
- Output: JSON con parole/frasi e relativo timestamp (vedi Sezione 9 per i dettagli tecnici).

### Step 3 — Analisi narrativa e attenzione
- Tool `analyze_transcript(transcript)` individua:
  - hook iniziale
  - sezioni tematiche
  - ripetizioni/filler da tagliare
  - punti di calo di attenzione (pause lunghe, monotonia)
- Output: struttura semantica del contenuto.

### Step 4 — Generazione Action Plan
- Tool `generate_edit_plan(structure, style_prefs)` produce un JSON con:
  - `cuts`: elenco di tagli (start/end + motivo)
  - `animations`: overlay di testo, zoom, transizioni (con timecode)
  - `broll`: inserti di b-roll (se disponibili)
  - `pattern_interrupts`: eventi visivi per rompere la monotonia ogni N secondi

Esempio semplificato:

```json
{
  "version": "1.0",
  "style": "youtube_talking_head",
  "cuts": [
    {"start": "00:00:03.000", "end": "00:00:15.500", "reason": "hook iniziale"},
    {"start": "00:00:15.500", "end": "00:00:22.000", "reason": "filler da rimuovere"}
  ],
  "animations": [
    {"time": "00:00:08.000", "type": "text_overlay", "content": "IDEA CHIAVE", "position": "bottom"},
    {"time": "00:03:10.000", "type": "zoom_in", "target": "face"}
  ],
  "broll": [
    {"start": "00:04:00.000", "end": "00:04:10.000", "source": "library/product_shot_01.mp4"}
  ]
}
```

### Step 5 — Traduzione in progetto HyperFrames
- Tool `build_hyperframes_project(edit_plan)`:
  - genera una composition HTML/CSS/JS che riflette il piano (video segments, overlay, timing).
  - usa `npx hyperframes init` per creare la struttura di progetto.

### Step 6 — Render finale
- Tool `render_video(project)`:
  - esegue `npx hyperframes preview` (opzionale, per controllo visivo in browser).
  - esegue `npx hyperframes render` per produrre l'MP4 finale, con preset di qualità scelto (draft/standard/high).

## 5. Setup automatico per l'utente

Obiettivo: l'utente non deve installare nulla manualmente oltre ai prerequisiti di sistema.

**Prerequisiti minimi (responsabilità dell'utente):**
- Node.js ≥ 22
- FFmpeg installato e nel PATH
- Python 3.9–3.12 (solo se si usa faster-whisper; non richiesto con whisper.cpp)

**Automatizzato dalla skill:**
- `npm install` sulla skill scarica automaticamente HyperFrames come dependency (`@hyperframes/core`, `@hyperframes/producer`, `@hyperframes/sdk`).
- Script di setup esegue automaticamente `pip install faster-whisper` (o compila whisper.cpp) al primo avvio.
- Script di setup esegue `npx hyperframes doctor` per verificare l'ambiente e segnalare eventuali problemi.
- Al primo render, HyperFrames scarica automaticamente Chrome headless (nessuna azione richiesta).
- Al primo utilizzo della trascrizione, Whisper scarica automaticamente il modello neurale scelto e lo mette in cache locale.

## 6. Licenza e conformità

- HyperFrames è distribuito con **Apache License 2.0**: uso commerciale, distribuzione automatica via npm, e modifica sono tutti permessi.
- Whisper (e faster-whisper/whisper.cpp) è distribuito con **MIT License**: uso commerciale illimitato, distribuzione e modifica permesse.
- Unico obbligo comune a entrambe le licenze: preservare l'avviso di copyright e la licenza originale nel repo (file LICENSE + menzione in README/CREDITS).
- Non usare i nomi/marchi "HyperFrames" o "Whisper" come branding proprio della skill (per non violare eventuali clausole trademark).
- La nostra skill NON include il codice sorgente di HyperFrames o Whisper: li referenzia solo come dependency standard (npm/pip), scaricate dai registry ufficiali al momento dell'installazione.

## 7. Struttura del repository GitHub

```
andrea-video-skill/
├── README.md              # presentazione, quickstart, esempi
├── SKILL.md                # istruzioni per l'agente AI (procedura, regole)
├── LICENSE                 # licenza della nostra skill
├── CREDITS.md               # attribuzione a HyperFrames (HeyGen) e Whisper (OpenAI)
├── mcp-server/
│   ├── package.json         # dependencies: @hyperframes/*
│   ├── requirements.txt     # dependencies: faster-whisper (se usato)
│   ├── src/
│   │   ├── server.ts        # entrypoint MCP
│   │   ├── tools_ingest.ts
│   │   ├── tools_transcribe.ts
│   │   ├── tools_analyze.ts
│   │   ├── tools_plan.ts
│   │   └── tools_render.ts
│   └── scripts/
│       └── setup-check.js   # verifica ambiente (node, python, ffmpeg, hyperframes doctor)
└── examples/
    ├── podcast-example/
    ├── youtube-talking-head/
    └── short-form-clips/
```

## 8. Roadmap di sviluppo

1. **MVP locale**: pipeline completa testata a mano (trascrizione → analisi → piano → render HyperFrames).
2. **Pubblicazione open-source**: repo GitHub con README chiaro, esempi, licenza.
3. **Distribuzione**: registrazione su cataloghi MCP (Awesome MCP Servers, MCP.Directory), community Claude/Codex.
4. **Monetizzazione futura** (fuori scope di questo documento):
   - versione hosted a pagamento
   - feature Pro (preset avanzati, analisi retention, stile custom)
   - micropagamenti per chiamata (x402 / Stripe MPP)

## 9. Trascrizione audio: Whisper (locale, licenza MIT)

### Scelta dello strumento

Per la trascrizione audio/video, la skill usa **Whisper** (OpenAI) o le sue reimplementazioni ottimizzate, tutte con licenza permissiva **MIT**:

| Tool | Licenza | Motivazione |
|---|---|---|
| **faster-whisper** (default) | MIT | 4x più veloce di Whisper originale, usa CTranslate2, ottimo su CPU e GPU |
| **whisper.cpp** (alternativa Node-only) | MIT | C++ puro, nessuna dipendenza Python, ottimo su Apple Metal |
| **openai-whisper** (riferimento) | MIT | Implementazione originale, massima compatibilità |

Tutte le opzioni permettono uso commerciale illimitato, modifica e redistribuzione, senza royalty. Unico obbligo: preservare il notice di copyright/licenza originale nel repo (già gestito in `CREDITS.md`).

### Perché Whisper e non un servizio cloud

- **Zero costi API**: nessuna chiamata a servizi esterni, nessun costo per minuto trascritto.
- **Privacy**: l'audio dell'utente non lascia mai la sua macchina.
- **Coerenza architetturale**: stesso principio "tutto locale" già adottato per HyperFrames — un solo prerequisito aggiuntivo (Python, se si usa faster-whisper) o nessuno (se si usa whisper.cpp via Node).
- **Timecode nativi**: Whisper produce timestamp per segmento/parola, essenziali per costruire l'Action Plan (tagli e animazioni sincronizzati).

### Requisiti hardware

| Componente | Minimo | Consigliato |
|---|---|---|
| RAM | 4 GB liberi | 8 GB |
| CPU | Qualsiasi x86_64/ARM64 moderna | 4+ core |
| GPU | Non necessaria | NVIDIA 3-8 GB VRAM (per modelli grandi) |
| Disco | ~1-10 GB (modello + cache) | 10 GB |

Whisper funziona bene anche solo su CPU: non è un requisito bloccante avere una GPU.

### Selezione automatica del modello in base all'hardware

Per evitare tempi di attesa eccessivi su macchine senza GPU, la skill seleziona automaticamente il modello più adatto:

```python
import shutil, subprocess, platform

def detect_hardware():
    try:
        subprocess.run(["nvidia-smi"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return "gpu_nvidia"
    except FileNotFoundError:
        pass
    if platform.system() == "Darwin" and platform.processor() == "arm":
        return "apple_silicon"
    return "cpu_only"

def select_model(hardware):
    if hardware in ("gpu_nvidia", "apple_silicon"):
        return "large-v3"
    return "small"  # fallback CPU: 7-8x piu rapido, accuratezza comunque adeguata
```

Tempi indicativi per 10 minuti di video:

| Hardware | Modello | Tempo stimato |
|---|---|---|
| CPU moderna (i7/Ryzen) | small | ~1-2 minuti |
| CPU moderna (senza fallback) | large-v3 | ~25 minuti (da evitare) |
| GPU consumer (RTX 3060+) | large-v3 | ~1-6 minuti |
| Apple Silicon (M-series) | large-v3 | ~1 minuto |

### Installazione (automatica, nessun passo manuale per l'utente)

Requisiti di sistema (responsabilità dell'utente, verificati dallo script di setup):
- Python 3.9–3.12 (se si usa faster-whisper) oppure nessun requisito extra (se si usa whisper.cpp via Node)
- FFmpeg (già richiesto anche da HyperFrames — nessun prerequisito aggiuntivo)

Automatizzato dalla skill:

```bash
# eseguito automaticamente dallo script di setup al primo avvio
pip install faster-whisper
```

Il modello neurale (pesi) viene scaricato automaticamente al primo utilizzo e messo in cache locale — nessuna azione manuale richiesta:

```python
from faster_whisper import WhisperModel

model = WhisperModel(select_model(detect_hardware()), device="auto", compute_type="auto")
segments, info = model.transcribe("video.mp4", word_timestamps=True)
```

### Integrazione nel tool MCP

```
tools_transcribe.ts
  └─ transcribe_media(media_id)
        ├─ detect_hardware()          → sceglie CPU/GPU
        ├─ select_model(hardware)     → sceglie small / large-v3
        ├─ chiama faster-whisper (via child_process da Node, o binding nativo)
        └─ ritorna transcript JSON con timecode per segmento/parola
```

Output atteso (JSON):

```json
{
  "segments": [
    {"start": "00:00:00.000", "end": "00:00:04.200", "text": "Ciao a tutti, oggi parliamo di..."},
    {"start": "00:00:04.200", "end": "00:00:09.800", "text": "un argomento molto interessante."}
  ]
}
```

Questo output alimenta direttamente lo Step 3 (Analisi narrativa) descritto nella Sezione 4.
