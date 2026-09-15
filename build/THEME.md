# Theme — "dark terminal / CRT"

The visual language used by `stop_viz` (`static/style.css` + `static/stops.css`).
Everything below is presentation only; copy it wholesale into another tool and it
will look like the same product.

---

## 1. Palette

Base tokens live on `:root` in `style.css`.

```css
:root {
  --bg:        #05070a;   /* app background, near-black                */
  --bg-panel:  #080c11;   /* panel / block surface                     */
  --bg-raised: #0d141c;   /* inputs, list rows, cells — one step up    */
  --grid:      #101820;   /* faint grid lines                          */
  --line:      #16222e;   /* every border, and the 1px gutter colour   */
  --fg:        #b9d4c8;   /* body text, faintly green-tinted           */
  --fg-dim:    #5c7488;   /* labels, meta, secondary text              */
  --fg-bright: #e6fff4;   /* headings, values, emphasis                */

  --accent:    #00ff9c;   /* neon green — primary, focus, active       */
  --accent-2:  #00e5ff;   /* cyan — secondary / links / readouts       */
  --warn:      #ffb000;   /* amber                                     */
  --error:     #ff2e5b;   /* hot pink-red                              */
  --magenta:   #ff45d0;   /* fourth status hue                         */

  --mono: "JetBrains Mono", "Cascadia Mono", "Fira Code", Consolas,
          "Courier New", monospace;
}
```

Rules of use:

- **Only three surfaces.** `--bg` (app) → `--bg-panel` (block) → `--bg-raised`
  (interactive element inside a block). Never invent a fourth.
- `#12202c` is the universal **hover** surface, `#14273a` the **selected**
  surface, `#2a4055` the **hover border**. Hard-coded on purpose — they are
  hover states, not semantic colours.
- Text on an accent-filled surface is `#04120c` (near-black green), never white.
- `#3d5163` is the placeholder colour for all inputs.

### Categorical colours (when you need to identify N things)

Five hues, fixed order, **never cycled**; validated for protan/deutan
separation against these surfaces. A sixth item falls back to grey, and the
item is always *also* labelled with a number or letter so identity never rests
on colour alone.

```css
--c1: #0a8fd1;  --c2: #e94101;  --c3: #0c9f5f;
--c4: #975afe;  --c5: #ea02a1;  --c-more: #7f93a3;
```

### Sequential ramp (when you need magnitude)

One hue, dark → bright, monotone in OKLCH lightness (~0.07 per step). The
darkest step still clears 2:1 contrast on `--bg-raised`.

```css
--d1: #00525c; --d2: #006773; --d3: #007d8c; --d4: #0894a5; --d5: #1eabbd;
```

Always render the ramp itself somewhere near the thing it colours, as swatch +
range label.

---

## 2. Typography

- **Monospace everywhere.** `--mono`, no exceptions — including Leaflet, inputs
  and buttons (`font-family: var(--mono)` is set explicitly on form controls
  since they don't inherit).
- Base size `13px`. The scale in practice:
  `14px` group title · `13px` body · `12–12.5px` inputs · `11.5px` list rows ·
  `10.5px` meta/hints · `9.5–10px` legends and tags.
- **Section headings** are the signature move: `11px`, uppercase,
  `letter-spacing: 1.6px`, coloured `--accent`, with a green glow
  (`text-shadow: 0 0 8px rgba(0,255,156,.35)`) and prefixed with a literal
  `&gt;` in the markup — `> distance_matrix`.
- Identifiers are written `snake_case` in the UI copy (`name_groups`,
  `split_or_group`), continuing the terminal fiction.
- Uppercase + `letter-spacing: .6–1.2px` for any small tag, legend title, or
  status label.

---

## 3. Chrome and layout

### Global CRT overlay

A fixed, non-interactive layer over the whole app: 1px green scanlines every
3px, plus a vignette. This single element carries most of the theme's identity.

```html
<div class="scanlines"></div>
```
```css
.scanlines {
  position: fixed; inset: 0; pointer-events: none; z-index: 9000;
  background:
    repeating-linear-gradient(to bottom,
      rgba(0,255,156,.03) 0px, rgba(0,255,156,.03) 1px,
      transparent 1px, transparent 3px),
    radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,.55) 100%);
}
```

### Topbar

44px tall, `linear-gradient(180deg, #0a1119, #05080c)`, bottom border `--line`,
and a faint green bloom `box-shadow: 0 0 24px rgba(0,255,156,.06)`.
Brand reads `█ TOOL<span class=dim>::</span>SECTION _` where the block glyph is
accent-coloured with a glow and the trailing `_` blinks on a 1.05s step
animation. Right side holds counters: dim labels, `--accent` bold values.

### Shell

`display:flex`, `height: calc(100% - 44px)`, `body { overflow: hidden }` — the
page never scrolls; individual panes do.

Panels are **separated by 1px gutters made of background, not borders**: the
column gets `background: var(--line)` and `gap: 1px`, and each `.block` inside
paints `--bg-panel` over it. Fixed side widths (300–430px, `flex:none`), fluid
centre (`flex:1; min-width:0`).

```css
.block { background: var(--bg-panel); padding: 11px 12px 13px; }
.block.grow { flex:1; display:flex; flex-direction:column; min-height:0; }
```

Scrolling panes: put the scroll on a wrapper, keep the footer/action bar outside
it so it is always reachable.

---

## 4. Components

**Radius is `2px` everywhere.** Nothing is rounder except circular markers and
status dots. No drop shadows for depth — depth comes from surface steps; shadows
are only ever coloured *glows*.

### Inputs / selects

`--bg-raised` fill, `1px solid var(--line)`, `--fg-bright` text, `outline:none`.
Focus is the accent tell:

```css
:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px rgba(0,255,156,.25), 0 0 14px rgba(0,255,156,.15);
}
```

### Segmented button bar (`.segbar`)

Flex row of equal buttons, `gap:5px`, `--bg-raised` / `--fg-dim` at rest,
`transition: all .12s`. Hover lifts text to `--fg-bright` and border to
`#2a4055`. Active/primary inverts: `background: var(--accent)`, text `#04120c`,
`font-weight:700`. Disabled = `opacity:.4`.

### List rows (`.glist`, `.pairs`, `.issues`, `.editor`)

The workhorse pattern:

```css
li {
  border-left: 2px solid var(--fg-dim);   /* status colour goes here */
  background: var(--bg-raised);
  padding: 5px 8px; margin-bottom: 3px;
  font-size: 11.5px; line-height: 1.4; cursor: pointer;
}
li:hover { background: #12202c; }
li.sel   { background: #14273a; border-left-color: var(--accent); }
```

Row internals: `.nm` bright, ellipsised, `flex:1` · `.meta` dim, 10.5px ·
a right-aligned uppercase status word in the status colour.
Empty state is a centred dim line with no border or background.

### Status colours via `--vc`

Status classes **only name** their colour; consumers decide where it lands.
This avoids specificity fights and is the pattern to copy for any enum:

```css
.v-coords_off_road   { --vc: var(--error); }
.v-nearby_distinct   { --vc: var(--warn); }
.v-duplicate_point   { --vc: var(--accent); }

.glist li      { border-left-color: var(--vc, var(--fg-dim)); }
.glist li .vd  { color: var(--vc, var(--fg-dim)); }
.legend .dot   { background: var(--vc); box-shadow: 0 0 7px var(--vc); }
```

### Pills, tags, dots

- `.pill` — count chip, `margin-left:auto` inside an `h2`, `--bg-raised`,
  `1px solid var(--line)`, dim text.
- `.vtag` — uppercase 10px tag, `--bg-raised` fill, border **and** text in `--vc`.
- `.dot` — 8px circle, filled with the status colour, `box-shadow: 0 0 7px` of
  the same colour. The glow is what makes it read as a terminal LED.

### Data tables

`border-collapse: separate; border-spacing: 2px` — cells float as separate
tiles on the panel background rather than sharing gridlines. Sticky `th` in
`--bg-panel`. Cells are `--bg-raised` by default, or ramp-filled; when a cell is
filled with a light ramp step, switch its text to `.ink-dark` (`#041014` /
`#0d2a30`) instead of white. Hover/selection are `outline: 2px solid` with
`outline-offset: -2px`, never a background change.

### Floating map/canvas overlays

`position:absolute`, `z-index:800`, `background: rgba(5,8,12,.86)`,
`1px solid var(--line)`, `border-radius:2px`, 10.5px text. Title line is
uppercase `--accent` at 9.5px. Keep the top-left corner free for the zoom
control; put legends top-right, tool toggles bottom-left, readouts bottom-right.

### Scrollbars

```css
::-webkit-scrollbar       { width: 9px; height: 9px; }
::-webkit-scrollbar-track { background: var(--bg-panel); }
::-webkit-scrollbar-thumb { background: #1c2c3a; border-radius: 0; }
::-webkit-scrollbar-thumb:hover { background: #2a4055; }
```

---

## 5. Maps (if applicable)

- Basemap: CARTO `dark_all` —
  `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png`
- Lift it out of near-black so geometry reads under the neon overlays, and match
  the container background so panning past the edge doesn't flash:

```css
.leaflet-tile-pane  { filter: brightness(1.55) contrast(0.88) saturate(0.6); }
.leaflet-container  { background: #1b1f26; font-family: var(--mono); }
```

- Zoom control: `--bg-raised` fill, `--accent` glyphs, `--line` border (`!important`).
- Attribution: `rgba(5,7,10,.75)`, 9px, `#3d5163`.
- Markers glow in their status colour via `filter: drop-shadow(0 0 3–6px …)`;
  hover bumps to `drop-shadow(0 0 9px currentColor) brightness(1.4)`.
- Tooltips/popups: `rgba(6,10,14,.94)` fill, `1px solid var(--accent)` (or the
  status colour), `border-radius:2px`, `box-shadow: 0 0 18–26px` accent at
  20–30% — the arrow `::before` is hidden.
- Custom disc markers: 22px circle, sub-group colour fill, `#04120c` bold text,
  `2px solid rgba(5,8,12,.85)` ring, and a small badge at `top:-7px; right:-7px`
  carrying the number.

---

## 6. Motion

Sparse and mechanical — nothing eases.

| Effect | Spec |
|---|---|
| Interactive transition | `transition: all .12s` (buttons only) |
| Blinking cursor | `animation: blink 1.05s steps(1) infinite` (50% → opacity 0) |
| Loading dots | `steps(4,end)` swapping `content: "" → "..."` |
| Marching-ants line | `stroke-dashoffset: -18` over `1.1s linear infinite` |

Always honour reduced motion:

```css
@media (prefers-reduced-motion: reduce) {
  .cursor, .dots::after, .flow { animation: none; }
}
```

---

## 7. Responsive

One breakpoint; only the fixed side columns shrink.

```css
@media (max-width: 1400px) {
  #detail { width: 370px; }
  #panel  { width: 260px; }
}
```

---

## 8. Checklist for a new tool

1. Link `style.css` first, then a page-specific stylesheet that only adds what
   the page introduces.
2. Drop in `<div class="scanlines"></div>` as the first child of `<body>`.
3. Topbar: `█ TOOL::SECTION _` on the left, dim-label/accent-value counters right.
4. Flex shell, `--line` background with 1px gaps, `.block` sections with
   `> lowercase_heading` titles.
5. Reuse `.segbar`, `.pill`, `.chk`, list-row and `--vc` patterns verbatim.
6. Radius 2px, mono everywhere, glow instead of shadow, `#04120c` on accent fills.
