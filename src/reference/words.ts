// The reference's reading of Logo source and of its own text, apart from
// the page: the procedures a program defines, what to show for the word at
// a place in a program, the command a usage line names, which commands a
// search shows, and which character of a <textarea>'s text is at a line and
// column. Pure functions of their inputs, so the unit tests can check them
// without a DOM; reference.ts publishes them through LogoReference. (It
// imports this module, so the build puts it in the reference-core chunk
// with it.)

// A command, as the reference documents it: its usage lines (one per name
// and way to call it), what it does, and an example (or '').
export interface CommandInfo {
  usages: string[];
  about: string;
  example: string;
}

// A procedure defined in some Logo source: how to call it (its name and
// inputs), the comment lines just above its TO line (or a stand-in), its
// inputs (with their colons) and the line its TO is on.
export interface Procedure {
  usage: string;
  about: string;
  inputs: string[];
  line: number;
}

// What a tooltip shows for a word: the word, its usage lines, what it is,
// and an example, if the reference has one.
export interface WordInfo {
  title: string;
  usages: string[];
  about: string;
  example?: string;
}

// The command a reference usage line names, from the text it starts with
// (the reference marks its inputs up as <var>s, so a line that starts with
// an input, like "expr + expr", has none): its first word, when it starts
// with a name (not punctuation, like "( expression )", or a quoted word),
// lowercase; else null.
export function leadingName(text: string): string | null {
  const m = /^\s*\(?([a-z][\w.?]*)/i.exec(text);
  return m ? m[1].toLowerCase() : null;
}

// Procedures defined in some Logo source: name -> {usage, about, inputs},
// where about is the comment lines just above the TO line.
export function procedures(source: string): Map<string, Procedure> {
  const procs = new Map<string, Procedure>();
  const lines = source.split('\n');
  lines.forEach((line, i) => {
    const m = /^\s*to\s+([^\s\[\]():"]+)(.*)$/i.exec(line);
    if (!m) return;
    const inputs = (m[2].match(/:[^\s\[\]()]+/g) || []);
    const comments: string[] = [];
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

// What to show for the word at `offset` in `source`, or null. `context` is
// other Logo source whose procedures the program can use; `lookup` finds a
// command in the reference (LogoReference.lookup).
export function describe(source: string, offset: number, context: string | null | undefined,
  lookup: (name: string) => CommandInfo | undefined): WordInfo | null {
  const isWord = (c: string | undefined) => /[\w.?:"]/.test(c || '');
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
    let owner: Procedure | null = null;
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

// Whether the reference's search for `q` (trimmed, lowercase) shows a
// command with the given names, where `all` is every command's names: all
// of them when `q` is empty; when `q` is exactly a command's name, just the
// commands with that name; else those with a name that starts with `q`.
export function searchMatcher(q: string, all: string[][]): (names: string[]) => boolean {
  const exact = q && all.some(names => names.includes(q));
  return names => !q || (exact ? names.includes(q) : names.some(n => n.startsWith(q)));
}

// The offset in `text` (a <textarea>'s value) of the character drawn at
// line `row` and column `col` (in character widths, fractional), with tab
// stops every `tab` columns; null past a line's end or the last line.
export function offsetAt(text: string, row: number, col: number, tab: number): number | null {
  const lines = text.split('\n');
  if (row >= lines.length) return null;
  let visual = 0;
  const line = lines[row];
  for (let i = 0; i < line.length; i++) {
    const width = line[i] === '\t' ? tab - (visual % tab) : 1;
    if (col < visual + width) {
      return lines.slice(0, row).reduce((n, l) => n + l.length + 1, 0) + i;
    }
    visual += width;
  }
  return null;
}
