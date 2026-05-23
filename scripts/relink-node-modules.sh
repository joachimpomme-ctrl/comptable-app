#!/usr/bin/env bash
# Relinks node_modules outside Google Drive after npm install.
# Run after every install / lockfile change.

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CACHE_DIR="${HOME}/.compta-multi-agents-cache"
TARGET="${CACHE_DIR}/node_modules"

cd "${PROJECT_DIR}"

if [ -L node_modules ]; then
  echo "node_modules is already a symlink — nothing to do."
  exit 0
fi

if [ ! -d node_modules ]; then
  echo "No node_modules directory found. Run 'npm install' first."
  exit 1
fi

mkdir -p "${CACHE_DIR}"
rm -rf "${TARGET}"
mv node_modules "${TARGET}"
ln -s "${TARGET}" node_modules

echo "OK — node_modules symlinked to ${TARGET}"
