#!/usr/bin/env bash
# For maintainers only: build the image and send it to Docker Hub.
#
#   ./publish.sh v2.0            build annotep/edta-gui:v2.0 and ask before pushing
#   ./publish.sh v2.0 --latest   also tag and push it as annotep/edta-gui:latest
#
# Before pushing: docker login (account with access to the "annotep" organization).
# After publishing a NEW version, update the default tag in compose.yaml and start.sh.
set -euo pipefail

cd "$(dirname "$0")/.."   # repository root = build context
REPO="${EDTA_GUI_REPO:-annotep/edta-gui}"

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
fail() { printf '\n\033[1;31m%s\033[0m\n' "$*" >&2; exit 1; }

VERSION="${1:-}"
[[ "$VERSION" =~ ^v[0-9]+(\.[0-9]+)*$ ]] || fail "Usage: ./publish.sh v2.0 [--latest]"
LATEST=false
[ "${2:-}" = "--latest" ] && LATEST=true

command -v docker >/dev/null 2>&1 || fail "Docker is not installed."
[ -f EDTA.pl ] && [ -f gui/Dockerfile ] || fail "Run this script from the EDTA-GUI repository."

tags=(-t "${REPO}:${VERSION}")
$LATEST && tags+=(-t "${REPO}:latest")

say "Building ${REPO}:${VERSION} (the first build takes about 1 hour; later ones reuse the cache)"
docker build -f gui/Dockerfile --build-arg VERSION="$VERSION" "${tags[@]}" .

say "Built. Size:"
docker image ls "${REPO}:${VERSION}" --format '  {{.Repository}}:{{.Tag}}  {{.Size}}'
echo
echo "Test it before publishing:"
echo "  EDTA_GUI_IMAGE=${REPO}:${VERSION} gui/start.sh"

read -r -p "Push ${REPO}:${VERSION}$($LATEST && echo ' and :latest') to Docker Hub now? [y/N] " answer
case "$answer" in
  [yY]*)
    docker push "${REPO}:${VERSION}"
    $LATEST && docker push "${REPO}:latest"
    say "Published: ${REPO}:${VERSION}"
    ;;
  *)
    echo "Not pushed. Later: docker push ${REPO}:${VERSION}"
    ;;
esac
