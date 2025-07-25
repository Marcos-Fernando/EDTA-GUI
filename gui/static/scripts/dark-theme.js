//------------------  Script Dark Theme ---------------//
var replaceConst = document.querySelector('.replace');
var elementsWithDarkTheme = document.querySelectorAll('.main, .Download, .Help, .container-main, .box-checkboxs-tir, .box-checkboxs-step, .container-threads, .box-explicative, .title-input, .session-title, .header, .footer, .uploaddata, .icon-download, .container-download, .documentation-edta, .description-about, .description-contact, .container-results, .results, .log-container, .container-panGenome');
var cloudImg = document.getElementById('cloudImage');
// var logoImg = document.getElementById('logoImage');
var logoImgs = document.querySelectorAll('.logo'); 
var mains = document.querySelectorAll('main');

var isCloudSun = false;

replaceConst.addEventListener('click', function(){
  elementsWithDarkTheme.forEach(function(element) {
    element.classList.toggle('dark-theme');
  });

  //ternary conditional expression ? : to toggle
 //If isCloudSun is true, it will use the values on the left side of the :; otherwise, it will use the values on the right side of the :
  isCloudSun = !isCloudSun;
  cloudImg.src = isCloudSun ? '../static/assets/CloudSun.svg' : '../static/assets/CloudMoon.svg';

  logoImgs.forEach(function(logoImg) {
    logoImg.src = isCloudSun ? '../static/assets/Logo2.svg' : '../static/assets/Logo.svg';
  });
});