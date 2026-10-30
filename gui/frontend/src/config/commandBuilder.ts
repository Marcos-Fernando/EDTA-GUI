/**
 * Builds the pipeline commands as argument lists (never a shell string).
 * Used by the command preview and by the mock; the backend builds the same lists.
 * Flag order follows the legacy GUI (main.py).
 */
import type { EdtaRunConfig, PanRunConfig } from '../types'
import { ANNOTEP_REPORT_SCRIPT, EXTRA_FILES, MODES } from './edtaFields'
import { PAN_FIXED_ARGS, PAN_SCRIPT } from './panFields'
import { secureFilename } from '../utils/files'

const bit = (v: boolean) => (v ? '1' : '0')

/**
 * @param genomeName file name of the genome inside the run folder
 *   (from the upload, or from the reused run when no new genome is sent).
 */
export function buildEdtaCommands(cfg: EdtaRunConfig, genomeName: string): string[][] {
  const mode = MODES.find((m) => m.value === cfg.mode) ?? MODES[0]
  const s = cfg.switches
  const isAnnotep = cfg.mode === 'annotep'

  const args: string[] = [
    mode.script,
    '--genome',
    genomeName,
    '--species',
    cfg.species,
    '--step',
    cfg.step,
    // AnnoTEP: Sensitivity is always 1.
    '--sensitive',
    bit(isAnnotep || s.sensitive),
    '--threads',
    String(cfg.threads),
  ]
  if (s.overwrite) args.push('--overwrite', '1')
  // AnnoTEP: Annotation is always 1. With --anno 1, --evaluate is always explicit.
  if (isAnnotep || s.anno) args.push('--anno', '1', '--evaluate', bit(s.evaluate))
  if (s.force) args.push('--force', '1')
  if (cfg.mutationRate !== null) args.push('--u', cfg.mutationRate)
  if (cfg.maxDiv !== null) args.push('--maxdiv', String(cfg.maxDiv))
  if (isAnnotep) {
    if (s.tirFilter) args.push('--TIR_filter', '1')
    if (s.annotType) args.push('--ANNOT_TYPE', '1')
    // --run_LAI exists only in AnnoTEP/EDTA/EDTA.pl.
    args.push('--run_LAI', bit(s.runLai))
  }
  for (const f of EXTRA_FILES) {
    const file = cfg.files[f.key]
    if (file) args.push(f.flag, secureFilename(file.name))
  }

  const commands = [args]
  if (isAnnotep) commands.push(['bash', ANNOTEP_REPORT_SCRIPT, genomeName])
  return commands
}

export function buildPanCommand(cfg: PanRunConfig, listName: string): string[] {
  const args = ['bash', PAN_SCRIPT, '-g', listName, '-c', secureFilename(cfg.cds.name)]
  if (cfg.library) args.push('-l', secureFilename(cfg.library.name))
  args.push('-t', String(cfg.threads), '-f', String(cfg.copies), ...PAN_FIXED_ARGS)
  return args
}

/** Content of genome_<ts>.cds.list: one "genome[<TAB>cds]" line per pair, newline-terminated. */
export function buildPanList(cfg: PanRunConfig): string {
  return cfg.pairs
    .map(({ genome, cds }) => {
      const g = secureFilename(genome.name)
      return cds ? `${g}\t${secureFilename(cds.name)}` : g
    })
    .map((line) => `${line}\n`)
    .join('')
}

/** Display form of an argument list (quoting only for readability). */
export function formatCommand(args: string[]): string {
  return args.map((a) => (/^[\w./:=+-]+$/.test(a) ? a : `'${a.replace(/'/g, `'\\''`)}'`)).join(' ')
}
