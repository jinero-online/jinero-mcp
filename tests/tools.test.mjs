// Live smoke tests: every declared tool is exercised against the hosted server.
// Zero dependencies — Node 20+ built-in test runner and fetch.
//   node --test tests/
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const ENDPOINT = process.env.JINERO_MCP_URL || "https://jinero.online/mcp";
let rpcId = 0;

async function rpc(method, params = {}) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }),
  });
  assert.equal(res.status, 200, `${method} HTTP ${res.status}`);
  const body = await res.json();
  assert.ok(!body.error, `${method} RPC error: ${JSON.stringify(body.error)}`);
  return body.result;
}

async function callTool(name, args = {}) {
  const result = await rpc("tools/call", { name, arguments: args });
  assert.ok(!result.isError, `${name} returned isError: ${JSON.stringify(result.content)}`);
  const text = result.content?.find((c) => c.type === "text")?.text ?? "";
  assert.ok(text.length > 0, `${name} returned empty content`);
  try {
    return JSON.parse(text);
  } catch {
    return text; // деякі тули віддають plain text (CSS тощо)
  }
}

// ---------------------------------------------------------------- tools/list

const listed = [];
{
  let cursor;
  do {
    const page = await rpc("tools/list", cursor ? { cursor } : {});
    listed.push(...page.tools);
    cursor = page.nextCursor;
  } while (cursor);
}

test("tools/list declares 22 tools, all read-only and idempotent", () => {
  assert.equal(listed.length, 22);
  for (const t of listed) {
    assert.equal(t.annotations?.readOnlyHint, true, `${t.name} must be readOnlyHint`);
    assert.equal(t.annotations?.idempotentHint, true, `${t.name} must be idempotentHint`);
  }
});

test("tools/list matches the committed tools.json snapshot", () => {
  const snapshot = JSON.parse(readFileSync(new URL("../tools.json", import.meta.url), "utf8"));
  const live = new Set(listed.map((t) => t.name));
  const snap = new Set(snapshot.tools.map((t) => t.name));
  assert.deepEqual([...live].sort(), [...snap].sort());
});

// ---------------------------------------------------------------- fonts

let fontSlug;

test("search_fonts", async () => {
  const r = await callTool("search_fonts", { per_page: 3, order: "downloads" });
  const first = r.fonts?.[0] ?? r.data?.[0] ?? r.results?.[0];
  assert.ok(first, `no fonts in response: ${JSON.stringify(r).slice(0, 200)}`);
  fontSlug = first.slug;
  assert.ok(fontSlug, "font entry has a slug");
});

test("get_font", async () => {
  const r = await callTool("get_font", { slug: fontSlug });
  assert.ok(JSON.stringify(r).includes(fontSlug));
});

test("get_font_files", async () => {
  const r = await callTool("get_font_files", { slug: fontSlug });
  assert.ok(JSON.stringify(r).match(/woff2|ttf/i));
});

test("get_fonts_css", async () => {
  // plain slug = усі накреслення; конкретна вага могла б бути відсутня в родини
  const r = await callTool("get_fonts_css", { family: fontSlug });
  assert.ok(String(typeof r === "string" ? r : JSON.stringify(r)).includes("@font-face"));
});

test("get_font_download_url", async () => {
  const r = await callTool("get_font_download_url", { slug: fontSlug });
  assert.ok(JSON.stringify(r).includes("http"));
});

test("recognize_font (image_base64, no OCR)", async () => {
  const png = readFileSync(new URL("./fixtures/sample-text.png", import.meta.url));
  const r = await callTool("recognize_font", {
    image_base64: png.toString("base64"),
    top_k: 3,
  });
  const matches = r.matches ?? r.results ?? [];
  assert.ok(matches.length > 0, `no matches: ${JSON.stringify(r).slice(0, 200)}`);
});

// ---------------------------------------------------------------- colors

test("check_contrast", async () => {
  const r = await callTool("check_contrast", { fg: "#000000", bg: "#ffffff" });
  assert.ok(JSON.stringify(r).includes("21"), "black on white is ratio 21");
});

test("get_color_shades", async () => {
  const r = await callTool("get_color_shades", { hex: "#3b82f6", step: "10" });
  assert.ok(JSON.stringify(r).match(/#[0-9a-f]{6}/i));
});

test("name_color", async () => {
  const r = await callTool("name_color", { hex: "#3b82f6,#000000" });
  assert.ok(JSON.stringify(r).toLowerCase().includes("black"));
});

test("extract_colors (image_base64)", async () => {
  const png = readFileSync(new URL("./fixtures/sample-text.png", import.meta.url));
  const r = await callTool("extract_colors", {
    image_base64: png.toString("base64"),
    count: 4,
  });
  assert.ok(JSON.stringify(r).match(/#[0-9a-f]{6}/i));
});

// ---------------------------------------------------------------- palettes

test("search_palettes → get_palette", async () => {
  const r = await callTool("search_palettes", { per_page: 1 });
  const first = r.palettes?.[0] ?? r.data?.[0] ?? r.results?.[0];
  assert.ok(first?.id, `no palette id: ${JSON.stringify(r).slice(0, 200)}`);
  const p = await callTool("get_palette", { id: first.id });
  assert.ok(JSON.stringify(p).match(/#[0-9a-f]{3,6}/i));
});

// ---------------------------------------------------------------- code

test("minify_code", async () => {
  const r = await callTool("minify_code", { code: ".a { color: red; }", type: "css" });
  assert.ok(JSON.stringify(r).includes(".a{color:red}"));
});

test("detect_code", async () => {
  const r = await callTool("detect_code", { code: "function x() { return 1; }" });
  assert.ok(JSON.stringify(r).toLowerCase().includes("js"));
});

test("list_code_converters → convert_code", async () => {
  const list = await callTool("list_code_converters", {});
  const raw = JSON.stringify(list);
  assert.ok(raw.includes("json"), "converters include json");
  const r = await callTool("convert_code", { code: '{"a": 1}', from: "json", to: "yaml" });
  assert.ok(JSON.stringify(r).includes("a: 1"));
});

// ---------------------------------------------------------------- svg

test("optimize_svg", async () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><!-- c --><rect width="10" height="10" fill="#ff0000"/></svg>';
  const r = await callTool("optimize_svg", { svg, preset: "balanced" });
  assert.ok(!JSON.stringify(r).includes("<!--"), "comments stripped");
});

test("svg_to_datauri", async () => {
  const r = await callTool("svg_to_datauri", { svg: '<svg xmlns="http://www.w3.org/2000/svg"/>' });
  assert.ok(JSON.stringify(r).includes("data:image/svg+xml"));
});

test("list_svg_presets", async () => {
  const r = await callTool("list_svg_presets", {});
  assert.ok(JSON.stringify(r).includes("balanced"));
});

// ---------------------------------------------------------------- dev

test("list_scss_mixins → get_scss_mixin", async () => {
  const list = await callTool("list_scss_mixins", { fields: "summary" });
  const first = list.items?.[0];
  assert.ok(first?.id, `no mixin id: ${JSON.stringify(list).slice(0, 200)}`);
  const m = await callTool("get_scss_mixin", { id: first.id });
  assert.ok(JSON.stringify(m).includes("@mixin"));
});

test("generate_clamp", async () => {
  const r = await callTool("generate_clamp", { min_fs: 16, max_fs: 24 });
  assert.ok(JSON.stringify(r).includes("clamp("));
});
