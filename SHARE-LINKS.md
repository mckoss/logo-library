# Turtle Tiles share links: keep old links working

Since 1.8.11, Turtle Tiles' **Share a link** hands out links that carry
programs, and people keep them. **Every newer version must still open every
link an older version made**, sensibly: the programs a link carried should
come back as they were, as closely as the current tiles allow. The same
goes for programs saved in the browser (`localStorage` key
`mckoss.logo.tiles`, the same JSON).

A link is `https://mckoss.com/logo/tiles/?p=` and then a payload: one letter
for the encoding, then URL-safe base64 (`-` and `_`, no `=` padding):

- `z`: the JSON (UTF-8), compressed with raw DEFLATE (RFC 1951; the
  browser's `CompressionStream('deflate-raw')`).
- `j`: the JSON (UTF-8), uncompressed, from browsers that can't compress.

The JSON:

```json
{
  "current": "A",
  "programs": {
    "A": [{ "t": "repeat", "n": 4, "body": [{ "t": "move", "d": 50 }, { "t": "turn", "a": 90 }] },
          { "t": "call", "p": "B" }],
    "B": [{ "t": "red" }, { "t": "move", "d": -75 }, { "t": "do" }]
  }
}
```

`current` is the program to show (`"A"` to `"D"`). `programs` has a list of
tiles for each of `"A"` to `"D"` (links leave out empty ones). A tile is an
object whose `t` says what it is:

| `t` | Other fields | The tile |
| --- | --- | --- |
| `move` | `d`: turtle steps, a multiple of 25 (a unit), ±25 to ±2475; negative goes back | Move or Back |
| `turn` | `a`: degrees, a multiple of 15, -165 to 180, not 0; positive turns right | a turn |
| `repeat` | `n`: 0 to 99 times; `body`: a list of tiles (no repeats inside) | a repeat |
| `call` | `p`: `"A"` to `"D"` | play that program |
| `home` | | Home |
| `red`, `orange`, `yellow`, `green`, `blue`, `purple`, `black` | | a crayon (pen down, in that color) |
| `nextcolor` | | Next color (round the rainbow) |
| `invisible` | | the white crayon (pen up) |
| `do`, `re`, `mi`, `fa`, `sol`, `la`, `ti`, `high-do` | | a note |
| `pendown`, `penup` | | Draw and Don't draw, from older strips |

Older saved strips used `walk`, `far`, `hop`, `left` and `right`, which load
as the tiles they became (`OLD` in the tiles code).

To keep old links working:

- Loading is forgiving. `clean()` in `src/tiles/program.ts` drops tiles it doesn't know,
  rounds and clamps numbers into range, and turns old names into new tiles.
  Never refuse a whole link over one tile.
- Don't rename or remove a `t` value or a field, and don't change what one
  means; add new ones. A change the old format can't express gets a new
  payload letter, and `z` and `j` keep decoding.
- The e2e tests open links frozen from 1.8.11 (`OLD_LINKS` in the tiles spec).
  Never change them. When the format grows, add a link made by the new
  version.

To update jslogo: sync the fork with upstream on GitHub, then
`git -C third_party/jslogo pull`, run `npm test`, and commit the submodule
change.
