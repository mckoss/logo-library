# logo-library

The Logo programs of [mckoss.com](https://mckoss.com/logo/), as a library of
custom elements: runnable lesson examples and worksheets, the Logo
Playground, the language reference, and Turtle Tiles. It runs Logo with
[jslogo](https://github.com/inexorabletash/jslogo) by Joshua Bell (Apache
2.0), through the [mckoss/jslogo](https://github.com/mckoss/jslogo) fork.

The site installs a release of this package by URL and places the elements
in its own pages; the lessons themselves stay in the site.

- [PLAN.md](PLAN.md): why this repo exists, the steps, and progress.
- [CONTRACT.md](CONTRACT.md): the elements, as host pages use them.
- [SHARE-LINKS.md](SHARE-LINKS.md): the Turtle Tiles share-link format, which
  must keep working.

## Demo

[mckoss.com/logo-library/logo/](https://mckoss.com/logo-library/logo/) is
this repo's demo: mckoss.com's Logo pages (imported at the fork point) with
the latest `main` of this package, deployed by CI to GitHub Pages. It shares
mckoss.com's browser storage, so saved Playground programs and Turtle Tiles
show up in both.

To run it locally: `npm install`, `git submodule update --init`, then
`npm run build && npm run hosts && npm run serve`, and open
http://localhost:8790/logo/ (or /logo-library/logo/ for the GitHub Pages
build). `npm test` runs the type check, the unit tests and the end-to-end
tests.
