// The reference's markup, as the site's partials/logo-reference.html wrote
// it: a search box over the reference, with a hint under it, filled in by
// LogoReference.setup.
export function referenceSection(hint) {
  const section = document.createElement('section');
  section.className = 'pg-reference';
  section.setAttribute('aria-labelledby', 'pg-reference-heading');
  section.innerHTML = `
  <h2 class="pg-heading" id="pg-reference-heading">Logo Language Reference</h2>
  <input class="pg-reference-search" type="search" spellcheck="false" autocomplete="off"
    placeholder="Find a command, like setxy or repeat" aria-label="Find a command">
  <p class="pg-reference-hint"></p>
  <div class="pg-reference-body"></div>
`;
  section.querySelector('.pg-reference-hint').textContent = hint;
  return section;
}
