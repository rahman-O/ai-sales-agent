#!/usr/bin/env bash
# Select TEI CPU image for host architecture (no cpu-1.7.x).
set -euo pipefail
ARCH="$(uname -m)"
case "$ARCH" in
  arm64|aarch64)
    export TEI_IMAGE="${TEI_IMAGE:-ghcr.io/huggingface/text-embeddings-inference:cpu-arm64-1.9}"
    ;;
  *)
    export TEI_IMAGE="${TEI_IMAGE:-ghcr.io/huggingface/text-embeddings-inference:cpu-1.9}"
    ;;
esac
echo "TEI_IMAGE=$TEI_IMAGE ARCH=$ARCH"
exec docker compose "$@"
