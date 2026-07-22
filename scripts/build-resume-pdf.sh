#!/bin/bash
# Regenerates assets/Sehyoung-Hamjong-Resume.pdf from resume-pdf/resume.html.
# Run this after editing resume-pdf/resume.html so the downloadable PDF stays current.
set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

if [ ! -f "$CHROME" ]; then
  echo "Google Chrome not found at $CHROME — edit scripts/build-resume-pdf.sh to point at your Chrome install."
  exit 1
fi

"$CHROME" --headless --disable-gpu --no-sandbox \
  --print-to-pdf="$DIR/assets/Sehyoung-Hamjong-Resume.pdf" \
  --no-pdf-header-footer \
  "file://$DIR/resume-pdf/resume.html"

echo "Regenerated assets/Sehyoung-Hamjong-Resume.pdf"
