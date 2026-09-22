# Computer Use Automation Rules

Quando l'utente richiede di operare sul computer ("usa il mio pc al posto mio", "apri l'app", "clicca su", ecc.):
1. Utilizza il server MCP `cua-driver`.
2. Trova le finestre o applicazioni con `list_apps` e `list_windows`.
3. Scatta uno snapshot con `get_window_state` o `get_desktop_state` per mappare l'albero di accessibilità e le coordinate.
4. Esegui le azioni con `click`, `type_text`, `press_key`, `hotkey`, `invoke_menu`, `scroll`, `drag`.
5. Verifica sempre i cambiamenti prima di procedere al passo successivo o concludere.
