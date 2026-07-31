#!/usr/bin/env bash
set -e

HOST="whc"
REMOTE_PROJECT_DIR="segmentable-ruler"
PUBLISH_DIRECTORY="dist"

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

pnpm build

sftp $HOST << EOF
cd public_html/$REMOTE_PROJECT_DIR
rm -r assets
lcd "$PROJECT_DIR/$PUBLISH_DIRECTORY"
put -r *
bye
EOF
