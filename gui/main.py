import os, json
import re
from datetime import datetime
import subprocess


from app import create_app, allowed_file
from werkzeug.utils import secure_filename
from flask import render_template, request, redirect, flash, jsonify, Response
from extensions.sendemail import send_email_checking, send_email_complete_annotation, send_email_error_annotation, send_email_pan_checking

app, _ = create_app()

# ===================== Environments ======================
GRAPHIC_DIR = os.path.dirname(os.path.abspath(__file__))
RESULTS_DIR = os.path.join(GRAPHIC_DIR, 'results')
EDTA_DIR = os.path.join(GRAPHIC_DIR, '..')
ANNOTEP_DIR = os.path.join(EDTA_DIR, 'AnnoTEP')
ANNOTEP_SCRIPT_DIR = os.path.join(ANNOTEP_DIR, 'Scripts')

@app.route("/")
def index():
    return render_template("index.html")

@app.route('/annotation_process', methods=['GET','POST'])
def annotation_process():
    # Receiving data from the front-end
    email = request.form.get('email')
    email = email.strip() if email else None
    genome = request.files.get('genome')

    # Extracts the first item from each list or leaves it empty if the list is empty
    speciesTIR = request.form.getlist('tircandidates')[0] if request.form.getlist('tircandidates') else None
    stepsExecuted = request.form.getlist('stepannotation')[0] if request.form.getlist('stepannotation') else None
    modeAnnotation = request.form.getlist('modeAnnotation')[0] if request.form.getlist('modeAnnotation') else None

    directoryResults = request.form.get('directoryResults')

    overwrite = int(request.form.get('overwrite', 0))
    sensitivity = int(request.form.get('sensitivity', 0))
    annotation = int(request.form.get('annotation', 0))
    evaluate = int(request.form.get('evaluate', 0))
    force = int(request.form.get('force', 0))
    tirfilter = int(request.form.get('tirfilter', 0))
    annottype = int(request.form.get('annottype', 0))

    mutation_rate = request.form.get("mutation_rate") 
    max_divergence = request.form.get("max_divergence")
    num_threads = int(request.form.get('thread'))

    cds_file = request.files.get('cds_file')
    curate_lib_file = request.files.get('curate_lib')
    masked_regions_file = request.files.get('masked_region')
    rm_lib_file = request.files.get('rm_lib')
    rmout_file = request.files.get('rmout_lib')

    #Data verification
    if genome.filename == '':
        flash('No selected file')
        return redirect(request.url)
    
    if genome and allowed_file(genome.filename):
        #secure_filename() check if an inject has been applied, if the file contains ../ it will be changed to: ‘ ’ or ‘_’
        filename_genome = secure_filename(genome.filename)
        genome_name, extension = os.path.splitext(filename_genome)

    if directoryResults and directoryResults.strip():
        storageFolder = secure_filename(directoryResults.strip())
        output_dir = os.path.join(RESULTS_DIR, storageFolder)

        status_file = os.path.join(output_dir, 'status.txt')
        if os.path.exists(status_file):
            try:
                os.remove(status_file)
                print(f"status.txt file removed: {status_file}")  # Opcional: para logs
            except Exception as e:
                print(f"Error removing status.txt: {e}")
    else:
        now = datetime.now()
        formatted_date = now.strftime("%Y%m%d-%H%M%S")
        storageFolder = f'{genome_name}_{"".join(formatted_date)}'

        output_dir = os.path.join(RESULTS_DIR, storageFolder)
        os.makedirs(output_dir)

    genome_fasta = f'{genome_name}{extension}'
    genome.save(os.path.join(RESULTS_DIR, storageFolder, genome_fasta))

    save_file(cds_file, output_dir)
    save_file(curate_lib_file, output_dir)
    save_file(masked_regions_file, output_dir)
    save_file(rm_lib_file, output_dir)
    save_file(rmout_file, output_dir)

    params = {
        '--overwrite': overwrite,
        '--anno': annotation,
        '--evaluate': evaluate,
        '--force': force,
        '--u': mutation_rate,
        '--maxdiv': max_divergence,
        '--TIR_filter': tirfilter,
        '--ANNOT_TYPE':annottype,
        '--cds': cds_file.filename if cds_file else '',
        '--curatedlib': curate_lib_file.filename if curate_lib_file else '',
        '--exclude': masked_regions_file.filename if masked_regions_file else '',
        '--rmlib': rm_lib_file.filename if rm_lib_file else '',
        '--rmout': rmout_file.filename if rmout_file else ''
    }

    # Filter out parameters that are empty or have a value of 0
    filtered_params = {key: value for key, value in params.items() if value not in [None, 0, '']}
    # Build the parameter string
    param_str = ' '.join([f"{key} {value}" for key, value in filtered_params.items()])

    #If you have a registered e-mail address, a message will be sent informing you of the data used.
    if email:
        send_email_checking(email, genome_fasta, speciesTIR, stepsExecuted, sensitivity, num_threads, param_str)


    log_file_path = os.path.join(output_dir, "log.txt")
    success = True

    # Final command
    try:
        if modeAnnotation == "edtagui":
            cmds = f"""
                cd {output_dir}

                source $HOME/miniconda3/etc/profile.d/conda.sh && conda activate EDTAgui &&
                export PATH="$HOME/miniconda3/envs/EDTAgui/bin:$PATH" &&
                export PATH="$HOME/miniconda3/envs/EDTAgui/bin/RepeatMasker:$PATH" &&
                export PATH="$HOME/miniconda3/envs/EDTAgui/bin/gt:$PATH" &&
                export PATH="{EDTA_DIR}/util:$PATH" &&

                {EDTA_DIR}/EDTA.pl --genome {genome_fasta} --species {speciesTIR} --step {stepsExecuted} --sensitive {sensitivity} --threads {num_threads} {param_str}
            """
        elif modeAnnotation == "annotep":
            cmds = f"""
                cd {output_dir}
                source $HOME/miniconda3/etc/profile.d/conda.sh && conda activate AnnoTEPgui &&
                export PATH="$HOME/miniconda3/envs/AnnoTEPgui/bin:$PATH" &&
                export PATH="$HOME/miniconda3/envs/AnnoTEPgui/bin/RepeatMasker:$PATH" &&
                export PATH="$HOME/miniconda3/envs/AnnoTEPgui/bin/gt:$PATH" &&
                export PATH="{ANNOTEP_DIR}/util:$PATH" &&
                {ANNOTEP_DIR}/EDTA/EDTA.pl --genome {genome_fasta} --species {speciesTIR} --step {stepsExecuted} --sensitive {sensitivity} --threads {num_threads} {param_str} &&
                echo "################## AnnoTEP annotation completed successfully ##################" &&
                echo " " &&
                echo "################## Starting report and chart generation #######################"
                wait &&
                perl {ANNOTEP_DIR}/Scripts/generate_PLOTs-for-TE-pipe.sh {genome_fasta}
            """

        else:
            raise ValueError("Invalid modeAnnotation value")

        with open(log_file_path, "w") as logfile:
            process = subprocess.Popen(cmds, shell=True, executable='/bin/bash',
                                   stdout=logfile, stderr=logfile)
            process.wait()

        # Check if it failed
        if process.returncode != 0:
            success = False
            badAnnotation = "Error in the annotation step"
        else:
            succeededAnnotation = "Annotation finalised"
            
        with open(os.path.join(output_dir, "status.txt"), "w") as f:
            f.write(succeededAnnotation if success else badAnnotation)

    except Exception as e:
        success = False
        with open(log_file_path, "a") as logfile:
            logfile.write(f"\n\n[Pipeline Error]\n{str(e)}\n")

    finally:
        if email:
            if success:
                send_email_complete_annotation(email, storageFolder, log_file_path)
            else:
                send_email_error_annotation(email, storageFolder, log_file_path)


    print("Finished annotation")
    print("")

    # return render_template("index.html")
    return Response(status=204)

def save_file(file, output_dir):
    if file and file.filename:
        filename = secure_filename(file.filename)
        file.save(os.path.join(output_dir, filename))
        return filename
    return None


@app.route('/annotation_panedta', methods=['POST'])
def annotation_panedta():
    # 1. Lists of genomes and codingds
    genome_files = request.files.getlist('pangenome-file')
    codingds_files = request.files.getlist('codingds-file')

    emailpangenome = request.form.get('emailpangenome')
    email = emailpangenome.strip() if emailpangenome else None

    # 2. Create a list of lines to save in the .cds.list file
    linhas = []
    timestamp = datetime.now().strftime('%Y%m%d-%H%M%S')
    filepangenome = f"genome_{timestamp}.cds.list"
    storageFolder = f"panGenome_{timestamp}"
    output_dir = os.path.join(RESULTS_DIR, storageFolder)
    os.makedirs(output_dir)

    for genome_file, codingds_file in zip(genome_files, codingds_files):
        g_name = genome_file.filename
        c_name = codingds_file.filename if codingds_file and codingds_file.filename else ""

        if g_name:
            # 2a. Build a list line
            linha = f"{g_name}\t{c_name}" if c_name else g_name
            linhas.append(linha)

            # 2b. Save genome file
            genome_path = os.path.join(output_dir, g_name)
            genome_file.save(genome_path)

            # 2c. save codingds file if it exists
            if c_name:
                codingds_path = os.path.join(output_dir, c_name)
                codingds_file.save(codingds_path)
                # linha = f"{genome_path}\t{codingds_path}"
                linha = f"{g_name}\t{c_name}"
            else:
                linha = genome_path
            
            # 2a. Build a list line (com caminhos completos agora!)
            linhas.append(linha)

    # 3. save the .cds.list file
    save_path = os.path.join(output_dir, filepangenome)
    with open(save_path, 'w') as f:
        f.write('\n'.join(linhas))

    # 4. capture additional parameters
    cds_file = request.files.get('cdspangenome_file')
    nlib_file = request.files.get('nlibrary_file')
    threadspan = request.form.get('threadspangenome')
    tecopies = request.form.get('tecopies_number')

    # 5. save additional files
    cds_filename = cds_file.filename
    cds_path = os.path.join(output_dir, cds_filename)
    cds_file.save(cds_path)

    if nlib_file and nlib_file.filename:
        nlib_filename = nlib_file.filename
        nlib_path = os.path.join(output_dir, nlib_filename)
        nlib_file.save(nlib_path)
        lib_param = f"-l {nlib_filename}"
    else:
        lib_param = ""

    if email:
        send_email_pan_checking(email, filepangenome, cds_filename, lib_param, threadspan, tecopies)
    
    log_file_pangenome = os.path.join(output_dir, "log.txt")
    success = True

    # Final command
    try:
        cmds = f"""
            source $HOME/miniconda3/etc/profile.d/conda.sh && conda activate EDTAgui &&
            export PATH="$HOME/miniconda3/envs/EDTAgui/bin:$PATH" &&
            export PATH="$HOME/miniconda3/envs/EDTAgui/bin/RepeatMasker:$PATH" &&
            export PATH="$HOME/miniconda3/envs/EDTAgui/bin/gt:$PATH" &&
            export PATH="{EDTA_DIR}/util:$PATH" &&

            sh {EDTA_DIR}/panEDTA.sh -g {filepangenome} -c {cds_filename} {lib_param} -t {threadspan} -f {tecopies} -o 1
        """

        with open(log_file_pangenome, "w") as logfile:
            process = subprocess.Popen(
                ["/bin/bash", "-c", cmds],
                stdout=logfile,
                stderr=logfile,
                cwd=output_dir
            )
            process.wait()

        # Check if it failed
        if process.returncode != 0:
            success = False
            badAnnotation = "Error in the annotation step"
        else:
            succeededAnnotation = "Annotation finalised"
            
        with open(os.path.join(output_dir, "status.txt"), "w") as f:
            f.write(succeededAnnotation if success else badAnnotation)

    except Exception as e:
        success = False
        with open(log_file_pangenome, "a") as logfile:
            logfile.write(f"\n\n[Pipeline Error]\n{str(e)}\n")

    finally:
        if email:
            if success:
                send_email_complete_annotation(email, storageFolder, log_file_pangenome)
            else:
                send_email_error_annotation(email, storageFolder, log_file_pangenome)


    print("Finished annotation")
    print("")

    return Response(status=204)

@app.route("/status")
def status():
    subfolders = sorted(
        [os.path.join(RESULTS_DIR, p) for p in os.listdir(RESULTS_DIR)],
        key=lambda p: os.path.getctime(p),
        reverse=True
    )[:10]

    data = [read_page_status(p) for p in subfolders]
    return jsonify(data)

def read_page_status(folder):
    try:
        log_path = os.path.join(folder, "log.txt")
        status_path = os.path.join(folder, "status.txt")
        
        start_time = extract_folder_time(os.path.basename(folder))

        status = {
            "name": os.path.basename(folder),
            "start": start_time,
            "completed": False,
            "end": None,
            "results": None,
            "last_lines_log": read_last_lines_log(log_path) if os.path.exists(log_path) else []
        }

        if os.path.exists(status_path):
            status["completed"] = True
            status["end"] = os.path.getmtime(status_path)

            try:
                with open(status_path, 'r') as f:
                    status["results"] = f.read().strip()
            except Exception as e:
                status["results"] = f"Erro ao ler status: {str(e)}"

        return status
        
    except Exception as e:
        return {
            "nome": os.path.basename(folder),
            "erro": str(e)
        }

def read_last_lines_log(log_path, num_lines=20):
    try:
        with open(log_path, "r") as f:
            lines = f.readlines()
            # Returns the last `num_lines` of the file, and ensures that each line has a date/time
            return [line.strip() for line in lines[-num_lines:]]  # Remove line breaks
    except FileNotFoundError:
        return []

def extract_folder_time(name_folder):
    # Regular expression to extract the ‘YYYYMMDD-HHMMSS’ part of the folder name
    match = re.search(r"(\d{8}-\d{6})$", name_folder)
    
    if match:
        # Extracts the part of the folder name that contains the date and time
        data_str = match.group(1)
        
        # Converts the date string to a datetime object
        try:
            time = datetime.strptime(data_str, "%Y%m%d-%H%M%S")
            
            # Returns the ISO format to be understood by JavaScript
            return time.isoformat()
        except ValueError:
            return None  # If unable to convert, returns None
    return None  # If you don't find the expected format
    

if __name__ == "__main__":
    app.run(debug=True)
