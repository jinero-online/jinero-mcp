#!/usr/bin/env bash
# Runnable JSON-RPC examples against the live Jinero MCP server.
MCP=https://jinero.online/mcp
H1='Content-Type: application/json'
H2='Accept: application/json, text/event-stream'

# 1. Search fonts
curl -s -X POST "$MCP" -H "$H1" -H "$H2" -d '{
  "jsonrpc":"2.0","id":1,"method":"tools/call",
  "params":{"name":"search_fonts","arguments":{"name":"inter","category":"sans","per_page":2}}
}' | python3 -m json.tool

# 2. WCAG contrast check
curl -s -X POST "$MCP" -H "$H1" -H "$H2" -d '{
  "jsonrpc":"2.0","id":2,"method":"tools/call",
  "params":{"name":"check_contrast","arguments":{"fg":"#1d4ed8","bg":"#ffffff"}}
}' | python3 -m json.tool

# 3. Convert JSON to YAML
curl -s -X POST "$MCP" -H "$H1" -H "$H2" -d '{
  "jsonrpc":"2.0","id":3,"method":"tools/call",
  "params":{"name":"convert_code","arguments":{"code":"{\"name\":\"jinero\"}","from":"json","to":"yaml"}}
}' | python3 -m json.tool

# 4. Fluid CSS clamp()
curl -s -X POST "$MCP" -H "$H1" -H "$H2" -d '{
  "jsonrpc":"2.0","id":4,"method":"tools/call",
  "params":{"name":"generate_clamp","arguments":{"min_fs":16,"max_fs":24}}
}' | python3 -m json.tool
