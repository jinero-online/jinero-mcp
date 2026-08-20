# Jinero MCP Server

**`online.jinero/jinero`** — a hosted, remote [Model Context Protocol](https://modelcontextprotocol.io) server that gives AI agents (Claude, Cursor, Cline, Zed, Gemini CLI…) the design tools of [jinero.online](https://jinero.online/dev/mcp?ref=github): **22 read-only tools** for fonts (search, CSS, files, recognition from an image), color math (WCAG contrast, shades, naming, palette extraction), curated palettes, code minify/convert/detect, SVG optimization and SCSS helpers.

- **Endpoint:** `https://jinero.online/mcp` (Streamable HTTP)
- **Auth:** none — anonymous & free, rate-limited at 60 req/min per IP
- **Registry:** [`online.jinero/jinero`](https://registry.modelcontextprotocol.io/v0/servers?search=jinero) in the official MCP registry
- **Manifest:** [`/.well-known/mcp/server.json`](https://jinero.online/.well-known/mcp/server.json)
- **Human docs:** [jinero.online/dev/mcp](https://jinero.online/dev/mcp) — full reference with example responses

## Connect

**Claude Code (CLI):**

```bash
claude mcp add --transport http jinero https://jinero.online/mcp
```

**Claude Desktop / Cursor / Cline (config):**

```json
{
  "mcpServers": {
    "jinero": { "type": "http", "url": "https://jinero.online/mcp" }
  }
}
```

Older stdio-only clients can bridge with `npx mcp-remote https://jinero.online/mcp`.

## Trust & safety

Every tool declares MCP annotations, verifiable in `tools/list`:

- all 22 tools are **`readOnlyHint: true`** and **`idempotentHint: true`**;
- submitted code/SVG is parsed and transformed as text — **never executed, never stored**;
- uploaded images (font recognition, color extraction) are processed in memory and deleted immediately;
- only three tools fetch a user-supplied URL (`recognize_font`, `extract_colors`, `svg_to_datauri`) — marked `openWorldHint: true`, with SSRF-guarded, size-capped fetches.

> **A note for automated risk scanners:** some directories classify `minify_code`, `convert_code`, `generate_clamp` or `recognize_font` as "write" tools based on their verbs. They are pure functions — text/math in, text out; nothing on the server or the caller's side is modified. The authoritative signal is the `readOnlyHint: true` annotation each of the 22 tools declares in `tools/list` (snapshotted in [`tools.json`](tools.json)).

## Tests & CI

[`tests/tools.test.mjs`](tests/tools.test.mjs) exercises **every declared tool** against the live endpoint (zero dependencies, Node 20+):

```bash
npm test
```

CI runs the suite on every push and weekly ([workflow](.github/workflows/test.yml)), and [`tools.json`](tools.json) is a committed snapshot of the live `tools/list` — schemas and annotations included (`npm run update-snapshot` to refresh).

## Try it without a client

```bash
# List all tools
curl -s -X POST https://jinero.online/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

More runnable examples in [`examples/`](examples/).

## Tool reference

Generated from the live `tools/list` of the current server version.

### Fonts

#### `search_fonts`

Search the free font catalog by name, category, style tags, language coverage, variable/monospace flags and style count. Returns a paginated list of families.

*read-only · idempotent*

| Parameter | Type | Description |
|---|---|---|
| `name` | string | Fuzzy name match. |
| `category` | string | Comma-separated categories, e.g. 'serif,sans'. |
| `langs` | string | Comma-separated language codes, e.g. 'latin,cyrillic' — ALL must be supported. |
| `style` | string | Comma-separated style tags, e.g. 'handwriting,condensed' — ALL must match. One of: handwriting, script, display, slab, rounded, condensed, expanded, stencil, pixel, blackletter, outline, retro. |
| `variable` | boolean | Only variable fonts. |
| `monospace` | boolean | Only monospace fonts. |
| `styles_min` | integer | Minimum number of styles. |
| `styles_max` | integer | Maximum number of styles. |
| `order` | string: likes \| downloads \| views \| name \| created_at | Sort field, default 'likes'. |
| `sort` | string: asc \| desc | Sort direction. |
| `per_page` | integer | Results per page (default 24). |
| `page` | integer | Page number. |

#### `recognize_font`

Identify which font is used in an image. Powered by our OWN CNN embedding model, trained on the jinero font catalog — it matches fonts by visual shape/style, so it needs NO OCR and NO text (works for Latin and Cyrillic). Send a tight crop of one line of text as either image_url (public URL) or image_base64 (base64/data-URI, e.g. a local screenshot). The image is processed in memory and deleted immediately — never stored. Returns the most visually similar font families with scores. Fast (~200 ms).

*read-only · idempotent · fetches external URLs*

| Parameter | Type | Description |
|---|---|---|
| `image_url` | string | Public URL of an image — a tight crop of one line of text. Provide either this or image_base64. Recognition is by visual shape (no OCR/text needed); Latin & Cyrillic supported. |
| `image_base64` | string | Base64-encoded image (raw base64 or a data:image/...;base64 URI), max 8 MB decoded — use this to send a local file/screenshot without hosting it. Provide either this or image_url. |
| `top_k` | integer | Number of font matches to return (3–20, default 8). |

#### `get_font`

Get full metadata for one font family by slug: styles, weights, axes, license, subsets and download/CSS URLs.

*read-only · idempotent*

| Parameter | Type | Description |
|---|---|---|
| `slug` **(required)** | string | Family slug, e.g. 'inter', 'playfair-display'. |

#### `get_font_files`

List every font file (weight/italic/format + direct woff2/ttf URL) for a family — handy for building custom @font-face rules.

*read-only · idempotent*

| Parameter | Type | Description |
|---|---|---|
| `slug` **(required)** | string | Family slug, e.g. 'inter'. |

#### `get_fonts_css`

Generate ready-to-use @font-face CSS for a family spec (Google-Fonts-compatible), e.g. "inter:wght@400,700" or a variable range "inter:wght@300..900". Returns CSS text.

*read-only · idempotent*

| Parameter | Type | Description |
|---|---|---|
| `family` **(required)** | string | Family spec, e.g. "inter:wght@400,700" or "inter:wght@300..900". |
| `display` | string: swap \| auto \| block \| fallback \| optional | font-display value (default swap). |

#### `get_font_download_url`

Return the direct ZIP download URL for a font family (all styles + a ready fonts.css). Does NOT download — hand the URL to the user or fetch it separately.

*read-only · idempotent*

| Parameter | Type | Description |
|---|---|---|
| `slug` **(required)** | string | Family slug, e.g. 'inter'. |

### Colors

#### `check_contrast`

Check the WCAG contrast ratio between a foreground and background color, with AA/AAA pass/fail for normal and large text.

*read-only · idempotent*

| Parameter | Type | Description |
|---|---|---|
| `fg` **(required)** | string | Foreground color (hex, rgb(), or hsl()). |
| `bg` **(required)** | string | Background color (hex, rgb(), or hsl()). |

#### `get_color_shades`

Generate tints and shades for a base color (lighter/darker steps) with hex values.

*read-only · idempotent*

| Parameter | Type | Description |
|---|---|---|
| `hex` **(required)** | string | Base color in hex, rgb(), or hsl(). |
| `step` | string: 5 \| 10 \| 20 \| 25 | Step percentage (default 10). |
| `limit` | integer | Cap on tints/shades (default fills to ~100%). |

#### `name_color`

Get the closest human-readable name for one or more colors. Pass a single hex or several comma-separated (e.g. "#3b82f6,#000,#ff7f50"); returns each input with its nearest color name, the reference hex, an exact-match flag and the perceptual distance.

*read-only · idempotent*

| Parameter | Type | Description |
|---|---|---|
| `hex` **(required)** | string | A hex color, or several comma-separated (e.g. "#3b82f6,#000,#ff7f50"). Up to 100 at once. |

#### `extract_colors`

Extract a dominant-color palette from an image. Send either a public image_url or image_base64 (base64/data-URI, e.g. a local screenshot). The image is processed in memory and never stored. Each color comes back with its hex, rgb, hsl, share of the image, and the closest human color name — a named palette in one call.

*read-only · idempotent · fetches external URLs*

| Parameter | Type | Description |
|---|---|---|
| `image_url` | string | Public URL of the image to pull the palette from. Provide either this or image_base64. |
| `image_base64` | string | Base64-encoded image (raw base64 or a data:image/...;base64 URI), max 10 MB decoded — use this to send a local file/screenshot without hosting it. Provide either this or image_url. |
| `count` | integer | How many colors to return (2–16, default 8). |
| `mode` | string | Palette mode: "balanced" (default), "vibrant", or "muted". |

### Palettes

#### `search_palettes`

Search the color-palette catalog by name, tone, temperature, mood, harmony, exact color count and tags. Returns a paginated list.

*read-only · idempotent*

| Parameter | Type | Description |
|---|---|---|
| `name` | string | Fuzzy name match. |
| `tone` | string: light \| dark \| mixed | Overall tone. |
| `temperature` | string: warm \| cool \| neutral | Color temperature. |
| `mood` | string | e.g. pastel, muted, earthy, vibrant, monochrome. |
| `harmony` | string | e.g. analogous, complementary, triadic, monochromatic, split-complementary, tetradic. |
| `color_count` | integer | Exact number of colors. |
| `tags` | array | Tag slugs — ALL must match (AND). |
| `order` | string: newest \| popular \| name | Sort order (default newest). |
| `per_page` | integer | Results per page (default 24). |
| `page` | integer | Page number. |

#### `get_palette`

Get one color palette by id: its colors (hex), name/derived title, mood, harmony, temperature and tags.

*read-only · idempotent*

| Parameter | Type | Description |
|---|---|---|
| `id` **(required)** | integer | Palette id. |

### Code

#### `minify_code`

Minify or beautify JS, CSS, HTML, SVG, JSON or XML text. Set type=auto to sniff the language. The code is only parsed and re-printed — never executed and never stored.

*read-only · idempotent*

| Parameter | Type | Description |
|---|---|---|
| `code` **(required)** | string | Source code to transform. |
| `type` **(required)** | string: js \| css \| html \| svg \| json \| xml \| auto | Source language, or 'auto' to sniff. |
| `mode` | string: minify \| beautify | Default minify. |
| `keep_license` | boolean | Preserve /*! ... */ license comments when minifying. |

#### `detect_code`

Detect the language/format of a code snippet. Static analysis only — the snippet is never executed and never stored.

*read-only · idempotent*

| Parameter | Type | Description |
|---|---|---|
| `code` **(required)** | string | Snippet to inspect. Max 200,000 chars. |

#### `convert_code`

Convert code between text formats (e.g. JSON↔YAML, CSS↔SCSS). Pure text transformation: the source is parsed and re-serialized, never executed and never stored. Use list_code_converters for valid from/to ids and per-converter options.

*read-only · idempotent*

| Parameter | Type | Description |
|---|---|---|
| `code` **(required)** | string | Source code to convert. |
| `from` **(required)** | string | Source format id (see list_code_converters). |
| `to` **(required)** | string | Target format id. |
| `options` | object | Per-converter options (see optionsSchema in list_code_converters). |

#### `list_code_converters`

List available code converters with their from/to ids and per-converter option schemas.

*read-only · idempotent*

_No parameters._

### SVG

#### `optimize_svg`

Optimize/clean SVG markup (SVGO). Pure markup transformation — nothing is executed or stored. Returns minified SVG plus before/after sizes.

*read-only · idempotent*

| Parameter | Type | Description |
|---|---|---|
| `svg` **(required)** | string | SVG source. Max 500,000 chars. |
| `preset` | string: safe \| balanced \| aggressive | Optimization preset (default balanced). |

#### `svg_to_datauri`

Encode an SVG (or fetched image) as a CSS-ready data: URI. Provide either raw svg or a url.

*read-only · idempotent · fetches external URLs*

| Parameter | Type | Description |
|---|---|---|
| `svg` | string | Raw SVG markup. Mutually exclusive with url. |
| `url` | string | Public image URL the server will fetch. |
| `encoding` | string: utf8 \| base64 | Defaults: utf8 for SVG, base64 for raster. |
| `quotes` | string: single \| double | Quote style for the data URI (default double). |

#### `list_svg_presets`

List the available SVG optimization presets and what each one does.

*read-only · idempotent*

_No parameters._

### Dev

#### `list_scss_mixins`

List the SCSS mixin catalog (id, title, short description), optionally filtered by group or search.

*read-only · idempotent*

| Parameter | Type | Description |
|---|---|---|
| `group` | string | e.g. Bootstrap, Project, Pattern, Placeholder. |
| `search` | string | Fuzzy substring across id/title/short/desc. |
| `fields` | string: summary \| full | Detail level (default summary). |

#### `get_scss_mixin`

Get one SCSS mixin by id: full source, parameters and usage example.

*read-only · idempotent*

| Parameter | Type | Description |
|---|---|---|
| `id` **(required)** | string | Mixin id (kebab-case), e.g. 'centerer', 'media-breakpoint-up'. |

#### `generate_clamp`

Calculate a fluid CSS clamp() expression for responsive sizing between two viewport widths. Pure calculation — returns a CSS snippet, writes and stores nothing.

*read-only · idempotent*

| Parameter | Type | Description |
|---|---|---|
| `min_fs` **(required)** | number | Minimum size in px. |
| `max_fs` **(required)** | number | Maximum size in px. |
| `min_vw` | number | Viewport width at min_fs (default 320). |
| `max_vw` | number | Viewport width at max_fs (default 1440). |
| `unit` | string: px \| rem \| both | Output unit (default rem). |
| `root` | number | Root font-size in px for rem conversion (default 16). |

## About

Built and operated by [jinero.online](https://jinero.online) — free design tools for fonts, icons, colors and code. The MCP server is a thin wrapper over the same [public REST API](https://jinero.online/dev/api): one contract, identical behavior.

This repository holds the public documentation and examples for the server. Issues and feature requests for the tools are welcome here.
