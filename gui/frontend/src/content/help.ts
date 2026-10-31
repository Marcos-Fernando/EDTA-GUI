/**
 * Help texts migrated from the legacy GUI (templates/index.html, helpSidebar1–9
 * and the page introductions). Typos fixed: "Email Adress", "librar",
 * "SOptional", "acclerate", "a optional", "Browser" → "Browse".
 */

export type HelpBlock =
  | { type: 'p'; text: string }
  | { type: 'h'; text: string }
  | { type: 'list'; items: { term?: string; text: string }[] }
  | { type: 'link'; text: string; href: string }

export interface HelpTopic {
  title: string
  blocks: HelpBlock[]
}

const p = (text: string): HelpBlock => ({ type: 'p', text })
const h = (text: string): HelpBlock => ({ type: 'h', text })
const list = (...items: { term?: string; text: string }[]): HelpBlock => ({ type: 'list', items })

const EMAIL_TEXT =
  'Enter a valid email address to receive notifications about the status of the analysis. ' +
  'This field is optional. While the email facilitates communication, the annotation runs ' +
  'locally, so keep the system running during the process.'

const MONITOR_TEXT = 'You can also monitor the progress of the annotation in the "Results" tab.'

/** README: simple FASTA headers are required. */
export const FASTA_HEADER_NOTE =
  'Use simple FASTA headers, e.g. >chr01, >scf001, >ctg001. Never use characters such as ' +
  '"_", "-", "/" or "|" (e.g. >chr_001): the pipeline may crash.'

export const HELP = {
  welcomeEdta: {
    title: 'About EDTA-GUI',
    blocks: [
      p(
        'Welcome to EDTA-GUI. This version provides a graphical interface that streamlines your ' +
          'work and research in annotating transposable elements. The performance of the ' +
          "annotation process depends on your machine's specifications, so ensure it remains " +
          'powered on during execution. For any questions or further information, use the help icons.',
      ),
    ],
  },

  welcomePan: {
    title: 'About panEDTA-GUI',
    blocks: [
      p(
        'This is the serial version of panEDTA. Each genome will be annotated sequentially and ' +
          'then combined with the panEDTA functionality. Existing EDTA annotation of genomes ' +
          '(EDTA run with --anno 1) will be recognized and reused. A way to accelerate the ' +
          'pan-genome annotation is to run the EDTA-GUI annotation of each genome separately and ' +
          'in parallel, then run panEDTA-GUI to finish the remaining runs. To help filter out ' +
          'gene-related sequences, at least one CDS file is required. Please read the wiki for ' +
          'the CDS requirement. You may want to check out the toy example in the ./test folder ' +
          'to get familiarized.',
      ),
      {
        type: 'link',
        text: 'EDTA wiki: Making sense of EDTA usage and outputs',
        href: 'https://github.com/oushujun/EDTA/wiki/Making-sense-of-EDTA-usage-and-outputs---Q&A',
      },
    ],
  },

  inputEdta: {
    title: 'Input data',
    blocks: [
      h('Email address'),
      p(EMAIL_TEXT),
      p(MONITOR_TEXT),
      h('Genome data'),
      p(
        'Upload the input file containing the complete genomic sequence in FASTA format. ' +
          'Use the "Browse" button to select the file from the local system.',
      ),
      p(FASTA_HEADER_NOTE),
      h('Run name'),
      p(
        'Optional name of the results folder. The date and time are always added, as in ' +
          '"TAIR10_test_20261031-102519". If left empty, the genome name is used. Use letters, ' +
          'numbers, ".", "_" or "-", without spaces. When continuing a previous run (Steps to ' +
          'run other than "all"), its folder is kept and the field is hidden.',
      ),
      h('Run test analysis'),
      p(
        'Checks the installation with chromosome 1 of Arabidopsis thaliana (TAIR10_chr1.fa, ' +
          '30 Mb, from the test/ folder of the repository), in the selected mode. After a ' +
          'confirmation, the form is filled in (run name "Test_genome", Sensitivity and ' +
          'Annotation on, so the charts are made) and the run starts. The e-mail and the number ' +
          'of threads are kept. With 10 threads it takes about 1 hour in EDTA mode and about ' +
          '1 h 20 min in AnnoTEP mode.',
      ),
    ],
  },

  mode: {
    title: 'Mode',
    blocks: [
      p('Specifies which annotation tool you wish to use. The available options are:'),
      list(
        {
          term: 'EDTA',
          text:
            'Provides annotation of transposable elements in eukaryotic genomes. Performs de novo ' +
            'detection and general classification of different TE classes. This is the default ' +
            'option for genomes of any eukaryotic organism.',
        },
        {
          term: 'AnnoTEP',
          text:
            'Provides specialised annotation of transposable elements in plant genomes. A version ' +
            'of EDTA adapted for high accuracy in identifying all classes, including autonomous ' +
            'and non-autonomous elements, as well as LTR lineages in plant genomes. Produces ' +
            'charts, detailed reports, and phylogenetic trees from the results. In this mode, ' +
            'Sensitivity and Annotation are always enabled.',
        },
      ),
    ],
  },

  species: {
    title: 'Species specification to identify TIR candidates',
    blocks: [
      p('The options include:'),
      list(
        { term: 'others', text: 'For species other than rice or maize (default).' },
        { term: 'rice', text: 'For rice genomes.' },
        { term: 'maize', text: 'For maize genomes.' },
      ),
    ],
  },

  steps: {
    title: 'Steps to be executed',
    blocks: [
      p('Select which parts of the pipeline will be executed:'),
      list(
        { term: 'all', text: 'Runs the entire pipeline (default).' },
        { term: 'filter', text: 'Starts from raw TEs to the end.' },
        { term: 'final', text: 'Begins with filtered TEs to completion.' },
        { term: 'anno', text: 'Conducts genome-wide annotation after building the TE library.' },
      ),
      p(
        'When selecting "filter", "final" or "anno", choose the previous run whose annotation ' +
          'step was processed. The run is continued in its own folder, and the genome already ' +
          'stored there is used unless you select a new one.',
      ),
      p('Run folders are located in one of the following directories:'),
      list(
        {
          term: 'Docker installation (start.sh)',
          text: '~/results-edtagui, in your home folder, or the folder set with EDTA_GUI_RESULTS.',
        },
        { term: 'Repository installation', text: 'EDTA-GUI/gui/backend/results' },
      ),
      p('The page of each run shows its exact folder, with a button to copy it.'),
    ],
  },

  runParameters: {
    title: 'Run parameters',
    blocks: [
      p('Species and Steps to run have their own help icons. The numeric parameters are:'),
      list(
        {
          term: 'Mut. rate (-u)',
          text:
            'Set the neutral mutation rate for calculating the age of intact LTR elements ' +
            '(default: 1.3e-8 per bp per year, based on rice).',
        },
        {
          term: 'Max div. (%)',
          text:
            'Define the maximum acceptable divergence (0–100%) for TE fragments. For highly ' +
            'repetitive genomes, users are encouraged to adjust the parameter (default: 40).',
        },
        {
          term: 'Threads',
          text: 'Number of threads used to run the pipeline (default and minimum: 10).',
        },
      ),
      p('Mut. rate and Max div. are left out of the command while they keep their default values.'),
    ],
  },

  parameters: {
    title: 'Advanced options',
    blocks: [
      h('EDTA mode'),
      list(
        { term: 'Overwrite', text: 'Decide whether existing output data should be overwritten.' },
        {
          term: 'Sensitivity',
          text: 'Control the execution of RepeatModeler to identify additional elements.',
        },
        {
          term: 'Annotation',
          text:
            'Specify whether the genome-wide annotation of TEs should proceed after building ' +
            'the TE library. In EDTA mode it also enables the charts and reports (REPORT/).',
        },
        {
          term: 'Evaluate',
          text:
            'Check if the classification of annotated TEs is consistent. Enabling it also ' +
            'enables "Annotation".',
        },
        {
          term: 'MAKER mask',
          text:
            'Also write a lightly masked genome (MAKER.masked) for gene annotation with MAKER. ' +
            'Only long, low-divergence TEs are masked. Enabling it also enables "Annotation". ' +
            'In AnnoTEP mode this file is always written.',
        },
        {
          term: 'Force',
          text:
            'If no reliable TE candidates are identified, enabling this option allows the ' +
            'script to continue using a backup rice TE library.',
        },
      ),
      h('AnnoTEP mode (additional features)'),
      list(
        {
          term: 'TIR filter',
          text:
            'Filter TIRs without annotated domains. Enabling this filter can substantially ' +
            'reduce false positives, but may also result in the loss of some true positives ' +
            '(false negatives).',
        },
        {
          term: 'Annot. type',
          text:
            'Specify whether to annotate the genome using a RepeatMasker-based library. ' +
            'Enabling this option may negatively affect the filtering step and compromise ' +
            'benchmark results.',
        },
        {
          term: 'Run LAI',
          text:
            'LAI calculations must be performed on haploid assemblies. If you have a diploid ' +
            'or polyploid genome, we recommend disabling this option.',
        },
      ),
    ],
  },

  extraFiles: {
    title: 'Additional input files',
    blocks: [
      p('Optional files to customise the analysis:'),
      list(
        {
          term: 'Coding DNA sequence',
          text:
            'A FASTA file containing the coding sequence (without introns, UTRs, or TEs) of the ' +
            'genome or a close relative. This helps in excluding non-transposable elements.',
        },
        {
          term: 'Curated library',
          text:
            'A curated library to maintain consistent TE naming and classification. Only ' +
            'manually validated TEs should be provided.',
        },
        {
          term: 'Exclusion of masked regions',
          text:
            'Regions (BED), such as known genes, left unmasked in the MAKER.masked genome. ' +
            '"Annotation" must be enabled to use this option, and in EDTA mode also "MAKER mask".',
        },
        {
          term: 'RepeatModeler library',
          text:
            'A classified RepeatModeler library to enhance analysis sensitivity, particularly ' +
            'for LINEs. If not provided, one will be generated automatically.',
        },
        {
          term: 'RepeatMasker library',
          text:
            'Your own homology-based TE annotation in RepeatMasker .out format. This file will ' +
            'be merged with the structure-based annotation. "Annotation" must be enabled.',
        },
      ),
    ],
  },

  inputPan: {
    title: 'Input data',
    blocks: [
      h('Email address'),
      p(EMAIL_TEXT),
      p(MONITOR_TEXT),
      h('Genome data'),
      p(
        'Upload the input file containing the complete genome sequence in FASTA format, along ' +
          'with a corresponding CDS file (optional). You must provide at least one genome file. ' +
          'A CDS file is only valid when linked to a genome in the same row. Use the "+" button ' +
          'to add more rows for additional genome and CDS files, and the "−" button to remove ' +
          'an added row.',
      ),
      p(FASTA_HEADER_NOTE),
      h('Run test analysis'),
      p(
        'Checks the installation with the panEDTA toy example of EDTA: Col.test.fa (with ' +
          'genome.cds.fa) and Ler.test.fa, CDS genome.cds.fa and the library ' +
          'athrep.updated.nonredun.fasta, from the test/ and database/ folders of the ' +
          'repository. After a confirmation, the form is filled in and the run starts. The ' +
          'e-mail and the number of threads are kept. With 10 threads it takes about 5 min.',
      ),
    ],
  },

  panFeatures: {
    title: 'Additional features',
    blocks: [
      p('Advanced configuration options for the analysis.'),
      list(
        {
          term: 'Coding DNA sequence',
          text:
            'Required. A coding sequence file in FASTA format. It fills in any missing CDS files ' +
            'from the genome list. If no CDS files are specified in the genome list, this CDS ' +
            'file will be applied to all genomes.',
        },
        {
          term: 'Non-redundant library',
          text:
            'Optional. A manually curated non-redundant library following the RepeatMasker ' +
            'naming convention.',
        },
        {
          term: 'Threads',
          text: 'Number of threads used to run panEDTA-GUI (default and minimum: 10).',
        },
        {
          term: 'Minimum number of full-length TE copies in individual genomes',
          text:
            'Defines the minimum number of full-length TE copies required in individual genomes ' +
            'for them to be considered as candidate TEs for the pangenome. Lower values are more ' +
            'inclusive, resulting in a larger library, higher sensitivity, but increased ' +
            'inconsistency. Higher values are more stringent, leading to a smaller library, ' +
            'reduced sensitivity, and greater consistency (default and minimum: 3).',
        },
      ),
    ],
  },

  results: {
    title: 'Latest activities',
    blocks: [
      p('This page displays key information such as:'),
      list(
        { text: 'The name of the run folder;' },
        { text: 'Start and end timestamps (when available);' },
        { text: 'The current status of the annotation (in progress, completed, failed);' },
        { text: 'The last lines of the annotation log.' },
      ),
      h('Note 1'),
      p(
        'All results and output files are stored in the results directory (in Docker, the ' +
          'volume you mapped to it). Ensure this path is correctly mounted to access the data.',
      ),
      h('Note 2'),
      p(
        'Errors may occasionally occur during the annotation process. A run reported as ' +
          'completed is checked for its final message; if the message is missing, a warning is ' +
          'shown. The expected final messages are:',
      ),
      list(
        {
          term: 'EDTA',
          text:
            '"The generation of charts and reports has been completed" with "Annotation" on, ' +
            'or "EDTA final stage finished!" without it; ' +
            '"panEDTA annotation of genome_<date>.cds.list is finished!" for panEDTA.',
        },
        { term: 'AnnoTEP', text: '"The generation of charts and reports has been completed".' },
      ),
    ],
  },
} satisfies Record<string, HelpTopic>

export type HelpKey = keyof typeof HELP
