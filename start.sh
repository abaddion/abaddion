#!/bin/bash

echo "╔═══════════════════════════════════════╗"
echo "║   GLITCH PORTFOLIO - DEV SERVER      ║"
echo "║   Digital Decay Initialization...    ║"
echo "╚═══════════════════════════════════════╝"
echo ""

if command -v python3 &> /dev/null; then
    echo "✓ Python 3 detected"
    echo "→ Starting server on http://localhost:8000"
    echo "→ Press Ctrl+C to stop"
    echo ""
    python3 -m http.server 8000
elif command -v python &> /dev/null; then
    echo "✓ Python detected"
    echo "→ Starting server on http://localhost:8000"
    echo "→ Press Ctrl+C to stop"
    echo ""
    python -m http.server 8000
else
    echo "✗ Python not found"
    echo ""
    echo "Please install Python 3"
    exit 1
fi
