# Table of contents
* [Introduction](#introduction)
* [Installing with library and conda](#installing-with-library-and-conda)
* [Running AnnoTEP from the command line](#running-annotep-from-the-command-line)
    * [Download the test genome](#download-the-test-genome)
    * [Way 1 – Traditional (step by step)](#way-1--traditional-step-by-step)
    * [Way 2 – Automated (AnnoTEP command)](#way-2--automated-annotep-command)
    * [Tips](#tips)
* [Installing with Container](#installing-with-container)
    * [Docker](#docker)
    * [Singularity](#singularity)
* [Results](#results)
<br>

# Introduction
EDTA-GUI in AnnoTEP mode is designed for the annotation of transposable elements (TEs) in plant genomes. Built upon the [EDTA pipeline](https://github.com/oushujun/EDTA), the tool incorporates specific modifications inspired by the [Plant genome Annotation pipeline](https://github.com/amvarani/Plant_Annotation_TEs), as well as adjustments that enhance its performance and flexibility.

In addition to its GitHub repository, AnnoTEP mode also provides a dedicated [Database](https://plantgenomics.ncc.unesp.br/AnnoTEP-DB/) for plant genomes.

This page covers the command line. To use the graphical interface, see the [main README](../README.md).

### Functions of EDTA-GUI in AnnoTEP mode
* Enhancement in the detection of LTRs, LINEs, TIRs, and Helitrons.
* Improved identification and classification of non-autonomous LTRs, such as TRIM, LARD, TR-GAG, and BARE2.
* Detection of solo LTRs.
* Classification of lineages belonging to the Copia and Gypsy superfamilies.
* Classification of Helitrons into autonomous and non-autonomous.
* Optimisation of repetitive sequence masking.
* Generation of TE classification reports.
* Creation of repeat landscape plots, histograms, and phylogenetic trees of LTR lineages.

<br>

##  Installing with library and conda

> [!TIP]
> **Installing Miniconda**
><br>
> * Download [Miniconda3](https://docs.conda.io/projects/miniconda/en/latest/)
> * After downloading Miniconda from the link above, run the following command in your terminal:
> ```sh
> bash Miniconda3-latest-Linux-x86_64.sh
> ```

📌 Once Miniconda is installed, download the repository and run the installer:
```sh
git clone https://github.com/Marcos-Fernando/EDTA-GUI.git $HOME/EDTA-GUI
bash $HOME/EDTA-GUI/install.sh
```

The installer creates the conda environments (`annotepgui_3_11` for AnnoTEP, `EDTAgui` for EDTA and panEDTA), makes RepeatMasker accept sequence names up to 80 characters (`maxIDLength` 50 → 80) and installs the `AnnoTEP`, `EDTA`, `panEDTA` and `EDTA-GUI` commands. It needs no `sudo`.

> [!IMPORTANT]
> The AnnoTEP mode must be run within the `annotepgui_3_11` environment; using the `EDTAgui` environment may result in errors. The `AnnoTEP` command picks the right environment by itself.

📎 Return to [Table of contents](#table-of-contents)

## Running AnnoTEP from the command line
There are two ways to run an annotation. Both give the same results:

| | Way 1 – Traditional | Way 2 – Automated |
|---|---|---|
| Environment | `conda activate annotepgui_3_11` | not needed |
| Annotation | `.../AnnoTEP/EDTA/EDTA.pl ...` | `AnnoTEP ...` |
| Charts and reports | run `generate_PLOTs-for-TE-pipe.sh` afterwards | run at the end, by the same command |
| Where it works | any folder, with the full path to the scripts | any folder |

### Download the test genome

🧬 _Arabidopsis thaliana_
* Download the TAIR10_chr_all.fas.gz file from the [TAIR](https://www.arabidopsis.org/download/list?dir=Genes%2FTAIR10_genome_release%2FTAIR10_chromosome_files) website and extract its contents.

```sh
gzip -d TAIR10_chr_all.fas.gz
cat TAIR10_chr_all.fas | cut -f 1 -d" " > At.fasta
rm TAIR10_chr_all.fas
```

> [!TIP]
> For a quicker test, the repository already has chromosome 1 of TAIR10: `$HOME/EDTA-GUI/test/TAIR10_chr1.fa` (about 1 h 20 min with 10 threads).

### Way 1 – Traditional (step by step)
**Step 1.** Activate the environment and make the AnnoTEP helper scripts visible (such as `break_fasta.pl`):
```sh
conda activate annotepgui_3_11
export PATH="$PATH:$HOME/EDTA-GUI/AnnoTEP/EDTA/util:$HOME/EDTA-GUI/AnnoTEP/Scripts"
```

**Step 2.** Create a folder for the analysis and run EDTA in AnnoTEP mode on the downloaded genome:
```sh
mkdir Athaliana
cd Athaliana

nohup $HOME/EDTA-GUI/AnnoTEP/EDTA/EDTA.pl --genome ../At.fasta --species others --step all --sensitive 1 --anno 1 --threads 20 -u 7.0e-9 > EDTA.log 2>&1 &
```

**Step 3.** Monitor the progress
```sh
tail -f EDTA.log
```

**Step 4.** Generate the charts and reports: when the annotation finishes, with the environment still active and inside the same folder, run the script below with the name of the input genome (e.g., At.fasta):
```sh
bash $HOME/EDTA-GUI/AnnoTEP/Scripts/generate_PLOTs-for-TE-pipe.sh At.fasta
```

> [!TIP]
> Make sure to replace ``At.fasta`` with the name of the input genome file you wish to process, if it is different. To run the script again, delete the `REPORT` folder first (`rm -rf REPORT`).

### Way 2 – Automated (AnnoTEP command)
The `AnnoTEP` command, installed by `install.sh`, does Steps 1 to 4 in a single line: it uses the `annotepgui_3_11` environment without `conda activate`, finds the helper scripts and, at the end, generates the charts and reports in `REPORT/`.

```sh
mkdir Athaliana
cd Athaliana

nohup AnnoTEP --genome ../At.fasta --species others --step all --sensitive 1 --anno 1 --threads 20 -u 7.0e-9 > AnnoTEP.log 2>&1 &
tail -f AnnoTEP.log
```

* The options are the same as in Way 1 and are passed unchanged to `EDTA.pl`. `AnnoTEP --help` shows all of them.
* The charts need the genome-wide annotation (`--anno 1`); without it, they are skipped.
* With `nohup`, the run keeps going after the terminal is closed.

### Tips

> [!TIP]
>
> 📌 <b>Adjust the number of threads - </b>  Set the number of threads ``--threads`` according to the capacity of your machine or server. For optimal performance, use the maximum available. In the example above, it is set to 20.
> <br>
> 📌 <b> Improving TE detection - </b> Enable ``--sensitive 1``. for more accurate TE detection and annotation. This option runs RepeatModeler to identify additional TEs and repeat sequences, and it also provides Superfamily and Lineage-level classifications.
> <br>
> 📌 <b>Enhancing genome analysis with mutation rate - </b> For a more refined analysis of TE insertion age, we recommend setting the mutation rate using the ``-u <float>``parameter. Suggested values and detailed explanations can be found in the Genome section of the [AnnoTEP](https://plantgenomics.ncc.unesp.br/AnnoTEP-DB/). <br>
> <br>
> 📌 <b>Diploid or polyploid genomes - </b> Add ``--run_LAI 0``. The LAI (LTR Assembly Index) is only valid for haploid assemblies, and it is calculated by default. On haplotype-phased assemblies (all copies of each chromosome in the FASTA), this step can run for days and use up all the memory of the server.
> <br>
> 📌 <b>Redoing part of the analysis - </b> Run again in the same folder with ``--step`` (`filter`, `final` or `anno`) to restart from a specific step.
>

> [!Important]
>
> Please use simpe fasta headers! For example: >chr01, >scf001, >ctg001 and etc.
> 
> Do not use (NEVER) characters like "_" , "-" , "/" , "|" , for example >chr_001, >scf-001, >ctg|001 and etc!
> 
> The pipeline may crash if you dont't use simple fasta headers acording the above instructions!


> [!NOTE]
> Non-autonomous elements (e.g., non-autonomous LARDs and Helitrons) can carry passenger genes. For proper genome annotation, these elements must be partially masked. The modified EDTA pipeline handles this automatically and generates a softmasked genome sequence, available in the EDTA folder as ``$genome-Softmasked.fa`` .

📎 Return to [Table of contents](#table-of-contents)

---
# Installing with Container

> [!IMPORTANT] 
> <b> Prerequisites </b> <br>
> - 🐳 [Docker](https://docs.docker.com/engine/install/)
> - 📦 [Singularity](https://docs.sylabs.io/guides/3.5/user-guide/quick_start.html)

The image `annotep/edta-gui:v2.0` has the interface and the command line. Nothing else needs to be installed.

## Docker
**Step 1. Download the image** (about 9 GB, only once):
```sh
docker pull annotep/edta-gui:v2.0
```

**Step 2. Run AnnoTEP.** As with conda, there are two ways:

📌 **Traditional – full `docker run` command:** run it inside the folder that has the genome:
```sh
docker run --rm -u $(id -u):$(id -g) --pids-limit 300000 --memory-swap -1 -v "$PWD":/data -w /data annotep/edta-gui:v2.0 AnnoTEP --genome At.fasta --species others --step all --sensitive 1 --anno 1 --threads 20 -u 7.0e-9
```

>[!TIP]
> ### Description:
> - ``-u $(id -u):$(id -g)``: the results belong to your user, not to root.
> - ``--pids-limit 300000 --memory-swap -1``: large genomes start many processes. Without these limits, Docker may stop the analysis. Use threads × 10 000 for ``--pids-limit`` (e.g., 12 threads → 120 000).
> - ``-v "$PWD":/data -w /data``: the current folder is the working folder inside the container. The genome must be in it, and the results are written to it.
> - ``AnnoTEP ...``: the same command and options as in [Way 2](#way-2--automated-annotep-command), including the charts at the end.

📌 **Automated – short command:** download `start.sh` and install the `AnnoTEP` command once:
```sh
wget https://raw.githubusercontent.com/Marcos-Fernando/EDTA-GUI/main/gui/start.sh
bash start.sh install-cli
```
Then, in any folder:
```sh
AnnoTEP --genome At.fasta --species others --step all --sensitive 1 --anno 1 --threads 20 -u 7.0e-9
```
* If the conda installation is also present, the command is installed as `AnnoTEP-docker`, so both can be used.
* The container only sees the current folder (and its subfolders): a file outside it (for example `../At.fasta`) is refused with a message. Copy it into the folder first.
* `bash start.sh uninstall-cli` removes the command.

📎 Return to [Table of contents](#table-of-contents)
<br>

## Singularity
You can use AnnoTEP with Singularity by converting the official Docker image.

**Step 1. Obtaining the Singularity Image** (choose one):
```sh
# directly from Docker Hub
singularity build edta-gui_v2.0.sif docker://annotep/edta-gui:v2.0

# from a .tar file (to take the image to a computer without internet)
docker save annotep/edta-gui:v2.0 -o edtagui2.tar
singularity build edta-gui_v2.0.sif docker-archive://edtagui2.tar
```

>[!TIP]
> ### Description:
> - ``edta-gui_v2.0.sif``: you can name the image anything you like; the extension must be ``.sif``.
> - ``docker://``: the image is pulled from a remote repository (e.g. Docker Hub).
> - ``docker-archive://``: the image is built from a local ``.tar`` archive.

**Step 2. Running the Image:** inside the folder that has the genome:
```sh
singularity exec edta-gui_v2.0.sif AnnoTEP --genome At.fasta --species others --step all --sensitive 1 --anno 1 --threads 20 -u 7.0e-9
```

> [!TIP]
> Singularity has no ``--pids-limit``: for large genomes, run ``ulimit -u 300000`` first (threads × 10 000).

📎 Return to [Table of contents](#table-of-contents)
<br>

# Results
In addition to FASTA libraries, GFF3 files, and softmasking outputs, AnnoTEP also generates informative graphs and detailed reports based on the data obtained during the annotation process.

## REPORT
The **REPORT** directory is generated at the end of the annotation process and contains a comprehensive set of reports and visualisations. Within this directory, you will find both detailed and summary reports that hierarchically classify transposable elements (TEs) by order, superfamily, and autonomy; Bubble and bar charts representing the TE classification; Repeat landscape plots generated using Kimura distance calculations; LTR age distribution charts, showing the estimated insertion times of LTR superfamilies; and Phylogenetic trees of LTR elements.

📎 Return to [Table of contents](#table-of-contents)
