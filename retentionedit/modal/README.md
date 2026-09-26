# RetentionEdit — Modal.com Serverless GPU Worker

Questo modulo definisce il worker di rendering video GPU serverless per **RetentionEdit**.
Esegue l'intero pipeline di montaggio (FFmpeg con accelerazione hardware NVENC, composizione HyperFrames, estrazione copertina ad alto CTR e Frame-by-Frame Quality Gate).

## Requisiti

- Account su [Modal.com](https://modal.com/)
- Python 3.10+
- `pip install modal`

## Configurazione e Deploy

1. Autentica il tuo client Modal:
   ```bash
   modal setup
   ```

2. Esegui il test locale (dry-run):
   ```bash
   modal run app.py
   ```

3. Effettua il deployment in cloud:
   ```bash
   modal deploy app.py
   ```

4. Copia l'URL dell'endpoint generato da Modal (es. `https://<workspace>--retentionedit-gpu-worker-api-render-endpoint.modal.run`) e inseriscilo nel file `.env.local` della Web App come `MODAL_RENDER_ENDPOINT`.
