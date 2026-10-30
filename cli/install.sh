#!/usr/bin/env bash
# Makes the EDTA, AnnoTEP, panEDTA and EDTA-GUI commands available in any terminal, for this user
# only (no sudo): links in ~/.local/bin and, when that folder is not in the PATH, one line
# in ~/.bashrc.
#
#   cli/install.sh               install (run it again after moving the repository)
#   cli/install.sh --uninstall   remove the links and the ~/.bashrc line
#
# Another folder for the links: EDTA_CLI_BIN=/path/to/bin cli/install.sh
set -euo pipefail

CLI="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
ROOT="$(dirname "$CLI")"
BIN="${EDTA_CLI_BIN:-$HOME/.local/bin}"
RC="$HOME/.bashrc"
MARK="# EDTA-GUI cli (added by cli/install.sh)"
COMMANDS=(EDTA AnnoTEP panEDTA EDTA-GUI)

say() { printf '%s\n' "$*"; }
fail() { printf '%s\n' "$*" >&2; exit 1; }

# Is $1 a link made by this script (to an EDTA-GUI cli/ folder, this one or another copy)?
our_link() { [ -L "$1" ] && [[ "$(readlink "$1")" == */cli/"$(basename "$1")" ]]; }

uninstall() {
  local c
  for c in "${COMMANDS[@]}"; do
    if our_link "$BIN/$c"; then
      rm -f "$BIN/$c"
      say "Removed $BIN/$c"
    fi
  done
  if [ -f "$RC" ] && grep -qF "$MARK" "$RC"; then
    # The marker line and the export line after it.
    awk -v m="$MARK" '$0 == m { skip = 1; next } skip { skip = 0; next } { print }' "$RC" >"$RC.edta-tmp"
    cat "$RC.edta-tmp" >"$RC" && rm -f "$RC.edta-tmp"
    say "Removed the PATH line from $RC"
  fi
  say "Done. The commands are still available in $CLI/."
}

install() {
  local c
  mkdir -p "$BIN"
  for c in "${COMMANDS[@]}"; do
    # Never replace a file or link that is not ours.
    if [ -e "$BIN/$c" ] || [ -L "$BIN/$c" ]; then
      our_link "$BIN/$c" || fail "$BIN/$c already exists and was not made by this script. Nothing was changed.
Remove or rename it, or choose another folder: EDTA_CLI_BIN=/path/to/bin $0"
    fi
  done
  for c in "${COMMANDS[@]}"; do
    ln -sfn "$CLI/$c" "$BIN/$c"
    say "$BIN/$c -> $CLI/$c"
  done

  local new_terminal=0
  case ":$PATH:" in
    *":$BIN:"*) ;;
    *)
      if ! grep -qF "$MARK" "$RC" 2>/dev/null; then
        printf '\n%s\nexport PATH="%s:$PATH"\n' "$MARK" "$BIN" >>"$RC"
        say "Added $BIN to the PATH in $RC"
      fi
      new_terminal=1
      ;;
  esac

  check_envs

  say ""
  if [ "$new_terminal" = 1 ]; then
    say "Installed. Open a NEW terminal (or run: source $RC), then type EDTA, AnnoTEP, panEDTA or EDTA-GUI."
  else
    say "Installed. Type EDTA, AnnoTEP, panEDTA or EDTA-GUI in any folder."
  fi
}

# Warns (does not stop) when conda or an environment is missing.
check_envs() {
  local envs
  if ! envs="$(source "$CLI/_common.sh" 2>/dev/null && "$CONDA" env list 2>/dev/null)"; then
    say ""
    say "Warning: conda was not found. Install Miniconda, then create the environments:"
    say "  conda env create -f $ROOT/edta_env.yml"
    say "  conda env create -f $ROOT/annotep_env_3_11.yml"
    return 0
  fi
  local env file
  for env in "${EDTA_CONDA_ENV:-EDTAgui}:edta_env.yml" "${ANNOTEP_CONDA_ENV:-annotepgui_3_11}:annotep_env_3_11.yml"; do
    file="${env#*:}"
    env="${env%%:*}"
    if ! awk '{print $1}' <<<"$envs" | grep -x "$env" >/dev/null; then
      say ""
      say "Warning: the conda environment '$env' does not exist yet. Create it with:"
      say "  conda env create -f $ROOT/$file"
    fi
  done
}

case "${1:-}" in
  "") install ;;
  --uninstall) uninstall ;;
  *) fail "Unknown option: $1 (use: $0 or $0 --uninstall)" ;;
esac
