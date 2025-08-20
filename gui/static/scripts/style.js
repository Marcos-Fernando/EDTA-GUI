//------------------  Placeholder ---------------//
function clearPlaceholder(input) {
  input.placeholder = '';
}

// The file selected in input type="file" will appear in input type="text"
function updateFileName(inputFileId, inputTextId) {
  const fileInput = document.getElementById(inputFileId);
  const textInput = document.getElementById(inputTextId);

  if (fileInput.files.length > 0) {
    textInput.value = fileInput.files[0].name;
  } else {
    textInput.value = '';
  }
}

// ------------------------------------- Input --------------------------------------- //
document.getElementById('inputdata').addEventListener('change', () => updateFileName('inputdata', 'fileNameInput'));
document.getElementById('cds').addEventListener('change', () => updateFileName('cds', 'cdsInput'));
document.getElementById('curatelib').addEventListener('change', () => updateFileName('curatelib', 'curateLibInput'));
document.getElementById('exclude').addEventListener('change', () => updateFileName('exclude', 'maskedRegionsInput'));
document.getElementById('rmlib').addEventListener('change', () => updateFileName('rmlib', 'rmLibInput'));
document.getElementById('rmout').addEventListener('change', () => updateFileName('rmout', 'rmoutInput'));

document.getElementById('directorynameInput').addEventListener('change', function(event) {
  const directoryHandle = event.target.files[0].webkitRelativePath.split('/')[0];
  document.getElementById('directoryInput').value = directoryHandle; 
});

// --------------------------------- checkbox ----------------------------------- //
function toggleCheckbox(groupClass, clickedCheckbox) {
  // Selects all checkboxes in the group
  const checkboxes = document.querySelectorAll(`.${groupClass} .checkbox-tir, .${groupClass} .checkbox-step, .${groupClass} .checkbox-mode`);
  
  // Uncheck all checkboxes in the group
  checkboxes.forEach(checkbox => {
      if (checkbox !== clickedCheckbox) {
          checkbox.checked = false;
      }
  });

  // Activate the clicked checkbox
  clickedCheckbox.checked = true;
  setTheme(annotepCheckbox.checked);
}

//----- Capture the toggleHelp IDs and call ---- //
function toggleHelp(sidebarId) {
    const helpSidebar = document.getElementById(sidebarId);
    helpSidebar.classList.toggle('hiddenHelp'); // Alterna a classe 'hidden'
}


//------------------ Aside movement---------------//
var menuSide = document.querySelector('.aside');
var mainleft = document.querySelector('.main');
var menuItems = document.querySelectorAll('li');

menuItems.forEach(function(item) {
  item.addEventListener('click', function() {
    menuItems.forEach(function(item) {
      item.classList.remove('open');
    });

    this.classList.add('open');
  });
});

//------------------  Aside MOBILE format ---------------//
let menuMobile = document.querySelector('.menuMobile');
let menuIcon = document.querySelector('.menuIcon');

menuMobile.addEventListener('click', () => {
  menuSide.classList.toggle('showAside');
  menuIcon.classList.toggle('iconColor');
});

let menuOpen = false;

menuMobile.addEventListener('click', () => {
  menuOpen = !menuOpen;
  setTimeout(() => {
    menuIcon.src = menuOpen
      ? "../static/assets/icon_close.svg"
      : "../static/assets/icon_menu.svg";
  }, 250);
});
