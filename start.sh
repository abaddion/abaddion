#!/bin/bash

echo "╔═══════════════════════════════════════╗"
echo "║   GLITCH PORTFOLIO - DEV SERVER      ║"
echo "╚═══════════════════════════════════════╝"
echo ""

PORT="${PORT:-8799}"

if command -v npx &> /dev/null; then
    echo "→ npx serve (gzip/brotli) on http://localhost:${PORT}"
    echo "→ For Lighthouse local numbers, label as local (serve)."
    echo "→ Press Ctrl+C to stop"
    echo ""
    exec npx serve -s . -l "$PORT"
fi

if command -v python3 &> /dev/null; then
    echo "⚠ Python http.server does NOT compress — not for Lighthouse JS totals"
    echo "→ http://localhost:${PORT}"
    exec python3 -m http.server "$PORT" --bind 0.0.0.0
fi

echo "✗ Need Node (npx serve) or Python 3"
exit 1
