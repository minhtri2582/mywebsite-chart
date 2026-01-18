# MCP Kubernetes (Cursor)

MCP server kết nối Kubernetes qua `kubectl`, chạy bằng `stdio` để Cursor có thể gọi.

## Yêu cầu

- Node.js (>= 18)
- `kubectl` đã cài và có quyền truy cập cluster

## Cài đặt

```bash
cd mcp/k8s
npm install
```

## Cấu hình biến môi trường

Server đọc env theo thứ tự ưu tiên:

1. **`process.env`** (env khai báo trực tiếp trong cấu hình MCP của Cursor hoặc OS)
2. **`~/.cursor/.env`** (fallback)

Các biến hỗ trợ:

- `KUBECONFIG`: đường dẫn kubeconfig
- `KUBECTL_CONTEXT` hoặc `K8S_CONTEXT`: context mặc định
- `KUBECTL_NAMESPACE` hoặc `K8S_NAMESPACE`: namespace mặc định
- `KUBECTL_BIN` hoặc `K8S_KUBECTL_BIN`: binary kubectl (mặc định `kubectl`)
- `KUBECTL_TIMEOUT_MS` hoặc `K8S_TIMEOUT_MS`: timeout chạy kubectl (ms, mặc định 30000)

Ví dụ `~/.cursor/.env`:

```bash
KUBECONFIG=/Users/you/.kube/config
KUBECTL_CONTEXT=dev-cluster
KUBECTL_NAMESPACE=default
```

## Cấu hình MCP trong Cursor

Mở **Cursor Settings (JSON)** và thêm:

```json
{
  "mcpServers": {
    "k8s": {
      "command": "node",
      "args": ["/Users/tridlm/DevOps/mywebsite-chart/mcp/k8s/index.js"]
    }
  }
}
```

Nếu muốn set env trực tiếp trong config:

```json
{
  "mcpServers": {
    "k8s": {
      "command": "node",
      "args": ["/Users/tridlm/DevOps/mywebsite-chart/mcp/k8s/index.js"],
      "env": {
        "KUBECONFIG": "/Users/you/.kube/config",
        "KUBECTL_CONTEXT": "dev-cluster",
        "KUBECTL_NAMESPACE": "default"
      }
    }
  }
}
```

## Tools

- `k8s_get`: Get resources (read-only)
  - Input: `{ "kind": "pods", "name"?: "...", "namespace"?: "...", "context"?: "...", "output"?: "json|yaml|wide|name", "labels"?: "app=myapp", "fieldSelector"?: "status.phase=Running", "allNamespaces"?: boolean }`
- `k8s_describe`: Describe resource (read-only)
  - Input: `{ "kind": "pod", "name": "...", "namespace"?: "...", "context"?: "..." }`
- `k8s_logs`: Pod logs (read-only)
  - Input: `{ "name": "...", "namespace"?: "...", "context"?: "...", "container"?: "...", "tail"?: number, "since"?: "1h", "previous"?: boolean, "timestamps"?: boolean }`
- `k8s_get_contexts`: List contexts
  - Input: `{}`
- `k8s_current_context`: Current context
  - Input: `{}`
