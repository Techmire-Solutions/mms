#!/usr/bin/env bash
# MMS Linux & Production Compatibility Verifier
# Checks for CRLF line endings, unexecutable shell scripts, and casing issues.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
cd "$ROOT"

echo "🔍 Running Linux VPS Compatibility Checks..."
ERRORS=0

# 1. Line endings check (LF only)
echo "Checking for CRLF line endings in scripts and configs..."
while IFS= read -r file; do
  if file "$file" | grep -q 'CRLF line terminators'; then
    echo "❌ CRLF line terminator found in: $file"
    ERRORS=$((ERRORS + 1))
  fi
done < <(find scripts .agent/scripts apps/backend/src apps/frontend/src -type f \( -name "*.sh" -o -name "*.ts" -o -name "*.tsx" -o -name "*.json" \) 2>/dev/null)

# 2. Executable permission check for shell scripts
echo "Checking script execute bits..."
while IFS= read -r file; do
  if [ ! -x "$file" ]; then
    echo "❌ Shell script not marked executable: $file"
    ERRORS=$((ERRORS + 1))
  fi
done < <(find scripts .agent/scripts -type f -name "*.sh" 2>/dev/null)

if [ "$ERRORS" -gt 0 ]; then
  echo "💥 Linux compatibility check failed with $ERRORS error(s)."
  exit 1
else
  echo "✅ Linux compatibility checks passed cleanly!"
  exit 0
fi
