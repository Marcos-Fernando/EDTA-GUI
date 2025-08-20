function execute_annotation(threadsValue) {
  const { filegenome, email } = getFileAndEmail();
  const { checkedTir: tircandidates, checkedStep: stepannotation, checkedMode:modeAnnotation, directoryName: directoryResults } = getCheckedValues();
  const {cdsFile, curateLibFile, maskedRegionsFile, rmLibFile, rmoutFile} = getFiles();

        var data = new FormData();
        data.append('genome', filegenome);
        data.append('email', email);
        data.append('thread', threadsValue);
        
        // Adds each item from `tircandidates` and `stepannotation` individually
        tircandidates.forEach(item => data.append('tircandidates', item));
        stepannotation.forEach(item => data.append('stepannotation', item));
        modeAnnotation.forEach(item => data.append('modeAnnotation', item));


        data.append('directoryResults', directoryResults);

        const validatedValues = getValuesAndValidate();
        if (!validatedValues) return; // Terminate if validation fails
        const { mutationRate, maxDivergence } = validatedValues;

        data.append('overwrite', switchValues.overwriteValue);
        data.append('sensitivity', switchValues.sensitivityValue);
        data.append('force', switchValues.forceValue);
        data.append('tirfilter', switchValues.tirfilterValue);
        data.append('annottype', switchValues.annottypeValue);
        data.append('annotation', annotationValue);
        data.append('evaluate', evaluateValue);
        data.append("mutation_rate", mutationRate);
        data.append("max_divergence", maxDivergence);
        data.append("cds_file", cdsFile);
        data.append("curate_lib", curateLibFile);
        data.append("masked_region", maskedRegionsFile);
        data.append("rm_lib", rmLibFile);
        data.append("rmout_lib", rmoutFile);

        // console.log(filegenome);

        // fetch('/annotation_process', {
        //         method: 'POST',
        //         body: data
        // }).then(response => {
        //       console.log("Flask response received");
        // }).catch(error => {
        //       console.error(error);
        // });

        fetch('/annotation_process', {
                method: 'POST',
                body: data
        }).catch(err => {
            console.error("Sending error:", err);
        });

  setTimeout(function() {
    location.reload();
  }, 1000);

}

// ------ Call Flask ---------
function getFileAndEmail() {
  var filegenome = document.getElementById('inputdata').files[0];
  var email = document.getElementById('email').value;

  return { filegenome, email };
}

function getCheckedValues() {
  // Selects all the checkboxes marked in the ‘tir’ group
  const checkedTir = Array.from(document.querySelectorAll('input[name="tir"]:checked'))
    .map(checkbox => checkbox.value);
  const checkedStep = Array.from(document.querySelectorAll('input[name="step"]:checked'))
    .map(checkbox => checkbox.value);
  const checkedMode= Array.from(document.querySelectorAll('input[name="mode"]:checked'))
    .map(checkbox => checkbox.value);
  const directoryName = document.getElementById('directoryInput').value;

  return { checkedTir, checkedStep, checkedMode, directoryName };
}

function updateDirectoryInputState() {
    const { checkedStep: stepannotation } = getCheckedValues();
    const directoryInput = document.getElementById('directoryInput');
    const containerDirectoryName = document.querySelector('.container-directory-name');
    // Verifica se "all" está selecionado
    const isAllSelected = stepannotation.includes('all');
    // Se "all" estiver selecionado, esconde a div; caso contrário, verifica os outros checkboxes
    if (isAllSelected) {
        containerDirectoryName.classList.add('hiddenstep'); // Esconde a div
        directoryInput.disabled = true; // Desabilita o input
        directoryInput.readOnly = true; // Define como somente leitura
        directoryInput.value = ''; // Limpa o valor do input
    } else {
        // Verifica se "filter", "final" ou "anno" estão selecionados
        const shouldShow = stepannotation.some(step =>
            ['filter', 'final', 'anno'].includes(step)
        );
        if (shouldShow) {
            containerDirectoryName.classList.remove('hiddenstep'); // Mostra a div
        } else {
            containerDirectoryName.classList.add('hiddenstep'); // Esconde a div se nenhum dos outros estiver selecionado
        }
    }
}

function getValuesAndValidate() {
  const mutationRateInput = document.getElementById("mutation-rate");
  const maxDivergenceInput = document.getElementById("maximun-divergence");

  const mutationRateValue = mutationRateInput.value.trim();
  const maxDivergenceValue = parseFloat(maxDivergenceInput.value.trim());

  let mutationRate = "";
  let maxDivergence = "";

  // Validation for mutation rate
  const mutationRateRegex = /^[0-9]+\.[0-9]+e[-+]?[0-9]+$/; // Scientific notation
  if (mutationRateValue === "" || mutationRateValue === "1.3e-8") {
      mutationRate = "";
  } else if (!mutationRateRegex.test(mutationRateValue)) {
      alert("Please enter a valid mutation rate in scientific notation, e.g., 1.3e-8.");
      return null;
  } else {
      mutationRate = mutationRateValue;
  }

  // Validation for maximum divergence
  if (maxDivergenceValue === 40) {
      maxDivergence = "";
  } else if (maxDivergenceValue >= 0 && maxDivergenceValue <= 100) {
      maxDivergence = maxDivergenceValue.toString();
  } else {
      alert("Please enter a valid maximum divergence between 0 and 100.");
      return null;
  }

  return { mutationRate, maxDivergence };
}

function getFiles() {
  // Receive the files (if any) of the input fields
  var cdsFile = document.getElementById('cds').files[0] || null; // Returns null if there is no file
  var curateLibFile = document.getElementById('curatelib').files[0] || null;
  var maskedRegionsFile = document.getElementById('exclude').files[0] || null;
  var rmLibFile = document.getElementById('rmlib').files[0] || null;
  var rmoutFile = document.getElementById('rmout').files[0] || null;

  // Return an object with the files, which can be null or undefined if there are no files
  return {
    cdsFile,
    curateLibFile,
    maskedRegionsFile,
    rmLibFile,
    rmoutFile
  };
}


const uploaddate = document.getElementById('uploaddata');
const threadsInput = document.getElementById('threads'); // Make sure this ID is correct
let threadsValue;

uploaddate.addEventListener('click', function () {
  // Get the number of threads and make sure it's at least 4
  threadsValue = parseInt(threadsInput.value, 10);
  if (isNaN(threadsValue) || threadsValue < 10) {
    threadsValue = 10; // Set to 10 if empty, invalid or less than 4
    threadsInput.value = threadsValue; // Update the field to reflect the adjustment
  }

  // Executa a função com o valor corrigido
  execute_annotation(threadsValue);

});


// ---------------------------- Switch button ----------------------------------------------- //
const switchValues = {
  overwriteValue: 0,
  sensitivityValue: 1,
  forceValue: 0,
  tirfilterValue: 0,
  annottypeValue: 0
};

let annotationValue = 0;
let evaluateValue = 0;

const switch1 = document.getElementById("switch1");
const switch2 = document.getElementById("switch2");
const switch3 = document.getElementById("switch3");
const switch4 = document.getElementById("switch4");
const switch5 = document.getElementById("switch5");
const switch6 = document.getElementById("switch6");
const switch7 = document.getElementById("switch7");

const statusTextswitch1 = document.getElementById("status-text-switch1");
const statusTextswitch2 = document.getElementById("status-text-switch2");
const statusTextswitch3 = document.getElementById("status-text-switch3");
const statusTextswitch4 = document.getElementById("status-text-switch4");
const statusTextswitch5 = document.getElementById("status-text-switch5");
const statusTextswitch6 = document.getElementById("status-text-switch6");
const statusTextswitch7 = document.getElementById("status-text-switch7");

const rmoutFileInput = document.getElementById("rmout");
const excludeFileInput = document.getElementById("exclude");
const boxrmoutInput = document.getElementById("rmoutInput");
const boxexcludeInput = document.getElementById("maskedRegionsInput");
const browseButton = document.getElementById("browseButton");  
const browseExcludeButton = document.getElementById("browseExcludeButton");  

function updateSwitchStatus(switchElement, statusTextElement, switchKey) {
  if (switchElement.checked) {
      statusTextElement.textContent = "Enabled";
      statusTextElement.classList.add("status-enabled");
      statusTextElement.classList.remove("status-deactivated");
      switchValues[switchKey] = 1;
  } else {
      statusTextElement.textContent = "Deactivated";
      statusTextElement.classList.add("status-deactivated");
      statusTextElement.classList.remove("status-enabled");
      switchValues[switchKey] = 0;
  }
}

switch1.addEventListener("change", function () {
  updateSwitchStatus(switch1, statusTextswitch1, 'overwriteValue');
});

switch2.addEventListener("change", function () {
  updateSwitchStatus(switch2, statusTextswitch2, 'sensitivityValue');
});

switch5.addEventListener("change", function () {
  updateSwitchStatus(switch5, statusTextswitch5, 'forceValue');
});

function updateSwitch6() {
    updateSwitchStatus(switch6, statusTextswitch6, 'tirfilterValue');
}

function updateSwitch7() {
    updateSwitchStatus(switch7, statusTextswitch7, 'annottypeValue');
}

// Function to update the visual and text status of switch3 (Annotation)
function updateSwitch3() {
  if (switch3.checked) {
      statusTextswitch3.textContent = "Enabled";
      statusTextswitch3.classList.add("status-enabled");
      statusTextswitch3.classList.remove("status-deactivated");
      annotationValue = 1;

      switch4.disabled = false; // Enable switch4 when switch3 is activated
      
      // Enable box-input
      rmoutFileInput.disabled = false;
      excludeFileInput.disabled = false;
      browseButton.classList.remove("disabled");
      browseExcludeButton.classList.remove("disabled");
  } else {
      statusTextswitch3.textContent = "Deactivated";
      statusTextswitch3.classList.add("status-deactivated");
      statusTextswitch3.classList.remove("status-enabled");
      annotationValue = 0;
      switch4.checked = false; // Deactivate switch4 if switch3 is deactivated
      switch4.disabled = true; // Disable switch4 when switch3 is disabled
      updateSwitch4(); // Updates the text and colour status of switch4

      // Desabilita a box-input
      rmoutFileInput.disabled = true;
      excludeFileInput.disabled = true;
      browseButton.classList.add("disabled");
      browseExcludeButton.classList.add("disabled");

      rmoutFileInput.value = '';
      excludeFileInput.value = '';
      boxexcludeInput.value = '';
      boxrmoutInput.value = '';
  }
}

// Function to update the visual and text status of switch4 (evaluate)
function updateSwitch4() {
  if (switch4.checked) {
      statusTextswitch4.textContent = "Enabled";
      statusTextswitch4.classList.add("status-enabled");
      statusTextswitch4.classList.remove("status-deactivated");
      evaluateValue = 1;

      switch3.checked = true; // Activates switch3 automatically if switch4 is activated
      updateSwitch3(); // Update the state of switch3 to reflect activation
  } else {
      statusTextswitch4.textContent = "Deactivated";
      statusTextswitch4.classList.add("status-deactivated");
      statusTextswitch4.classList.remove("status-enabled");
      evaluateValue = 0;
  }
}


function updateMode() {
    const edtaCheckbox = document.getElementById("edtagui");
    const annotepCheckbox = document.getElementById("annotep");

    const switch6Row = document.getElementById("switch6").closest("tr");
    const switch7Row = document.getElementById("switch7").closest("tr");

    if (annotepCheckbox.checked) {
        // Release switches 6 e 7
        switch2.checked = true; // Marca o switch2
        switch2.disabled = true; //Trava switch2
        updateSwitchStatus(switch2, statusTextswitch2, 'sensitivityValue');

        switch6.disabled = false;
        switch7.disabled = false;
        switch6Row.classList.remove("hidden"); 
        switch7Row.classList.remove("hidden"); 
    } else if (edtaCheckbox.checked) {
        // Blocks abd disable switches 6 e 7
        switch2.disabled = false;

        switch6.checked = false;
        switch7.checked = false;
        updateSwitch6();
        updateSwitch7();
        switch6.disabled = true;
        switch7.disabled = true;
        switch6Row.classList.add("hidden");
        switch7Row.classList.add("hidden");
    } else {
        // Caso nenhum esteja selecionado, garante que switch2 está editável
        switch2.disabled = false;
    }
}

// Atualiza modo quando qualquer checkbox-mode for clicado
document.querySelectorAll(".checkbox-mode").forEach(checkbox => {
    checkbox.addEventListener("change", updateMode);
});

// Add event listeners for the changes in switch3 and switch4
switch3.addEventListener("change", updateSwitch3);
switch4.addEventListener("change", updateSwitch4);
switch6.addEventListener("change", updateSwitch6);
switch7.addEventListener("change", updateSwitch7);

// Initialises the default state when loading the page
updateSwitch3();
updateSwitch4();

// Estado inicial (EDTA)
updateMode();