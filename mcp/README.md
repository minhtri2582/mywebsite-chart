# Cấu hình MCP cho Codex

Tài liệu này hướng dẫn cài đặt các MCP server trong thư mục này và kết nối chúng với Codex CLI hoặc Codex IDE extension.

Codex đọc cấu hình MCP từ một trong hai vị trí:

- `~/.codex/config.toml`: dùng cho mọi project của user.
- `.codex/config.toml`: chỉ dùng cho project hiện tại; project phải được đánh dấu là trusted.

Codex CLI và IDE extension dùng chung cấu hình này. Xem thêm [tài liệu MCP chính thức của Codex](https://developers.openai.com/codex/mcp/).

## Yêu cầu

- Cài đặt Codex CLI và kiểm tra bằng `codex --version`.
- Node.js 18 trở lên và `npx` cho các server chạy bằng Node.js.
- Export các token cần thiết trong shell trước khi khởi động Codex. Không commit token vào repository hoặc ghi trực tiếp token vào `config.toml`.

Ví dụ:

```bash
export GITHUB_PERSONAL_ACCESS_TOKEN="<github-token>"
export GITLAB_PERSONAL_ACCESS_TOKEN="<gitlab-token>"
export GITLAB_URL="https://gitlab.com"
codex
```

## 1. GitHub MCP Server

Server này hỗ trợ thao tác với repository, issue, pull request và tìm kiếm code trên GitHub.

Thêm vào `~/.codex/config.toml` hoặc `.codex/config.toml`:

```toml
[mcp_servers.github]
command = "npx"
args = ["-y", "@modelcontextprotocol/server-github"]
env_vars = ["GITHUB_PERSONAL_ACCESS_TOKEN"]
startup_timeout_sec = 30
```

Tạo token tại [GitHub Settings](https://github.com/settings/tokens) và chỉ cấp các quyền thực sự cần thiết. Với classic personal access token, các scope thường dùng là `repo`, `read:user`, `user:email` và `read:org`.

## 2. GitLab MCP Server

Server community này hỗ trợ làm việc với project, issue và merge request trên GitLab.

```toml
[mcp_servers.gitlab]
command = "npx"
args = ["-y", "@yoda-digital/mcp-gitlab-server"]
env_vars = ["GITLAB_PERSONAL_ACCESS_TOKEN", "GITLAB_URL"]
startup_timeout_sec = 30
```

Đặt `GITLAB_URL` thành `https://gitlab.com` hoặc URL GitLab self-hosted của công ty.

## 3. Các MCP server trong repository

Các server local cần được cài dependency trước:

```bash
cd /absolute/path/to/mywebsite-chart/mcp/confluence && npm install
cd /absolute/path/to/mywebsite-chart/mcp/k8s && npm install
cd /absolute/path/to/mywebsite-chart/mcp/aws && npm install
cd /absolute/path/to/mywebsite-chart/mcp/opensearch
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

Sau đó thêm server cần dùng vào `config.toml`. Thay `/absolute/path/to/mywebsite-chart` bằng đường dẫn tuyệt đối trên máy của bạn.

```toml
[mcp_servers.confluence]
command = "node"
args = ["/absolute/path/to/mywebsite-chart/mcp/confluence/index.js"]
env_vars = ["CONFLUENCE_BASE_URL", "CONFLUENCE_EMAIL", "CONFLUENCE_API_TOKEN"]

[mcp_servers.k8s]
command = "node"
args = ["/absolute/path/to/mywebsite-chart/mcp/k8s/index.js"]
env_vars = ["KUBECONFIG", "KUBECTL_CONTEXT", "KUBECTL_NAMESPACE"]

[mcp_servers.aws]
command = "node"
args = ["/absolute/path/to/mywebsite-chart/mcp/aws/index.js"]
env_vars = ["AWS_PROFILE", "AWS_REGION"]

[mcp_servers.opensearch]
command = "/absolute/path/to/mywebsite-chart/mcp/opensearch/.venv/bin/python"
args = ["/absolute/path/to/mywebsite-chart/mcp/opensearch/server.py"]
env_vars = ["OPENSEARCH_URL", "OPENSEARCH_USERNAME", "OPENSEARCH_PASSWORD", "OPENSEARCH_VERIFY_SSL"]
```

Chi tiết riêng của từng server:

- [Kubernetes](./k8s/README.md)
- [Confluence](./confluence/README.md)
- [AWS](./aws/package.json)
- [OpenSearch](./opensearch/README.md)

## 4. Cấu hình bằng Codex CLI

Ngoài cách sửa `config.toml`, có thể thêm STDIO server bằng CLI:

```bash
codex mcp add github \
  --env GITHUB_PERSONAL_ACCESS_TOKEN="$GITHUB_PERSONAL_ACCESS_TOKEN" \
  -- npx -y @modelcontextprotocol/server-github
```

Lưu ý: tùy chọn `--env` lưu giá trị vào cấu hình Codex. Nếu không muốn token xuất hiện trong `config.toml`, hãy dùng cấu hình `env_vars` ở trên để Codex chuyển tiếp biến từ môi trường hiện tại.

## 5. Kiểm tra cấu hình

Liệt kê các server đã cấu hình:

```bash
codex mcp list
```

Trong Codex TUI, chạy `/mcp` để xem trạng thái server và các tool đã kết nối. Trong IDE extension, mở **Settings > MCP servers**, sau đó restart extension nếu vừa thay đổi cấu hình.

Bạn cũng có thể thử các yêu cầu như:

- `Liệt kê các issue đang mở trong repository GitHub này.`
- `Tìm các project GitLab có tên devops.`
- `Liệt kê pod trong namespace default bằng MCP Kubernetes.`

Nếu server không khởi động, chạy `codex mcp --help`, kiểm tra lại đường dẫn tuyệt đối, biến môi trường và tăng `startup_timeout_sec` khi `npx` cần tải package lần đầu.
