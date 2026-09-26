"""RetentionEdit — Higgsfield status poller (reference only).

Reads the API key from the environment — never hardcode secrets::

    export HIGGSFIELD_API_KEY="..."
    python scripts/poll_higgsfield.py <request_id_1> <request_id_2> ...

For the SOUL text-to-image workflow used for covers, poll:
    https://api.higgsfield.ai/requests/<request_id>/status
with header ``Authorization: Key <HIGGSFIELD_API_KEY>``.
"""
import json
import os
import sys
import time
import urllib.request


def check_status(request_id: str, api_key: str) -> dict:
    url = f"https://platform.higgsfield.ai/requests/{request_id}/status"
    req = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Key {api_key}",
            "User-Agent": "RetentionEdit/1.0",
        },
    )
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read().decode())


def main() -> None:
    api_key = os.environ.get("HIGGSFIELD_API_KEY", "").strip()
    if not api_key:
        print("Set HIGGSFIELD_API_KEY in the environment first.", file=sys.stderr)
        sys.exit(1)
    jobs = sys.argv[1:]
    if not jobs:
        print("Usage: python scripts/poll_higgsfield.py <request_id> [...]", file=sys.stderr)
        sys.exit(1)

    completed = set()
    for _attempt in range(120):
        for jid in jobs:
            if jid in completed:
                continue
            try:
                data = check_status(jid, api_key)
                status = data.get("status")
                print(f"Request {jid} status: {status}")
                if status in ("completed", "failed"):
                    print(json.dumps(data, indent=2)[:2000])
                    completed.add(jid)
            except Exception as e:  # network hiccup → retry next round
                print(f"Error checking {jid}: {e}")
        if len(completed) == len(jobs):
            print("All requests finished!")
            break
        time.sleep(5)


if __name__ == "__main__":
    main()
