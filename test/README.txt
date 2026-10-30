Test data of EDTA-GUI
=====================

Files
-----
genome.fa             1 Mb toy genome (rice Chr2), for the EDTA mode (a few minutes)
genome.cds.fa         coding sequences of the toy genome
genome.exclude.bed    regions excluded from TE masking
Col.test.fa, Ler.test.fa, Alyrata.test.fa
                      1 Mb toy genomes for panEDTA
genome.cds.list       genome list for panEDTA (genome and, optionally, its CDS file per line)
TAIR10_chr1.fa        chromosome 1 of Arabidopsis thaliana (TAIR10, 30.4 Mb), for the
                      AnnoTEP mode (about 1h20 with 10 threads)

The toy genomes are too small for the complete AnnoTEP mode, which ends with an error on
them: use TAIR10_chr1.fa to test AnnoTEP.

The pipelines write their results in the current folder. Copy the test files to a work
folder first, so the results do not mix with the repository:

    mkdir -p ~/edta-test && cp ~/EDTA-GUI/test/* ~/edta-test/ && cd ~/edta-test

(~/EDTA-GUI is the folder of the repository; change it if yours is elsewhere.)


Graphical interface
-------------------
Start it with EDTA-GUI (conda installation) or bash start.sh (Docker), then:

EDTA mode
  Pipeline mode: EDTA
  Genome sequence: genome.fa
  Advanced options: Overwrite, Sensitivity and Annotation on
  Coding DNA sequence: genome.cds.fa
  Curated library: rice7.0.0.liban (folder database/ of the repository)
  Exclusion of masked regions: genome.exclude.bed

AnnoTEP mode
  Pipeline mode: AnnoTEP
  Genome sequence: TAIR10_chr1.fa

panEDTA-GUI
  Genome data: Col.test.fa with CDS genome.cds.fa, and Ler.test.fa (no CDS)
  Coding DNA sequence: genome.cds.fa
  Non-redundant library: athrep.updated.nonredun.fasta (folder database/)


Command line (conda installation: bash ~/EDTA-GUI/install.sh)
------------------------------------------------------------
No "conda activate" is needed. Run in the work folder:

# EDTA
nohup EDTA --genome genome.fa --cds genome.cds.fa --curatedlib ~/EDTA-GUI/database/rice7.0.0.liban --exclude genome.exclude.bed --overwrite 1 --sensitive 1 --anno 1 --evaluate 1 --threads 10 > EDTA.test 2>&1 &

# AnnoTEP (also writes the charts and reports in REPORT/)
nohup AnnoTEP --genome TAIR10_chr1.fa --species others --step all --sensitive 1 --anno 1 --threads 10 > AnnoTEP.test 2>&1 &

# panEDTA
nohup panEDTA -g genome.cds.list -c genome.cds.fa -l ~/EDTA-GUI/database/athrep.updated.nonredun.fasta -t 10 -f 3 > panEDTA.test 2>&1 &

Follow the progress with: tail -f EDTA.test   (or AnnoTEP.test, panEDTA.test)


Command line with Docker (image annotep/edta-gui:v2.0)
------------------------------------------------------
Run in the work folder (it becomes /data inside the container):

docker run --rm -u $(id -u):$(id -g) --pids-limit 300000 --memory-swap -1 -v "$PWD":/data -w /data annotep/edta-gui:v2.0 EDTA --genome genome.fa --cds genome.cds.fa --curatedlib /usr/local/EDTA/database/rice7.0.0.liban --exclude genome.exclude.bed --overwrite 1 --sensitive 1 --anno 1 --evaluate 1 --threads 10 > EDTA.test 2>&1

docker run --rm -u $(id -u):$(id -g) --pids-limit 300000 --memory-swap -1 -v "$PWD":/data -w /data annotep/edta-gui:v2.0 AnnoTEP --genome TAIR10_chr1.fa --species others --step all --sensitive 1 --anno 1 --threads 10 > AnnoTEP.test 2>&1


Command line with Singularity / Apptainer
-----------------------------------------
Convert the image once (singularity build edta-gui_v2.0.sif docker://annotep/edta-gui:v2.0),
then run in the work folder:

singularity exec edta-gui_v2.0.sif AnnoTEP --genome TAIR10_chr1.fa --species others --step all --sensitive 1 --anno 1 --threads 10 > AnnoTEP.test 2>&1


If a test finishes without errors (warnings are OK), the installation is correct.
