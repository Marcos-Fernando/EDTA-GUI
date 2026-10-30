import { FASTA_EXTENSIONS } from './edtaFields'

/** panEDTA script, relative to the repository root. Runs with the EDTA engine only. */
export const PAN_SCRIPT = 'panEDTA.sh'

export const PAN_PARAMS = {
  threads: { label: 'Threads', flag: '-t', default: 10, min: 10 },
  copies: {
    label: 'Minimum number of full-length TE copies in individual genomes',
    flag: '-f',
    default: 3,
    min: 3,
  },
} as const

/** Fixed: overwrite existing EDTA results inside the run folder (legacy GUI). */
export const PAN_FIXED_ARGS = ['-o', '1'] as const

export const PAN_FILE_EXTENSIONS = FASTA_EXTENSIONS

/** Name of the genome list written to the run folder: genome_<ts>.cds.list */
export function panListName(timestamp: string): string {
  return `genome_${timestamp}.cds.list`
}
