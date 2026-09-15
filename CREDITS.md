# Credits

**CutCraft** is created and maintained solely by
**Andrea Barretta** — sole author of all the code in this repository.

## Third-party dependencies

This project ships **no** third-party source code. The tools below are used
exclusively as standard package dependencies (installed at setup time via
`npm install` / `pip install -r requirements.txt`) and remain under their
own licenses:

| Dependency | License | Used for |
|---|---|---|
| HyperFrames (`hyperframes`, `@hyperframes/core`, `@hyperframes/producer`, `@hyperframes/sdk`) | Apache 2.0 | Rendering the edit plan as video (composition + headless render) |
| faster-whisper (pip) + Whisper model weights | MIT | 100% local audio transcription with word-level timecodes |
| `@modelcontextprotocol/sdk` (npm) | MIT | MCP server exposing the 5 pipeline tools |
| `zod` (npm) | MIT | Input validation for MCP tool arguments |
| `typescript`, `vitest`, `tsx`, `@types/node` (dev) | Apache 2.0 / MIT | Build, typecheck and test tooling |

Whisper model weights are downloaded automatically on first transcription
and never leave your machine — transcription is fully offline.

See [LICENSE.md](LICENSE.md) for the license of CutCraft itself.
