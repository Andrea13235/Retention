---
name: computer-use
description: Usa il PC Mac al posto dell'utente tramite cua-driver. Esegue azioni GUI autonome come aprire app, cliccare, digitare testo, premere scorciatoie da tastiera, navigare nel browser e interagire con le finestre.
---

# Computer Use (Automazione GUI macOS)

Questa skill consente all'agente di operare direttamente sul Mac dell'utente per eseguire compiti al suo posto tramite il server MCP `cua-driver`.

## Quando usare questa skill
- L'utente digita: `/computer-use <istruzioni>`
- L'utente chiede di usare il PC, interagire con lo schermo, aprire software, cliccare pulsanti o compilare form.

---

## Ciclo di Esecuzione (Snapshot -> Action -> Verify)

1. **Targeting**:
   - Trova l'app o finestra bersaglio con `list_apps(running_only: true)` o `list_windows(on_screen_only: true)`.
   - Se necessario, lancia o porta in primo piano con `launch_app(app_name: "...")` o `bring_to_front(...)`.

2. **Snapshot**:
   - `get_window_state(pid: ..., window_id: ..., include_screenshot: true)` per catturare l'albero semantico AX e screenshot.
   - Oppure `get_desktop_state(...)` per l'intero schermo.

3. **Azione**:
   - `click`, `double_click`, `right_click`
   - `type_text`, `press_key`, `hotkey`
   - `scroll`, `drag`, `invoke_menu`
   - `clipboard_read`, `clipboard_write`

4. **Verifica**:
   - `verify_state` o nuovo snapshot prima di concludere.
