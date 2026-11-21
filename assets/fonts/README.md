# Local font subsets

The page uses three small WOFF2 subsets from Google Fonts, self-hosted so the
design does not depend on fonts.googleapis.com:

- `inter-subset.woff2` — Inter variable subset, printable ASCII + arrows
- `mochiy-subset-2.woff2` — Mochiy Pop One subset, only the static Japanese labels
- `noto-display.woff2` — Noto Sans SC 900 subset, only the six hero-name glyphs + `!`

They are distributed under the SIL Open Font License; see the license files in
this directory. Family names are remapped to `KOKO Inter` / `KOKO Pop` /
`KOKO Display` in `style.css`. Dynamic Chinese/Japanese text falls back to the
system UI fonts.
