#!/usr/bin/env bash
# EDTA-GUI setup without Docker, done once. Works from any folder:
#
#   bash ~/EDTA-GUI/install.sh
#
# 1. Creates the conda environments (existing ones are kept):
#      EDTAgui          -> EDTA and panEDTA        (edta_env.yml)
#      annotepgui_3_11  -> AnnoTEP and the GUI     (annotep_env_3_11.yml)
# 2. Lets RepeatMasker accept sequence names up to 80 characters (maxIDLength 50 -> 80), in
#    both environments.
# 3. Builds the web interface (gui/frontend, with the Node of annotepgui_3_11).
# 4. Installs the EDTA, AnnoTEP, panEDTA and EDTA-GUI commands for this user (cli/install.sh).
#
# No sudo. Other environment names: EDTA_CONDA_ENV=... ANNOTEP_CONDA_ENV=... bash install.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
# CONDA, EDTA_ENV and ANNOTEP_ENV; stops with a message when conda is missing.
source "$ROOT/cli/_common.sh"

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }

env_prefix() { "$CONDA" env list | awk -v e="$1" '$1 == e { print $NF }'; }

create_env() {
  local env="$1" file="$2"
  if [ -n "$(env_prefix "$env")" ]; then
    say "Environment '$env' already exists: kept as it is."
    return 0
  fi
  say "Creating environment '$env' from $file (this can take a long time)..."
  "$CONDA" env create -n "$env" -f "$ROOT/$file"
}

# Same change as gui/Dockerfile. Only the copies inside the environment are changed.
fix_repeatmasker() {
  local prefix f changed=0
  prefix="$(env_prefix "$1")"
  for f in "$prefix/share/RepeatMasker/RepeatMasker" "$prefix/share/RepeatMasker/ProcessRepeats"; do
    if [ -f "$f" ] && grep -Eq 'maxIDLength[[:space:]]*=>[[:space:]]*50' "$f"; then
      sed -i -E 's/maxIDLength([[:space:]]*)=>([[:space:]]*)50/maxIDLength\1=>\280/' "$f"
      changed=1
    fi
  done
  if [ "$changed" = 1 ]; then
    echo "RepeatMasker in '$1': sequence names up to 80 characters."
  fi
}

create_env "$EDTA_ENV" edta_env.yml
create_env "$ANNOTEP_ENV" annotep_env_3_11.yml

say "Adjusting RepeatMasker..."
fix_repeatmasker "$EDTA_ENV"
fix_repeatmasker "$ANNOTEP_ENV"

say "Building the web interface..."
if ! bash "$ROOT/cli/EDTA-GUI" --build; then
  echo "Could not build the interface now (internet?). The EDTA-GUI command will try again when started."
fi

say "Installing the EDTA, AnnoTEP, panEDTA and EDTA-GUI commands..."
bash "$ROOT/cli/install.sh"

say "Setup finished! No 'conda activate' is needed: the commands use the environments on their own."
cat <<EOF
In a NEW terminal, from any folder:
  EDTA-GUI          the web interface (http://localhost:8000)
Command line (the analysis runs in the current folder):
  EDTA --help
  AnnoTEP --help
  panEDTA
Example:
  cd ~/my-analysis
  AnnoTEP --genome genome.fa --species others --step all --sensitive 1 --anno 1 --threads 10
EOF
