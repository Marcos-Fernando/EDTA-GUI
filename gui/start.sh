#!/usr/bin/env bash
# EDTA-GUI / AnnoTEP with Docker: one command to start, stop or update the interface.
#
#   ./start.sh          start (the first time it downloads the image from Docker Hub)
#   ./start.sh stop     stop
#   ./start.sh update   download the image again (after a new version), then start
#   ./start.sh build    build the image on this computer instead of downloading (about 1 hour)
#   ./start.sh logs     follow the server messages
#
# Results are saved in ~/results-edtagui, on this computer and owned by you
# (another folder: EDTA_GUI_RESULTS=/path/to/folder ./start.sh).
#
# This script also works on its own (sent alone with the Docker Hub link): without a
# compose.yaml next to it, it writes one (the published image only, no local build).
set -euo pipefail

cd "$(dirname "$0")"
PORT="${EDTA_GUI_PORT:-8000}"
# Same default as compose.yaml
IMAGE="${EDTA_GUI_IMAGE:-annotep/edta-gui:v2.0}"
URL="http://localhost:${PORT}"

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
fail() { printf '\n\033[1;31m%s\033[0m\n' "$*" >&2; exit 1; }

command -v docker >/dev/null 2>&1 ||
  fail "Docker is not installed. Install it first: https://docs.docker.com/engine/install/"
docker compose version >/dev/null 2>&1 ||
  fail "The 'docker compose' plugin is missing. Install it: https://docs.docker.com/compose/install/"
docker info >/dev/null 2>&1 ||
  fail "Docker is not running, or your user cannot use it.
Start Docker, or add your user to the docker group:
  sudo usermod -aG docker \$USER   (then log out and log in again)"

# The container runs as you, so the results belong to you (not to root).
export LOCAL_UID LOCAL_GID RESULTS_HOST_DIR EDTA_GUI_PORT="$PORT" EDTA_GUI_IMAGE="$IMAGE"
LOCAL_UID="$(id -u)"
LOCAL_GID="$(id -g)"
RESULTS_HOST_DIR="${EDTA_GUI_RESULTS:-$HOME/results-edtagui}"
# Created here, otherwise Docker would create it owned by root.
mkdir -p "$RESULTS_HOST_DIR"
RESULTS_HOST_DIR="$(cd "$RESULTS_HOST_DIR" && pwd)"

# Standalone use: the compose file of the published image. Keep in sync with compose.yaml
# (same service, without the build section, which needs the whole repository).
write_compose() {
  cat >compose.yaml <<'YAML'
# EDTA-GUI with Docker, written by start.sh (published image only). Use ./start.sh.
name: edta-gui

services:
  edta-gui:
    image: ${EDTA_GUI_IMAGE:-annotep/edta-gui:v2.0}
    pull_policy: missing
    container_name: edta-gui
    # Results belong to the user of this machine, not to root.
    user: "${LOCAL_UID:-1000}:${LOCAL_GID:-1000}"
    # Only this computer can open the interface (it has no login).
    ports:
      - "127.0.0.1:${EDTA_GUI_PORT:-8000}:8000"
    volumes:
      - ${RESULTS_HOST_DIR:-./results-edtagui}:/usr/local/EDTA/gui/backend/results
    environment:
      DISPLAY_PATH_MAP: /usr/local/EDTA/gui/backend/results=${RESULTS_HOST_DIR:-./results-edtagui}
      MAX_CONCURRENT_RUNS: ${MAX_CONCURRENT_RUNS:-1}
    # Optional e-mail settings (MAIL_*). Without this file, e-mails are simply not sent.
    env_file:
      - path: ./mail.env
        required: false
    # Large genomes start many processes (about 10000 per thread): without these limits the
    # pipeline is killed. Same as "docker run --pids-limit 300000 --memory-swap -1" and
    # "ulimit -u 300000" (30 threads). More threads: EDTA_GUI_PIDS_LIMIT=<threads x 10000>.
    pids_limit: ${EDTA_GUI_PIDS_LIMIT:-300000}
    ulimits:
      nproc: ${EDTA_GUI_PIDS_LIMIT:-300000}
    memswap_limit: -1
    # Reaps the pipeline's child processes and forwards stop signals.
    init: true
YAML
  say "Created compose.yaml in $(pwd)"
}
# Rewritten on every run while it is ours, so it follows the version of this script.
if [ ! -f compose.yaml ]; then
  write_compose
elif head -n 1 compose.yaml | grep -q 'written by start.sh'; then
  write_compose >/dev/null
fi

open_browser() {
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$URL" >/dev/null 2>&1 &
  elif command -v open >/dev/null 2>&1; then
    open "$URL"
  fi
}

# Annotations running now (0 when the server is down). Uses the Python inside the container.
running_count() {
  docker compose exec -T edta-gui /usr/local/miniconda3/envs/annotepgui_3_11/bin/python -c '
import json, urllib.request
runs = json.load(urllib.request.urlopen("http://127.0.0.1:8000/api/runs", timeout=5))
print(sum(1 for r in runs if r["status"] == "running" and not r["readOnly"]))
' 2>/dev/null || echo 0
}

# Is the interface answering? curl or wget when installed (Ubuntu desktop has no curl by
# default); otherwise the Python inside the container.
is_ready() {
  if command -v curl >/dev/null 2>&1; then
    curl -fsS "${URL}/api/health" >/dev/null 2>&1
  elif command -v wget >/dev/null 2>&1; then
    wget -q -O /dev/null "${URL}/api/health" >/dev/null 2>&1
  else
    docker compose exec -T edta-gui /usr/local/miniconda3/envs/annotepgui_3_11/bin/python -c '
import urllib.request
urllib.request.urlopen("http://127.0.0.1:8000/api/health", timeout=5)
' >/dev/null 2>&1
  fi
}

wait_ready() {
  say "Starting EDTA-GUI..."
  for _ in $(seq 1 90); do
    if is_ready; then
      say "EDTA-GUI is ready: ${URL}"
      echo "Results folder: ${RESULTS_HOST_DIR}"
      echo "To stop: ./start.sh stop"
      open_browser
      return 0
    fi
    sleep 2
  done
  fail "EDTA-GUI did not answer at ${URL}. See the messages with: ./start.sh logs"
}

# Download the published image; without it (no internet, not published yet), build it here.
get_image() {
  say "Downloading ${IMAGE} (several GB, only once)..."
  if docker compose pull; then
    return 0
  fi
  say "Could not download ${IMAGE}. Building it on this computer instead (about 1 hour)..."
  build_image
}

build_image() {
  [ -f ../EDTA.pl ] && [ -f Dockerfile ] ||
    fail "Building needs the whole EDTA-GUI repository (this gui/ folder inside it).
Check your internet connection and run ./start.sh again to download the image."
  docker compose build
}

case "${1:-start}" in
  start)
    docker image inspect "$IMAGE" >/dev/null 2>&1 || get_image
    docker compose up -d --no-build
    wait_ready
    ;;
  update)
    get_image
    docker compose up -d --no-build
    wait_ready
    ;;
  build)
    say "Building ${IMAGE} on this computer (about 1 hour)..."
    build_image
    docker compose up -d --no-build
    wait_ready
    ;;
  stop)
    if [ "$(running_count)" != "0" ]; then
      printf '\nAn annotation is still running. Stopping now INTERRUPTS it.\n'
      read -r -p "Stop anyway? [y/N] " answer
      case "$answer" in [yY]*) ;; *) echo "Nothing was stopped."; exit 0 ;; esac
    fi
    docker compose down
    say "EDTA-GUI stopped. Your results are still in ${RESULTS_HOST_DIR}"
    ;;
  logs)
    docker compose logs -f
    ;;
  *)
    fail "Unknown option: $1 (use: start, stop, update, build or logs)"
    ;;
esac
