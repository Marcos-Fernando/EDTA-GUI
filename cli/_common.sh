# Shared by cli/EDTA, cli/AnnoTEP and cli/panEDTA (sourced, not run).
# Runs a pipeline script inside its conda environment, without "conda activate".

# Repository root (works through symlinks and from any folder).
ROOT="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/.." && pwd)"

# Same names and variables as the GUI backend (gui/backend/.env.example).
EDTA_ENV="${EDTA_CONDA_ENV:-EDTAgui}"
ANNOTEP_ENV="${ANNOTEP_CONDA_ENV:-annotepgui_3_11}"

find_conda() {
  local c
  for c in "${CONDA_EXE:-}" "$(command -v conda 2>/dev/null || true)" \
    "$HOME/miniconda3/bin/conda" "$HOME/anaconda3/bin/conda" /usr/local/miniconda3/bin/conda; do
    if [ -n "$c" ] && [ -x "$c" ]; then
      echo "$c"
      return 0
    fi
  done
  echo "conda was not found. Install Miniconda (https://docs.conda.io/projects/miniconda/en/latest/) or set CONDA_EXE=/path/to/conda" >&2
  exit 1
}
CONDA="$(find_conda)"

# run_in <env> <extra PATH dirs, ":"-separated> <command> [args...]
run_in() {
  local env="$1" extra="$2"
  shift 2
  if ! "$CONDA" env list | awk '{print $1}' | grep -x "$env" >/dev/null; then
    echo "The conda environment '$env' does not exist (see the README to create it)." >&2
    exit 1
  fi
  # Appended, as in the GUI: conda run puts the environment's bin/ in front anyway.
  # (Never a trailing ":", which would add the current folder to the PATH.)
  PATH="${PATH}${extra:+:$extra}" "$CONDA" run --no-capture-output -n "$env" "$@"
}
