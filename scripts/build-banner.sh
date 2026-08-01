#!/usr/bin/env bash
# Render scripts/banner.html to site/assets/banner.png (1280x640, the GitHub
# social preview size). The HTML page is sized to exactly 1280x640, so a
# full-page capture is the asset with no cropping.
#
#   ./scripts/build-banner.sh
#
# Requires: agent-browser (or swap in any headless screenshot tool), python3.

set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
port="${BANNER_PORT:-8792}"
out="$root/site/assets/banner.png"

cd "$root"
python3 -m http.server "$port" >/dev/null 2>&1 &
server=$!
trap 'kill "$server" 2>/dev/null || true' EXIT
sleep 1

agent-browser navigate "http://localhost:$port/scripts/banner.html" --session banner-build >/dev/null
sleep 2  # let the webfonts land before capturing
agent-browser screenshot --full "$out" --session banner-build >/dev/null
agent-browser close --session banner-build >/dev/null 2>&1 || true

echo "wrote $out"
file "$out"
