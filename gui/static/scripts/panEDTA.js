const container = document.getElementById('list-pangenome');
const addButton = document.getElementById('add-genome');

// Adds event delegates to the container
container.addEventListener('click', function(e) {
    if (e.target.classList.contains('remove-group')) {
        const groupToRemove = e.target.closest('.box-group');
        if (!groupToRemove.classList.contains('original-group')) {
            container.removeChild(groupToRemove);
        }
    }
});

// Function to add a new group of inputs
addButton.addEventListener('click', () => {
    const lastGroup = container.querySelector('.box-group:last-of-type');
    const clone = lastGroup.cloneNode(true);
    
    // Remove all event listeners from the cloned group
    const newRemoveBtn = document.createElement('button');
    newRemoveBtn.className = 'remove-group';
    newRemoveBtn.textContent = '-';
    
    // Replace and existing button
    const existingBtn = clone.querySelector('.remove-group');
    if (existingBtn) {
        clone.removeChild(existingBtn);
    }
    
    clone.appendChild(newRemoveBtn);
    
    // Clear all input
    const inputs = clone.querySelectorAll('input');
    inputs.forEach(input => {
        if (input.type !== 'button') {
            input.value = '';
        }
    });
    
    container.appendChild(clone);
});



// Updates the names of the selected files
container.addEventListener('change', function (event) {
  const target = event.target;

  if (target.classList.contains('input-pangenome')) {
    const textInput = target.closest('.box-input').querySelector('.input-text2');
    textInput.value = target.files.length > 0 ? target.files[0].name : '';
  }

  if (target.classList.contains('input-codingds')) {
    const textInput = target.closest('.box-input').querySelector('.input-codingds-text');
    textInput.value = target.files.length > 0 ? target.files[0].name : '';
  }
});



// Whatever is selected in the browser will be displayed in the text input field.
document.getElementById('list-pangenome').addEventListener('change', function (event) {
    if (event.target.classList.contains('input-pangenome')) {
        const fileInput = event.target;
        const textInput = fileInput.closest('.box-input').querySelector('.input-text2');

        if (fileInput.files.length > 0) {
            textInput.value = fileInput.files[0].name;
        } else {
            textInput.value = '';
        }
    }
});

// Whatever is selected in the browser will be displayed in the text input field.
document.addEventListener("DOMContentLoaded", () => {
  const cdsInputFile = document.getElementById("cdspangenome");
  const cdsInputText = document.getElementById("cdspangenomeInput");

  cdsInputFile.addEventListener("change", function () {
    if (this.files.length > 0) {
      cdsInputText.value = this.files[0].name;
    }
  });

  const nlibInputFile = document.getElementById("nlibrary");
  const nlibInputText = document.getElementById("nlibraryInput");

  nlibInputFile.addEventListener("change", function () {
    if (this.files.length > 0) {
      nlibInputText.value = this.files[0].name;
    }
  });
});

//sending data
document.getElementById('uploadpangenome').addEventListener('click', function () {
    const formData = new FormData();
    const groups = document.querySelectorAll('.box-group');
    if (groups.length === 0) {
        alert('Você precisa adicionar pelo menos um genoma.');
        return;
    }

    let hasAtLeastOneGenome = false;

    groups.forEach(group => {
        const genomeInput = group.querySelector('.input-pangenome');
        const codingdsInput = group.querySelector('.input-codingds');

        if (genomeInput.files.length > 0) {
            formData.append('pangenome-file', genomeInput.files[0]);
            hasAtLeastOneGenome = true;
        }

        if (codingdsInput.files.length > 0) {
            formData.append('codingds-file', codingdsInput.files[0]);
        } else {
            formData.append('codingds-file', new File([""], ""));
        }
    });

    if (!hasAtLeastOneGenome) {
        alert("Você precisa selecionar pelo menos um arquivo de genoma.");
        return;
    }

    // Additional mandatory fields
    const cdsFile = document.getElementById('cdspangenome');
    const threadspangenome = document.getElementById('threadspangenome').value;
    const tecopies = document.getElementById('tecopies').value;
    const emailpangenome = document.getElementById('emailpangenome').value;

    if (cdsFile.files.length === 0) {
        alert("O arquivo Coding DNA Sequence (cdspangenome_file) é obrigatório.");
        return;
    }

    if (!threadspangenome || parseInt(threadspangenome) < 10) {
        alert("Informe um valor válido para Threads (mínimo 10).");
        return;
    }

    if (!tecopies || parseInt(tecopies) < 1) {
        alert("Informe um valor válido para o número mínimo de cópias.");
        return;
    }

    // Fill out the formData
    formData.append('cdspangenome_file', cdsFile.files[0]);
    formData.append('emailpangenome', emailpangenome);

    const nlibFile = document.getElementById('nlibrary');
    if (nlibFile.files.length > 0) {
        formData.append('nlibrary_file', nlibFile.files[0]);
    }

    formData.append('threadspangenome', threadspangenome);
    formData.append('tecopies_number', tecopies);

    fetch('/annotation_panedta', {
        method: 'POST',
        body: formData
    }).catch(err => {
        console.error("Sending error:", err);
    });

    setTimeout(function() {
        location.reload();
    }, 1000);
});
