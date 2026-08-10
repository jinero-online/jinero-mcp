#!/usr/bin/env bash
# Identify a font from a LOCAL image via image_base64 (no hosting needed).
# Usage: ./recognize-font-base64.sh path/to/text-crop.png
[ -f "$1" ] || { echo "usage: $0 <image>"; exit 1; }
B64=$(base64 -w0 "$1")
printf '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"recognize_font","arguments":{"image_base64":"%s","top_k":5}}}' "$B64" \
  | curl -s -X POST https://jinero.online/mcp \
      -H 'Content-Type: application/json' \
      -H 'Accept: application/json, text/event-stream' \
      --data @- | python3 -m json.tool
