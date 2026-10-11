// Mobile menu: the button toggles the site menu, which closes again when
// one of its links is followed.
document.addEventListener('DOMContentLoaded', () => {
  const button = document.querySelector('.menu-button');
  const menu = document.getElementById('site-menu');
  if (!button || !menu) return;

  function setOpen(open) {
    menu.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
  }

  button.addEventListener('click', () => setOpen(menu.hidden));
  menu.addEventListener('click', (e) => {
    if (e.target.closest('a')) setOpen(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu.hidden) {
      setOpen(false);
      button.focus();
    }
  });
});
