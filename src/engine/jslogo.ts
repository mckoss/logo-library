// jslogo (Logo in JavaScript, by Joshua Bell), the git submodule
// vendor/jslogo pinned to one commit, loaded as the site loaded it: its
// three scripts in this order, publishing CanvasTurtle and LogoInterpreter
// as globals. logo.js declares LogoInterpreter at its top level, which made
// it a global as a classic script; the jslogo-globals plugin in
// vite.config.js assigns it to self here. src/types/jslogo.d.ts types them.
import 'jslogo/floodfill.js';
import 'jslogo/turtle.js';
import 'jslogo/logo.js';
