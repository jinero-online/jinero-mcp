// Regenerate tools.json from the live tools/list (handles pagination).
//   npm run update-snapshot
import { writeFileSync } from "node:fs";

const ENDPOINT = process.env.JINERO_MCP_URL || "https://jinero.online/mcp";

async function rpc(method, params = {}) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const body = await res.json();
  if (body.error) throw new Error(JSON.stringify(body.error));
  return body.result;
}

const tools = [];
let cursor;
do {
  const page = await rpc("tools/list", cursor ? { cursor } : {});
  tools.push(...page.tools);
  cursor = page.nextCursor;
} while (cursor);

writeFileSync(
  new URL("../tools.json", import.meta.url),
  JSON.stringify(
    {
      server: "online.jinero/jinero",
      endpoint: "https://jinero.online/mcp",
      note: "Snapshot of the live tools/list. Regenerate: npm run update-snapshot",
      tools,
    },
    null,
    2
  ) + "\n"
);
console.log(`tools.json updated: ${tools.length} tools`);
