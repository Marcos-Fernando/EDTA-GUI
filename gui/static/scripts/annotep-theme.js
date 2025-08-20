const edtaCheckbox = document.getElementById("edtagui");
const annotepCheckbox = document.getElementById("annotep");

const elementsWithTheme = document.querySelectorAll(
    ".main, .Download, .container-main, .box-checkboxs-tir, .box-checkboxs-step, .box-checkboxs-mode, .container-threads, .box-explicative, .title-input, .session-title, .header, .footer, .uploaddata, .icon-download, .container-download, .documentation-edta, .description-about, .description-contact, .container-results, .results, .log-container, .aside, .help-icon, .panEDTA"
);

const logoChecked = document.querySelectorAll(".logo");
const iconMenu = document.querySelectorAll(".icon-menu");
const questionIcon = document.querySelectorAll('.question-icon');

function setTheme(isAnnoTEP) {
    elementsWithTheme.forEach(el => {
        el.classList.toggle("annotep-theme", isAnnoTEP);
    });

    logoChecked.forEach(logoImg => {
        logoImg.src = isAnnoTEP 
            ? "../static/assets/Logo-AnnoTEP.svg" 
            : "../static/assets/Logo.svg";
    });

    iconMenu.forEach(icon => {
        icon.src = isAnnoTEP 
            ? "../static/assets/icon2.svg" 
            : "../static/assets/icon.svg";
    });

    questionIcon.forEach(iconquestion => {
        iconquestion.src = isAnnoTEP 
            ? "../static/assets/question-green.svg" 
            : "../static/assets/question-red.svg";
    });
}

// function toggleCheckbox(containerClass, checkbox) {
//     const checkboxes = document.querySelectorAll(`.${containerClass} .checkbox-mode`);
//     checkboxes.forEach(cb => {
//         if (cb !== checkbox) {
//             cb.checked = false; // Desmarcar outros checkboxes
//         }
//     });
//      // Atualiza o tema com base no estado do checkbox AnnoTEP
// }

edtaCheckbox.addEventListener("change", () => {
    if (edtaCheckbox.checked) {
        annotepCheckbox.checked = false;
        setTheme(false);
    }
});

annotepCheckbox.addEventListener("change", () => {
    if (annotepCheckbox.checked) {
        edtaCheckbox.checked = false;
        setTheme(true);
    }
});

// Initial state
setTheme(false);
