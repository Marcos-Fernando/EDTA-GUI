/**
 * About + user guide page (#/guide). The About part reuses the legacy help texts;
 * the guide is the reference text for researchers of any computing level.
 * In every text, `backticks` mark something to type or a file/folder name.
 */
import { HELP, FASTA_HEADER_NOTE, type HelpBlock } from './help'

export type GuideBlock =
  | HelpBlock
  | { type: 'steps'; items: string[] }
  | { type: 'code'; text: string }
  | { type: 'table'; head: string[]; rows: string[][] }
  | { type: 'note'; text: string }

export interface GuideSection {
  /** Used in the address: #/guide/<id>. */
  id: string
  title: string
  /** One-sentence answer shown under the title. */
  lead?: string
  blocks: GuideBlock[]
}

const p = (text: string): GuideBlock => ({ type: 'p', text })
const h = (text: string): GuideBlock => ({ type: 'h', text })
const note = (text: string): GuideBlock => ({ type: 'note', text })
const code = (text: string): GuideBlock => ({ type: 'code', text })
const steps = (...items: string[]): GuideBlock => ({ type: 'steps', items })
const bullets = (...items: string[]): GuideBlock => ({
  type: 'list',
  items: items.map((text) => ({ text })),
})
const table = (head: string[], ...rows: string[][]): GuideBlock => ({ type: 'table', head, rows })

export const ABOUT: GuideSection = {
  id: 'about',
  title: 'About',
  blocks: [
    ...HELP.welcomeEdta.blocks,
    ...HELP.mode.blocks,
    h('panEDTA-GUI'),
    ...HELP.welcomePan.blocks,
    h('Article'),
    p(
      'Costa MFS, Almeida SS, Monteiro CS, Trinca V, Ou S, Varani AM, Abreu VAC. EDTA-GUI: a ' +
        'plant-optimized graphical implementation of the EDTA pipeline enabling lineage-level ' +
        'classification and analysis. BMC Genomics. 2026;27:229.',
    ),
    {
      type: 'link',
      text: 'doi:10.1186/s12864-026-12588-z',
      href: 'https://doi.org/10.1186/s12864-026-12588-z',
    },
  ],
}

export const GUIDE: readonly GuideSection[] = [
  {
    id: 'overview',
    title: 'What this tool does',
    lead:
      'EDTA-GUI finds and classifies the transposable elements (TEs) of a genome from your ' +
      'browser, with no command line.',
    blocks: [
      p(
        'You give it a genome in FASTA format, choose a few options, press a button, and come ' +
          'back later to a report with tables, charts and ready-to-use files. Three pipelines ' +
          'are available:',
      ),
      table(
        ['Pipeline', 'What it is', 'Use it when'],
        [
          'EDTA',
          'The Extensive de-novo TE Annotator. It builds a TE library from the genome itself, ' +
            'then annotates the whole genome with it.',
          'You want the standard EDTA result for one genome.',
        ],
        [
          'AnnoTEP',
          'EDTA adapted for plant genomes, with extra filters, the LAI quality score, a ' +
            'softmasked genome and a full report with charts.',
          'You work with a plant genome and want the richest report.',
        ],
        [
          'panEDTA',
          'The pan-genome version of EDTA. It annotates several related genomes together, so ' +
            'their TE libraries are consistent.',
          'You have two or more genomes of the same species or group.',
        ],
      ),
    ],
  },
  {
    id: 'before',
    title: 'Prepare your files',
    lead:
      'All you need is a genome in FASTA format with simple sequence names, and a computer ' +
      'that stays on until the analysis ends.',
    blocks: [
      bullets(
        'Your genome in FASTA format, ending in `.fa`, `.fasta`, `.fna`, `.ffn`, `.faa` or ' +
          '`.frn`. Files up to 10 GB are accepted.',
        'Optionally, the coding sequences (CDS) of the genome or a close relative, also in ' +
          'FASTA format. They help the pipeline avoid calling genes TEs.',
        'The analysis runs on this computer and takes hours: keep it on, and turn off sleep, ' +
          'until it ends.',
      ),
      note(FASTA_HEADER_NOTE),
      h('Words used in this guide'),
      table(
        ['Term', 'Meaning'],
        [
          'Transposable element (TE)',
          'A DNA sequence that can move or copy itself within a genome. Main groups: LTR ' +
            'retrotransposons (such as Copia and Gypsy), LINEs, SINEs, TIR transposons and ' +
            'Helitrons.',
        ],
        [
          'FASTA',
          'A plain-text file of sequences. Each one starts with a `>` line holding its name.',
        ],
        ['CDS', 'Coding DNA sequences: the parts of genes that code for proteins.'],
        [
          'TE library',
          'One representative sequence per TE family, used to find every copy in the genome.',
        ],
        ['Annotation', 'Where each TE copy sits in the genome (a GFF3 file).'],
        ['Run', 'One analysis. Each run gets its own folder of results.'],
        ['Thread', 'One unit of processor work. More threads make the analysis faster.'],
      ),
    ],
  },
  {
    id: 'annotation',
    title: 'Run an annotation (EDTA or AnnoTEP)',
    lead:
      'On the EDTA-GUI tab, choose the pipeline, select your genome, keep the defaults and ' +
      'press Start annotation.',
    blocks: [
      steps(
        'Open the EDTA-GUI tab.',
        'Under Pipeline mode, choose EDTA or AnnoTEP (AnnoTEP for plants).',
        'In 01 Input data, select your FASTA file in Genome sequence (FASTA).',
        'Press Start annotation at the bottom of the form.',
      ),
      p(
        'The button stays grey until everything required is filled in; a list above it says ' +
          'what is missing. The question-mark icons next to each part of the form explain its ' +
          'fields.',
      ),
      h('01 Input data'),
      table(
        ['Field', 'What to put', 'Required'],
        [
          'Email address',
          'Your e-mail, to be told when the run starts and ends. Works only if e-mail was set ' +
            'up on this computer.',
          'No',
        ],
        ['Genome sequence (FASTA)', 'Your genome file.', 'Yes'],
      ),
      h('02 Run parameters'),
      table(
        ['Field', 'Default', 'When to change it'],
        ['Species', '`others`', 'Choose `rice` or `maize` only for those genomes (TIR search).'],
        ['Steps to run', '`all`', 'Keep `all` for a new genome. See "Continuing" below.'],
        [
          'Mut. rate (-u)',
          '`1.3e-8`',
          'Neutral mutation rate per bp per year, used to date LTR insertions. The default ' +
            'comes from rice.',
        ],
        [
          'Max div. (%)',
          '`40`',
          'Highest divergence (0–100) accepted for TE fragments. Raise it only for very ' +
            'repetitive genomes.',
        ],
        ['Threads', '`10`', 'Processor threads to use. 10 is the minimum; more finish sooner.'],
      ),
      p(
        'Continuing: with Steps to run set to `filter`, `final` or `anno`, choose the ' +
          'analysis to continue in Previous run. It runs again in its own folder from that ' +
          'step, reusing the genome stored there unless you select a new one.',
      ),
      table(
        ['Step', 'Starts from'],
        ['`all`', 'The beginning: the whole pipeline.'],
        ['`filter`', 'The raw TE candidates already found.'],
        ['`final`', 'The filtered TEs.'],
        ['`anno`', 'The finished TE library: only the whole-genome annotation runs.'],
      ),
      h('03 Advanced options'),
      p(
        'In EDTA mode every switch starts off. In AnnoTEP mode Sensitivity and Annotation are ' +
          'always on, and Run LAI starts on.',
      ),
      table(
        ['Option', 'Turn it on to…', 'Modes'],
        ['Overwrite', 'Redo work already in the run folder instead of reusing it.', 'Both'],
        ['Sensitivity', 'Also run RepeatModeler to find extra elements (slower).', 'Both'],
        [
          'Annotation',
          'Annotate the whole genome once the TE library is built. Off: library only.',
          'Both',
        ],
        ['Evaluate', 'Check the consistency of the classification. Turns on Annotation.', 'Both'],
        ['Force', 'Go on with a backup rice library if no reliable TE is found.', 'Both'],
        [
          'TIR filter',
          'Drop TIRs without protein domains: fewer false positives, some true TIRs lost.',
          'AnnoTEP',
        ],
        ['Annot. type', 'Annotate with a RepeatMasker-based library.', 'AnnoTEP'],
        ['Run LAI', 'Compute the LAI assembly-quality score. Haploid assemblies only.', 'AnnoTEP'],
      ),
      h('04 Additional files (optional)'),
      table(
        ['File', 'What it is', 'Accepted'],
        [
          'Coding DNA sequence',
          'Coding sequences of this genome or a close relative, without introns, UTRs or TEs. ' +
            'Recommended.',
          'FASTA',
        ],
        ['Curated library', 'Manually checked TEs, to keep names and classes consistent.', 'Any'],
        ['Exclusion of masked regions', 'Regions to leave unmasked. Needs Annotation.', '`.bed`'],
        ['RepeatModeler library', 'A classified RepeatModeler library you already have.', 'Any'],
        [
          'RepeatMasker library',
          'Your own homology-based annotation, merged with the result. Needs Annotation.',
          '`.out`',
        ],
      ),
      h('Starting'),
      bullets(
        'Above the button, the command preview shows the exact command that will run, ' +
          'useful for the methods section of a paper.',
        'After you press Start annotation, a sound plays and a notice confirms the start, or ' +
          'says the run is waiting in the queue.',
        'The browser may ask permission to show notifications: allow it to be told when the ' +
          'run ends, even in another tab.',
      ),
    ],
  },
  {
    id: 'pan',
    title: 'Run a pan-genome annotation (panEDTA)',
    lead:
      'On the panEDTA-GUI tab, add one row per genome, give one general CDS file, and press ' +
      'Start annotation.',
    blocks: [
      p(
        'panEDTA first annotates each genome with EDTA, one after the other. It then builds ' +
          'one pan-genome TE library and re-annotates every genome with it, so a TE family ' +
          'has the same name in all genomes. It always uses EDTA, not AnnoTEP.',
      ),
      steps(
        'Open the panEDTA-GUI tab.',
        'Select the first genome in Genome 1 (FASTA) and, optionally, its CDS in CDS 1.',
        'Press Add genome for each further genome. The − button removes a row; the first ' +
          'row stays.',
        'In 02 Additional features, select the general Coding DNA sequence file (required). ' +
          'It is used for every genome listed without its own CDS.',
        'Press Start annotation.',
      ),
      table(
        ['Field', 'Default', 'What it does'],
        ['Non-redundant library', '—', 'Optional curated library (RepeatMasker naming).'],
        ['Threads', '`10`', 'Processor threads to use. 10 is the minimum.'],
        [
          'Minimum number of full-length TE copies',
          '`3`',
          'Copies a TE needs in one genome to enter the pan-genome library. Lower: larger, ' +
            'more sensitive, less consistent. Higher: smaller, more consistent.',
        ],
      ),
      note(
        'To save time, annotate each genome first on the EDTA-GUI tab with Annotation on: ' +
          'panEDTA reuses those annotations.',
      ),
    ],
  },
  {
    id: 'follow',
    title: 'Follow a run',
    lead:
      'The progress view shows the status, the current step, a timeline and the live log. ' +
      'You can close the browser: the run keeps going.',
    blocks: [
      table(
        ['Part', 'What it shows'],
        [
          'Status',
          'Queued #N, Running, Completed, Failed, or Check log (finished, but the expected ' +
            'last message is missing).',
        ],
        ['Current step / Progress', 'The step under way and how many steps are done.'],
        ['Elapsed time', 'Time since the run started.'],
        ['Folder path', 'Where the run is saved on your computer, with a copy button.'],
        ['Execution timeline', 'Every step: waiting, running, done or skipped.'],
        ['Execution log', 'The messages printed by the pipeline, live.'],
      ),
      p(
        'One analysis runs at a time by default; the next ones wait in a queue and start by ' +
          'themselves.',
      ),
      h('How long it takes'),
      p(
        'The whole A. thaliana genome (120 Mb) took 7 h 49 min with AnnoTEP on 10 threads, ' +
          'most of it in the first step:',
      ),
      table(
        ['Step', 'Time for A. thaliana'],
        ['Dependency check', 'seconds'],
        ['Raw TE libraries', '7 h 20 min (LINE candidates alone: 5 h 35 min)'],
        ['Advanced filtering', '1 min'],
        ['Final TE library', '3 min'],
        ['Whole-genome annotation and LAI', '12 min'],
        ['Annotation evaluation', '10 min'],
        ['Charts and reports (AnnoTEP)', '3 min'],
      ),
      p(
        'Larger genomes take longer; more threads take less. A step quiet for hours, such as ' +
          'the LINE search, is usually still working.',
      ),
      h('Notices, e-mail and cancelling'),
      bullets(
        'A notice and a sound when a run starts and ends; desktop notifications if allowed.',
        'E-mail at the start and the end (log attached), if you gave an address and e-mail ' +
          'was set up for this installation. The e-mail field says when it was not.',
        'Cancel run, at the top of the progress view, stops the pipeline in a few seconds. ' +
          'The run is marked Failed and its files are kept.',
        'If the computer, or the program behind this page, stops during a run, the run is ' +
          'marked Failed. Start it again from the form.',
      ),
    ],
  },
  {
    id: 'results',
    title: 'View the results',
    lead:
      'Open the Results tab, press Open on a run, then choose Report to see its tables and ' +
      'charts and to download its files.',
    blocks: [
      p(
        'The Results tab lists every analysis, running ones first, then the most recent, and ' +
          'refreshes every 10 seconds. Show log unfolds the last log lines; Open goes to the ' +
          'run page, with two views: Execution (progress and log) and Report.',
      ),
      p(
        'Analyses made with the old interface are listed too, marked as an old results ' +
          'folder: they can be opened, not continued.',
      ),
      h('The report'),
      p('The charts come from the AnnoTEP report: an EDTA run shows mainly the summary and files.'),
      table(
        ['Part', 'What it shows'],
        [
          'Quantitative summary',
          'TE classes found (copies, length, % of the genome) and a donut of the genome masked ' +
            'by repeats. Click a table row to see that category in the donut.',
        ],
        ['Distribution of TEs', 'Length and number of copies per TE category.'],
        ['Repeat landscape', 'Genome fraction per divergence level (Kimura distance).'],
        ['Distribution by chromosome', 'TE density along each chromosome or scaffold.'],
        ['LTR insertion time', 'Estimated ages of Copia and Gypsy elements.'],
        [
          'LTR phylogeny',
          'Circular tree of the LTR lineages, by clade: Cladogram or Phylogram. A large tree ' +
            'scrolls inside its frame.',
        ],
        ['Annotated files', 'Download links for the main outputs, per genome.'],
      ),
      p(
        'Most parts switch between Interactive (hover, zoom, export) and Images (the PNG ' +
          'figures of the pipeline; the PNG and PDF links open them at full size).',
      ),
      note(
        'Large data is shown as images only, so the browser does not freeze: genomes over ' +
          '1 Gb, LTR trees over 700 elements, and data files over 1–2 MB.',
      ),
      h('Main files to download'),
      table(
        ['File', 'Use it for'],
        ['Whole-genome TE annotation (GFF3)', 'Every TE copy; opens in IGV or JBrowse.'],
        ['Intact TEs (GFF3, FASTA)', 'Only complete, structurally intact elements.'],
        ['TE library (FASTA)', 'One sequence per family, to annotate related genomes.'],
        ['Softmasked genome (FASTA)', 'TEs in lower case, for gene annotation (AnnoTEP).'],
        ['Masked genome for MAKER', 'A lightly masked genome for MAKER.'],
        ['Annotation summary', 'How much of the genome each TE class covers.'],
        ['LAI report', 'LTR Assembly Index of the genome (AnnoTEP, Run LAI on).'],
      ),
    ],
  },
  {
    id: 'storage',
    title: 'Where your data is stored',
    lead:
      'Every analysis is saved in its own folder on this computer, by default inside ' +
      '`~/results-edtagui`: open, copy, back up or delete it like any other folder.',
    blocks: [
      p(
        'The page of each run shows its exact folder, with a copy button. Results stay on ' +
          'your computer when the interface is closed, stopped or updated.',
      ),
      table(
        ['Analysis', 'Folder name', 'Example'],
        [
          'EDTA or AnnoTEP',
          '`<genome>_<YYYYmmdd-HHMMSS>`',
          '`At_20261006-225503`: `At.fasta`, started 6 Oct 2026 at 22:55:03',
        ],
        ['panEDTA', '`panGenome_<YYYYmmdd-HHMMSS>`', '`panGenome_20261012-091500`'],
      ),
      h('Inside a run folder'),
      p(
        'A real AnnoTEP run of A. thaliana. The genome name starts most file names; `.mod` ' +
          'is added by EDTA, which shortens the sequence names before working.',
      ),
      code(
        [
          'At_20261006-225503/',
          '├── At.fasta                              your genome, as uploaded',
          '├── log.txt                               everything the pipeline printed',
          '├── status.txt                            written at the end: success or error',
          '├── run.json                              the options chosen in the interface',
          '├── At.fasta.mod.EDTA.TEanno.gff3         whole-genome TE annotation',
          '├── At.fasta.mod.EDTA.TEanno.sum          annotation summary',
          '├── At.fasta.mod.EDTA.TElib.fa            TE library',
          '├── At.fasta.mod.EDTA.intact.gff3 / .fa   intact TEs',
          '├── At.fasta.mod-Softmasked.fa            softmasked genome (AnnoTEP)',
          '├── At.fasta.mod.MAKER.masked             masked genome for MAKER',
          '├── At.fasta.mod.LAI                      LAI report (AnnoTEP)',
          '├── At.fasta.mod.EDTA.raw/ .combine/ .final/ .anno/   working files per step',
          '└── REPORT/                               AnnoTEP report: tables and figures',
          '    ├── At.fasta.mod-LITE.tbl / -COMPLETE.tbl',
          '    ├── TE-Report-*.png / .pdf            distribution charts',
          '    ├── kimura_distance_plot.png          repeat landscape',
          '    ├── density_plot_<chromosome>.png     density per chromosome',
          '    ├── AGE-Copia / AGE-Gypsy .png .txt   LTR insertion times',
          '    ├── LTR_RT-Tree*.png / .pdf           LTR phylogeny figures',
          '    └── TREE/                             tree data (all.nwk, TE.cls.tsv)',
        ].join('\n'),
      ),
      table(
        ['File', 'When it appears', 'What it holds'],
        ['`log.txt`', 'When the run starts', 'Every pipeline message. First place to look.'],
        [
          '`status.txt`',
          'Only when the run ends',
          '`Annotation finalised` or `Error in the annotation step`. No file: still running ' +
            'or cut off.',
        ],
        ['`run.json`', 'When the run starts', 'Pipeline, options and times of the run.'],
      ),
      h('Disk space and clean-up'),
      bullets(
        'Plan for about 15 times the genome size (120 Mb produced 1.8 GB).',
        'Deleting a run means deleting its folder; it then leaves the Results tab.',
        'Continuing a run with `filter`, `final` or `anno` needs its step folders: keep them.',
      ),
    ],
  },
  {
    id: 'troubleshooting',
    title: 'Troubleshooting and questions',
    lead:
      'The status of a run comes only from `status.txt`: Warning or ERROR lines in the log ' +
      'do not mean it failed.',
    blocks: [
      h('Normal messages in the log'),
      table(
        ['Message', 'What it means'],
        [
          '`Use of uninitialized value ... cleanup_misclas.pl`',
          'A TE label an EDTA script does not know (such as tRNA); the element is set aside.',
        ],
        ['`Warning: No sequences were masked`', 'A masking pass found nothing to mask.'],
        ['`EMPTY TR_GAG`', 'No TR_GAG elements in this genome.'],
        ['`No ... in RepeatModeler Step`', 'The log itself says it is expected.'],
        ['`Skipping the CDS cleaning step`', 'No CDS file was given (optional).'],
        ['`DRMAA not configured`', 'No computing cluster found; it runs locally instead.'],
      ),
      h('Problems'),
      table(
        ['Problem', 'What to do'],
        [
          'The run failed after a few minutes',
          'Open its log. Most often: FASTA names with `_`, `-`, `/` or `|`, or a damaged file.',
        ],
        ['Status shows Check log', 'Read the end of the log and check the files you need.'],
        ['The run stopped when the computer slept', 'Turn off sleep during runs; start again.'],
        ['The disk filled up', 'Free space on the disk, then start the run again.'],
        ['No e-mail arrives', 'Check the spam folder. The notices on this page always work.'],
        ['A chart shows a note instead', 'The data is too large: use Images or the files.'],
        ['Something else', "Send the run's `log.txt` to the developers."],
      ),
      h('Questions'),
      {
        type: 'list',
        items: [
          { term: 'Can I close the browser during a run?', text: 'Yes, the run goes on.' },
          {
            term: 'Can I turn the computer off?',
            text: 'No. The run is interrupted and must be started again.',
          },
          {
            term: 'Does my data leave my computer?',
            text: 'No. Only the optional e-mail goes out, carrying the log, never the genome.',
          },
          {
            term: 'How do I cite it?',
            text:
              'Cite EDTA-GUI (Costa et al., 2026, BMC Genomics 27:229, ' +
              'https://doi.org/10.1186/s12864-026-12588-z), plus EDTA (Ou et al., 2019, ' +
              'Genome Biology) and panEDTA (Ou et al., 2024, Genome Research).',
          },
        ],
      },
      {
        type: 'link',
        text: 'EDTA wiki: Making sense of EDTA usage and outputs',
        href: 'https://github.com/oushujun/EDTA/wiki/Making-sense-of-EDTA-usage-and-outputs---Q&A',
      },
    ],
  },
]
