// ==== Code to switch page guides ====
function showSection(sectionToShow) {
  const sections = ['main','panEDTA', 'results'];
  sections.forEach(section => {
    const element = document.querySelector(`.${section}`);
    element.style.display = section === sectionToShow ? 'flex' : 'none';
  });
}

//  Then link the events:
document.getElementById('panEDTA').addEventListener('click', () => showSection('panEDTA'));
document.getElementById('Results').addEventListener('click', () => showSection('results'));
document.querySelectorAll('.home').forEach(el => {
  el.addEventListener('click', () => showSection('main'));
});


//=============  Aside selection movement =============//
var menuSide = document.querySelector('.aside');
var mainleft = document.querySelector('.main');
var menuItems = document.querySelectorAll('li');
var logo = document.querySelector('.logoedta');

menuItems.forEach(function(item) {
  item.addEventListener('click', function() {
    menuItems.forEach(function(item) {
      item.classList.remove('open');
    });

    this.classList.add('open');
  });
});

logo.addEventListener('click', function() {
  menuItems.forEach(function(item) {
    item.classList.remove('open');
  });

  document.querySelector('li#Home').classList.add('open');
});