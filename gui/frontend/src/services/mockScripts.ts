/**
 * Log lines replayed by the mock. Progress messages are copied from
 * EDTA.pl / EDTA_raw.pl / panEDTA.sh / generate_PLOTs-for-TE-pipe.sh so the
 * step matchers are exercised exactly as with a real log.
 * "@DATE@" is replaced by a `date`-like timestamp when the line is emitted.
 * MOCK ONLY: nothing here is shown outside mock mode.
 */
import type { EdtaRunConfig, PanRunConfig } from '../types'
import { secureFilename } from '../utils/files'

export const DATE_TOKEN = '@DATE@'
const d = (msg: string) => `${DATE_TOKEN}\t${msg}`

/** A genome whose file name contains "fail" makes the mock run fail (to test error states). */
export const FAIL_MARKER = 'fail'

export interface MockScript {
  lines: string[]
  /** Index after which the run fails (exit code ≠ 0), or null when it succeeds. */
  failAfter: number | null
}

export function edtaScript(cfg: EdtaRunConfig, genome: string): MockScript {
  const s = cfg.switches
  const annotep = cfg.mode === 'annotep'
  const anno = annotep || s.anno
  const lines: string[] = [
    '#########################################################',
    '##### Extensive de-novo TE Annotator (EDTA)          #####',
    '##### Shujun Ou (shujun.ou.1@gmail.com)              #####',
    '#########################################################',
    '',
    d('Dependency checking:'),
    '\tAll passed!',
    '',
  ]
  const order = ['all', 'filter', 'final', 'anno'] as const
  const from = order.indexOf(cfg.step)

  if (from <= 0) {
    lines.push(
      d('Obtain raw TE libraries using various structure-based programs: '),
      d('EDTA_raw: Check dependencies, prepare working directories.'),
      d('Start to find LTR candidates.'),
      d('Identify LTR retrotransposon candidates from scratch.'),
      d('Finish finding LTR candidates.'),
      d('Start to find SINE candidates.'),
      d('Finish finding SINE candidates.'),
      d('Start to find LINE candidates.'),
      d('Identify LINE retrotransposon candidates from scratch.'),
      d('Finish finding LINE candidates.'),
      d('Start to find TIR candidates.'),
      d('Identify TIR candidates from scratch.'),
      d('Finish finding TIR candidates.'),
      d('Start to find Helitron candidates.'),
      d('Identify Helitron candidates from scratch.'),
      d('Finish finding Helitron candidates.'),
      d('Obtain raw TE libraries finished.'),
      '',
    )
  }
  if (from <= 1) {
    lines.push(
      d('Perform EDTA advance filtering for raw TE candidates and generate the stage 1 library: '),
      d('EDTA advance filtering finished.'),
      '',
    )
  }
  // Failing runs stop right after the filtering step starts (or after the last line so far).
  const failAfter = genome.toLowerCase().includes(FAIL_MARKER)
    ? lines.length - (from <= 1 ? 3 : 1)
    : null

  if (from <= 2) {
    lines.push(d('Perform EDTA final steps to generate a non-redundant comprehensive TE library.'))
    if (annotep || s.sensitive) {
      lines.push('\tFilter RepeatModeler results that are ignored in the raw step.')
    } else {
      lines.push('\tSkipping the RepeatModeler results (--sensitive 0).')
    }
    if (cfg.files.cds) lines.push(d('Clean up TE-related sequences in the CDS file with TEsorter.'))
    if (cfg.files.curatedlib) {
      const lib = secureFilename(cfg.files.curatedlib.name)
      lines.push(d(`Combine the high-quality TE library ${lib} with the EDTA library:`))
    }
    lines.push(
      d('EDTA final stage finished! You may check out:'),
      `\t\tThe final EDTA TE library: ${genome}.mod.EDTA.TElib.fa`,
      '',
    )
  }
  if (anno) {
    lines.push(d('Perform post-EDTA analysis for whole-genome annotation:'))
    if (cfg.files.rmout) {
      const out = secureFilename(cfg.files.rmout.name)
      lines.push(
        d(
          `A RepeatMasker result file ${out} is provided! Will use this file without running RepeatMasker.`,
        ),
      )
    } else {
      lines.push(
        d(`Homology-based annotation of TEs using ${genome}.mod.EDTA.TElib.fa from scratch.`),
      )
    }
    if (annotep && s.runLai) lines.push(d('Performing LAI:'))
    lines.push(d('TE annotation using the EDTA library has finished! Check out:'), '')
    if (s.evaluate) {
      lines.push(
        d('Evaluate the level of inconsistency for whole-genome TE annotation:'),
        d('Evaluation of TE annotation finished! Check out these files:'),
        '',
      )
    }
  }
  if (annotep) {
    lines.push(
      '################## AnnoTEP annotation completed successfully ##################',
      ' ',
      '################## Starting report and chart generation #######################',
      `processing the genome: ${genome}`,
      'Starting adapted ProcessRepeats ...',
      'Creating repeat landscape started ...',
      'Plotting age distribution started ...',
      'Creating LTR phylogeny ...',
      'Starting creation of TE bar and bubble plots ...',
      'The generation of charts and reports has been completed',
    )
  }
  return { lines, failAfter }
}

export function panScript(cfg: PanRunConfig, listName: string, outDir: string): MockScript {
  const genomes = cfg.pairs.map((p) => secureFilename(p.genome.name))
  const lines: string[] = [
    '',
    DATE_TOKEN,
    '###############################################################',
    '##### Pan-genome Extensive de-novo TE Annotator (panEDTA) #####',
    '##### Shujun Ou (shujun.ou.1@gmail.com)                   #####',
    '###############################################################',
    '',
    `   Output directory: ${outDir}`,
    `   Genome files: ${listName}`,
    `   Coding sequences: ${secureFilename(cfg.cds.name)}`,
    `   Curated library: ${cfg.library ? secureFilename(cfg.library.name) : ''}`,
    `   Copy number cutoff: ${cfg.copies}`,
    '   Overwrite EDTA results: 1',
    `   CPUs: ${cfg.threads}`,
    '',
  ]
  let failAfter: number | null = null
  for (const g of genomes) {
    lines.push(`De novo annotate genome ${g} with EDTA`)
    if (g.toLowerCase().includes(FAIL_MARKER) && failAfter === null) {
      lines.push(`ERROR: Initial EDTA failed for ${g}`)
      failAfter = lines.length - 1
    }
  }
  lines.push('', DATE_TOKEN)
  for (const g of genomes) lines.push(`\tIdenfity full-length TEs for genome ${g}`)
  lines.push(
    '',
    DATE_TOKEN,
    '\tExtract pan-TE library candidate sequences',
    '',
    DATE_TOKEN,
    '\tGenerate the panEDTA library',
    '',
    DATE_TOKEN,
    `\tpanEDTA library of ${listName} is generated: ${listName}.panEDTA.TElib.fa`,
  )
  for (const g of genomes) {
    lines.push(
      '',
      DATE_TOKEN,
      `Reannotate genome ${g} with the panEDTA library - homology`,
      '',
      DATE_TOKEN,
      `Reannotate genome ${g} with the panEDTA library - structural`,
    )
  }
  lines.push(DATE_TOKEN, `\tpanEDTA annotation of ${listName} is finished!`, '')
  return { lines, failAfter }
}
