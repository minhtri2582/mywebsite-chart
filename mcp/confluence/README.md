# MCP Confluence (Cursor)

MCP server kết nối Atlassian Confluence qua REST API, chạy bằng `stdio` để Cursor có thể gọi.

## Yêu cầu

- Node.js \(>= 18\)
- Atlassian API token \(Confluence Cloud\)

## Cài đặt

```bash
cd mcp/confluence
npm install
```

## Cấu hình biến môi trường

Server đọc env theo thứ tự ưu tiên:

1. **`process.env`** (env khai báo trực tiếp trong cấu hình MCP của Cursor)
2. **`~/.cursor/.env`** (fallback)

Tạo file `~/.cursor/.env`:

```bash
CONFLUENCE_BASE_URL=https://<site>.atlassian.net/wiki
CONFLUENCE_EMAIL=you@company.com
CONFLUENCE_API_TOKEN=xxxxxxxx
```

Ghi chú:

- **`CONFLUENCE_BASE_URL`**: dùng full base URL của Confluence, bao gồm context path nếu có. Với Confluence Cloud thường là `https://<site>.atlassian.net/wiki`.

## Cấu hình MCP trong Cursor

Mở **Cursor Settings (JSON)** và thêm:

```json
{
  "mcpServers": {
    "confluence": {
      "command": "node",
      "args": ["/Users/tridlm/DevOps/mywebsite-chart/mcp/confluence/index.js"]
    }
  }
}
```

Nếu bạn muốn **không dùng `~/.cursor/.env`**, có thể set trực tiếp env trong cấu hình:

```json
{
  "mcpServers": {
    "confluence": {
      "command": "node",
      "args": ["/Users/tridlm/DevOps/mywebsite-chart/mcp/confluence/index.js"],
      "env": {
        "CONFLUENCE_BASE_URL": "https://<site>.atlassian.net/wiki",
        "CONFLUENCE_EMAIL": "you@company.com",
        "CONFLUENCE_API_TOKEN": "xxxxxxxx"
      }
    }
  }
}
```

## Tools

- `confluence_search`: Search content bằng CQL
  - Input: `{ "cql": "...", "limit"?: number, "expand"?: string }`
- `confluence_get_page`: Lấy page theo content id
  - Input: `{ "id": "...", "expand"?: string }`
- `confluence_get_page_by_title`: Tìm page theo `spaceKey` + `title`
  - Input: `{ "spaceKey": "...", "title": "...", "expand"?: string }`
- `confluence_list_spaces`: List spaces
  - Input: `{ "limit"?: number }`
- `confluence_get_placeholders`: Quét placeholders dạng `{{PLACEHOLDER}}` trong title/body của 1 page (phù hợp cho template)
  - Input: `{ "id"?: "...", "spaceKey"?: "...", "title"?: "...", "includeTitle"?: boolean, "includeBody"?: boolean }`
- `confluence_clone_page`: Clone 1 page template sang space khác + thay placeholders theo map
  - Input: `{ "templateId"?: "...", "templateSpaceKey"?: "...", "templateTitle"?: "...", "destinationSpaceKey": "...", "destinationParentId"?: "...", "destinationTitle"?: "...", "replacements"?: { "INCIDENT_ID"?: "...", "INCIDENT_TITLE"?: "..." }, "replacePlaceholders"?: boolean }`
  - Ghi chú: `incidentId/incidentTitle` vẫn dùng được (tương thích ngược), và sẽ tự map sang `replacements.INCIDENT_ID / replacements.INCIDENT_TITLE`.

