// The Logo language reference: this site's additions (assets/logo/
// reference-site.html) followed by jslogo's own language.html, both built
// into the script bundle as strings. It renders the playground's searchable
// reference, and shows a tooltip for the word under the pointer in any
// Logo program: a command's usage with its input names and what it does, or
// the inputs of a procedure the program defines.
(function (global) {
  'use strict';

  function html() {
    const guide = (global.LOGO_REFERENCE_GUIDE || '').match(/<div>([\s\S]*)<\/div>\s*<script/);
    return (global.LOGO_REFERENCE_SITE || '') + (guide ? guide[1] : '');
  }

  // Short names jslogo accepts that its language.html leaves out: each is
  // added as another way to write the command, so the reference (and its
  // tooltips) covers every name a program can use. tooltips.spec.js checks
  // this against jslogo's source.
  const ALIASES = {
    setpencolor: ['setpc', 'setcolor'],
    setpensize: ['setpw', 'setwidth'],
    setbackground: ['setbg'],
  };
  function addAliases(root) {
    root.querySelectorAll('dt').forEach(dt => {
      const name = commandName(dt);
      const aliases = name && ALIASES[name];
      if (!aliases || (dt.previousElementSibling && commandName(dt.previousElementSibling) === name)) return;
      let last = dt;
      while (last.nextElementSibling && last.nextElementSibling.tagName === 'DT') last = last.nextElementSibling;
      aliases.slice().reverse().forEach(alias => {
        const copy = dt.cloneNode(true);
        const text = (copy.querySelector('code') || copy).firstChild;
        text.textContent = text.textContent.replace(new RegExp('\\b' + name + '\\b', 'i'), alias);
        last.after(copy);
      });
    });
  }

  // Wraps each command's run of <dt>s and <dd>s in <div class="pg-ref-entry">
  // (allowed inside <dl>), so it can be shown, hidden or looked up as one.
  function group(root) {
    root.querySelectorAll('dl').forEach(dl => {
      let entry = null;
      [...dl.children].forEach(node => {
        if (node.tagName === 'DT' && (!entry || entry.lastElementChild.tagName !== 'DT')) {
          entry = document.createElement('div');
          entry.className = 'pg-ref-entry';
          dl.insertBefore(entry, node);
        }
        if (entry) entry.appendChild(node);
      });
    });
    return [...root.querySelectorAll('.pg-ref-entry')];
  }

  // Fills an element with the reference; returns its entries.
  function render(root) {
    root.innerHTML = html();
    addAliases(root);
    return group(root);
  }

  // The command a <dt> documents: its first word, when it starts with a
  // name (not an input, like "expr + expr", or a quoted word).
  function commandName(dt) {
    const code = dt.querySelector('code') || dt;
    const first = code.firstChild;
    if (!first || first.nodeType !== Node.TEXT_NODE) return null;
    const m = /^\s*\(?([a-z][\w.?]*)/i.exec(first.textContent);
    return m ? m[1].toLowerCase() : null;
  }

  let index = null;
  function lookup(name) {
    if (!index) {
      index = new Map();
      const root = document.createElement('div');
      Object.assign(root, { innerHTML: html() });
      addAliases(root);
      group(root);
      root.querySelectorAll('.pg-ref-entry').forEach(entry => {
        const usages = [...entry.querySelectorAll('dt')].map(dt => dt.textContent.replace(/\s+/g, ' ').trim());
        const about = entry.querySelector('dd:not(.example)');
        const example = entry.querySelector('dd.example');
        const info = {
          usages,
          about: about ? about.textContent.replace(/\s+/g, ' ').trim() : '',
          example: example ? example.textContent.trim() : '',
        };
        entry.querySelectorAll('dt').forEach(dt => {
          const name = commandName(dt);
          if (name && !index.has(name)) index.set(name, info);
        });
      });
    }
    return index.get(name.toLowerCase());
  }

  // Procedures defined in some Logo source: name -> {usage, about, inputs},
  // where about is the comment lines just above the TO line.
  function procedures(source) {
    const procs = new Map();
    const lines = source.split('\n');
    lines.forEach((line, i) => {
      const m = /^\s*to\s+([^\s\[\]():"]+)(.*)$/i.exec(line);
      if (!m) return;
      const inputs = (m[2].match(/:[^\s\[\]()]+/g) || []);
      const comments = [];
      for (let j = i - 1; j >= 0 && /^\s*;/.test(lines[j]); j--) {
        const text = lines[j].replace(/^\s*;\s?/, '').trim();
        if (text) comments.unshift(text);
      }
      procs.set(m[1].toLowerCase(), {
        usage: [m[1], ...inputs].join(' '),
        about: comments.join(' ') || 'A procedure defined in this program.',
        inputs,
        line: i,
      });
    });
    return procs;
  }

  // What to show for the word at `offset` in `source`, or null.
  function describe(source, offset, context) {
    const isWord = c => /[\w.?:"]/.test(c || '');
    let start = offset, end = offset;
    while (start > 0 && isWord(source[start - 1])) start--;
    while (end < source.length && isWord(source[end])) end++;
    const word = source.slice(start, end);
    if (!word || /^[\d.]+$/.test(word) || word.startsWith('"')) return null;
    // Ignore words inside comments.
    const lineStart = source.lastIndexOf('\n', start - 1) + 1;
    if (source.slice(lineStart, start).includes(';')) return null;

    const all = source + '\n' + (context || '');
    if (word.startsWith(':')) {
      // An input: name the procedure it belongs to, if any.
      const procs = procedures(source);
      const before = source.slice(0, start).split('\n').length - 1;
      let owner = null;
      for (const proc of procs.values()) {
        if (proc.line <= before && proc.inputs.some(i => i.toLowerCase() === word.toLowerCase())) owner = proc;
      }
      return {
        title: word,
        usages: [],
        about: owner ? `An input to ${owner.usage}.` : 'A variable: the value made with MAKE or LOCAL.',
      };
    }
    const name = word.toLowerCase();
    const proc = procedures(all).get(name);
    if (proc) return { title: word, usages: [proc.usage], about: proc.about };
    const info = lookup(name);
    if (!info) return null;
    return { title: word, usages: info.usages, about: info.about, example: info.example };
  }

  // The tooltip shared by the whole page.
  let tip = null;
  let showTimer = null;
  function hide() {
    clearTimeout(showTimer);
    if (tip) tip.hidden = true;
  }
  function show(info, x, y) {
    if (!tip) {
      tip = document.createElement('div');
      tip.className = 'logo-tip';
      tip.setAttribute('role', 'tooltip');
      document.body.appendChild(tip);
      ['scroll', 'keydown', 'pointerdown'].forEach(t => global.addEventListener(t, hide, true));
    }
    tip.textContent = '';
    const usage = document.createElement('div');
    usage.className = 'logo-tip-usage';
    (info.usages.length ? info.usages : [info.title]).forEach(u => {
      const line = document.createElement('code');
      line.textContent = u;
      usage.appendChild(line);
    });
    tip.appendChild(usage);
    if (info.about) {
      const about = document.createElement('p');
      about.textContent = info.about;
      tip.appendChild(about);
    }
    if (info.example) {
      const ex = document.createElement('p');
      ex.className = 'logo-tip-example';
      ex.textContent = 'Example: ' + info.example;
      tip.appendChild(ex);
    }
    tip.hidden = false;
    const w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = Math.max(4, Math.min(x + 12, global.innerWidth - w - 4)) + 'px';
    tip.style.top = (y + 18 + h > global.innerHeight ? y - h - 8 : y + 18) + 'px';
  }

  // Shows tooltips for words in `el`. locate(event) returns {source, offset}
  // for the character under the pointer, or null; context() returns other
  // Logo source whose procedures the program can use.
  function attach(el, locate, context) {
    let last = null;
    el.addEventListener('pointermove', e => {
      if (e.pointerType === 'touch') return;
      const at = locate(e);
      const info = at && describe(at.source, at.offset, context && context());
      const key = info && info.title + '|' + (info.usages[0] || '') + '|' + info.about;
      if (key === last && !tip?.hidden) {
        return;
      }
      last = key;
      hide();
      if (info) showTimer = setTimeout(() => show(info, e.clientX, e.clientY), 300);
    });
    el.addEventListener('pointerleave', () => { last = null; hide(); });
  }

  // locate() for an element showing code as text (spans allowed): the
  // character under the pointer, from the browser's caret hit-testing.
  function textLocator(el) {
    return e => {
      let node, offset;
      if (document.caretPositionFromPoint) {
        const pos = document.caretPositionFromPoint(e.clientX, e.clientY);
        if (!pos) return null;
        node = pos.offsetNode; offset = pos.offset;
      } else if (document.caretRangeFromPoint) {
        const range = document.caretRangeFromPoint(e.clientX, e.clientY);
        if (!range) return null;
        node = range.startContainer; offset = range.startOffset;
      } else {
        return null;
      }
      if (!node || node.nodeType !== Node.TEXT_NODE || !el.contains(node)) return null;
      // Only when the pointer is over the text itself, not past a line's end.
      const range = document.createRange();
      range.setStart(node, Math.max(0, offset - 1));
      range.setEnd(node, Math.min(node.length, offset + 1));
      const hit = [...range.getClientRects()].some(r =>
        e.clientX >= r.left - 2 && e.clientX <= r.right + 2 && e.clientY >= r.top && e.clientY <= r.bottom);
      if (!hit) return null;
      let total = 0;
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (n === node) return { source: el.textContent, offset: total + offset };
        total += n.length;
      }
      return null;
    };
  }

  // locate() for a <textarea> that doesn't wrap lines, in a monospace font:
  // the line and column come straight from the pointer position.
  function textareaLocator(ta) {
    const measure = document.createElement('canvas').getContext('2d');
    return e => {
      const style = getComputedStyle(ta);
      const rect = ta.getBoundingClientRect();
      const x = e.clientX - rect.left - parseFloat(style.borderLeftWidth) - parseFloat(style.paddingLeft) + ta.scrollLeft;
      const y = e.clientY - rect.top - parseFloat(style.borderTopWidth) - parseFloat(style.paddingTop) + ta.scrollTop;
      measure.font = style.font;
      const charWidth = measure.measureText('M').width;
      const lineHeight = parseFloat(style.lineHeight);
      if (x < 0 || y < 0 || !charWidth || !lineHeight) return null;
      const lines = ta.value.split('\n');
      const row = Math.floor(y / lineHeight);
      if (row >= lines.length) return null;
      const tab = parseInt(style.tabSize, 10) || 8;
      const col = x / charWidth;
      let visual = 0;
      const line = lines[row];
      for (let i = 0; i < line.length; i++) {
        const width = line[i] === '\t' ? tab - (visual % tab) : 1;
        if (col < visual + width) {
          const offset = lines.slice(0, row).reduce((n, l) => n + l.length + 1, 0) + i;
          return { source: ta.value, offset };
        }
        visual += width;
      }
      return null;
    };
  }

  // A searchable reference in `section` (the playground's, or the
  // reference page's): typing shows the commands whose names start with
  // what's typed, or, when it's exactly a command's name, just that command
  // (with its other names). Clicking an example runs it, when there's
  // somewhere to run it (`runLine`).
  function setup(section, runLine) {
    if (!section) return;
    const body = section.querySelector('.pg-reference-body');
    const entries = render(body).map(entry => ({
      entry,
      names: [...entry.querySelectorAll('dt')].map(dt => commandName(dt) || dt.textContent.trim().split(/\s+/)[0].toLowerCase().replace(/^"/, '')),
    }));

    // Is there anything left to show between this heading and the next one
    // of the same or higher level?
    function hasMatches(heading) {
      const stop = heading.tagName === 'H3' ? /^H3$/ : /^H[34]$/;
      for (let n = heading.nextElementSibling; n && !stop.test(n.tagName); n = n.nextElementSibling) {
        if (n.tagName === 'DL' && !n.hidden) return true;
      }
      return false;
    }

    const search = section.querySelector('.pg-reference-search');
    search.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      const exact = q && entries.some(({ names }) => names.includes(q));
      entries.forEach(({ entry, names }) => {
        entry.hidden = Boolean(q) && !(exact ? names.includes(q) : names.some(n => n.startsWith(q)));
      });
      body.querySelectorAll('dl').forEach(dl => {
        dl.hidden = Boolean(q) && !dl.querySelector('.pg-ref-entry:not([hidden])');
      });
      [...body.children].forEach(node => {
        if (node.tagName === 'DL') return;
        node.hidden = Boolean(q) && !(/^H[34]$/.test(node.tagName) && hasMatches(node));
      });
    });

    if (runLine) {
      body.addEventListener('click', e => {
        const example = e.target.closest('.example');
        if (example) runLine(example.textContent.trim());
      });
      body.querySelectorAll('.example').forEach(ex => { ex.title = 'Click to run this example'; });
    }
  }

  // (The reference page's <logo-reference> element, element.js, calls
  // setup() on its section.)

  global.LogoReference = { render, lookup, describe, attach, textLocator, textareaLocator, setup };
}(self));
