// Logo source, read without running it: the procedure definitions in a
// piece of it, and the complete program for a lesson's example (the
// procedures it uses that other examples on the page define). Pure
// functions, published as LogoStage.definitions and LogoStage.program.

// A TO ... END procedure definition: its name, lowercase, and its text.
export interface Definition {
  name: string;
  text: string;
}

// A lesson's example: its code, and the command to run after it, if any.
export interface Example {
  code: string;
  run?: string | null;
}

// The TO ... END procedure definitions in a piece of Logo source, as
// [{name, text}].
export function definitions(source: string): Definition[] {
  const defs: Definition[] = [];
  let current: { name: string; lines: string[] } | null = null;
  source.split('\n').forEach(line => {
    const start = !current && /^\s*to\s+([^\s\[\]():"]+)/i.exec(line);
    if (start) current = { name: start[1].toLowerCase(), lines: [] };
    if (current) {
      current.lines.push(line);
      if (/^\s*end\s*$/i.test(line)) {
        defs.push({ name: current.name, text: current.lines.join('\n') });
        current = null;
      }
    }
  });
  return defs;
}

// The words in a piece of Logo source, lowercase, leaving out comments.
const words = (source: string): string[] => (source.replace(/;.*$/gm, '').match(/[a-z][\w.?]*/gi) || [])
  .map(w => w.toLowerCase());

// A complete program for examples[index] (each {code, run}): the
// procedures it uses that other examples define, then its code, then its
// run command. The latest definition above it wins; a procedure defined
// only further down the page is used as a last resort, so a lesson can
// show a word in use before it explains how to define it.
export function program(examples: Example[], index: number): string {
  const { code, run } = examples[index];
  const known = new Map<string, Definition>();
  const add = (ex: Example) => definitions(ex.code).forEach(def => {
    known.delete(def.name);
    known.set(def.name, def);
  });
  examples.slice(index + 1).reverse().forEach(add);
  examples.slice(0, index).forEach(add);
  const own = new Set(definitions(code).map(def => def.name));
  const needed = new Set<string>();
  const queue = words(code + '\n' + (run || ''));
  while (queue.length) {
    const word = queue.pop()!;
    if (own.has(word) || needed.has(word) || !known.has(word)) continue;
    needed.add(word);
    queue.push(...words(known.get(word)!.text));
  }
  const defs = [...known.values()].filter(def => needed.has(def.name)).map(def => def.text);
  return [...defs, code, run].filter(Boolean).join('\n\n');
}
