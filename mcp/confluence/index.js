import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

function parseDotEnv(contents) {
  const out = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const normalized = line.startsWith("export ") ? line.slice(7).trim() : line;
    const eq = normalized.indexOf("=");
    if (eq <= 0) continue;
    const key = normalized.slice(0, eq).trim();
    let value = normalized.slice(eq + 1).trim();

    // Basic quote handling: KEY="value" or KEY='value'
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key) out[key] = value;
  }
  return out;
}

function loadWorkspaceEnvFile() {
  const startDir =
    process.env.CURSOR_WORKSPACE_ROOT ||
    process.env.WORKSPACE_ROOT ||
    process.cwd();

  const searchPaths = [];

  // 1. Check specific workspace root variables if they exist
  if (process.env.CURSOR_WORKSPACE_ROOT) {
    searchPaths.push(path.join(process.env.CURSOR_WORKSPACE_ROOT, ".env"));
  }
  if (process.env.WORKSPACE_ROOT) {
    searchPaths.push(path.join(process.env.WORKSPACE_ROOT, ".env"));
  }

  // 2. Walk up from current directory
  let curr = process.cwd();
  while (true) {
    searchPaths.push(path.join(curr, ".env"));
    const parent = path.dirname(curr);
    if (parent === curr) break;
    curr = parent;
  }

  // 3. Check home directory fallback (~/.cursor/.env)
  try {
    searchPaths.push(path.join(os.homedir(), ".cursor", ".env"));
  } catch {
    // ignore
  }

  for (const envPath of searchPaths) {
    try {
      if (fs.existsSync(envPath)) {
        const contents = fs.readFileSync(envPath, "utf8");
        const values = parseDotEnv(contents);
        // Only return if it actually has values or we've reached a high-priority path
        if (Object.keys(values).length > 0) {
          return { envPath, values, exists: true };
        }
      }
    } catch {
      continue;
    }
  }

  return {
    envPath: path.join(startDir, ".env"),
    values: {},
    exists: false,
  };
}

function requiredEnv(name, { fileEnv }) {
  const v = process.env[name] ?? fileEnv.values[name];
  if (!v || !v.trim()) {
    const hint = fileEnv.exists
      ? `Set ${name} in your MCP server config or in ${fileEnv.envPath}.`
      : `Set ${name} in your MCP server config (or create ${fileEnv.envPath}).`;
    throw new Error(
      `Missing required env var ${name}. ${hint}`
    );
  }
  return v.trim();
}

function normalizeBaseUrl(raw) {
  // Expect the full Confluence base URL including any context path.
  // Confluence Cloud typically uses: https://<site>.atlassian.net/wiki
  return raw.replace(/\/+$/, "");
}

function jsonText(result) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}

function errorText(message, extra = {}) {
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: JSON.stringify({ error: message, ...extra }, null, 2),
      },
    ],
  };
}

function applyPlaceholders(text, replacements) {
  const input = String(text ?? "");
  if (!replacements || typeof replacements !== "object") return input;

  // Fixed regex (no user-controlled pattern) to avoid ReDoS.
  return input.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (match, name) => {
    if (!Object.prototype.hasOwnProperty.call(replacements, name)) return match;
    const v = replacements[name];
    if (v === undefined || v === null) return match;
    return String(v);
  });
}

function extractPlaceholders(text) {
  const out = new Map();
  const re = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;
  const input = String(text ?? "");
  let m;
  while ((m = re.exec(input)) !== null) {
    const name = m[1];
    out.set(name, (out.get(name) ?? 0) + 1);
  }
  return [...out.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function main() {
  const fileEnv = loadWorkspaceEnvFile();
  const baseUrl = normalizeBaseUrl(
    requiredEnv("CONFLUENCE_BASE_URL", { fileEnv })
  );
  const email = requiredEnv("CONFLUENCE_EMAIL", { fileEnv });
  const token = requiredEnv("CONFLUENCE_API_TOKEN", { fileEnv });

  const restBase = `${baseUrl}/rest/api`;
  const auth = Buffer.from(`${email}:${token}`, "utf8").toString("base64");

  async function confluenceFetch(
    path,
    { query, method = "GET", jsonBody } = {}
  ) {
    const url = new URL(`${restBase}${path}`);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v === undefined || v === null) continue;
        url.searchParams.set(k, String(v));
      }
    }

    const headers = {
      Accept: "application/json",
      Authorization: `Basic ${auth}`,
    };
    const body =
      jsonBody === undefined ? undefined : JSON.stringify(jsonBody, null, 0);
    if (body !== undefined) headers["Content-Type"] = "application/json";

    const res = await fetch(url.toString(), {
      method,
      headers,
      body,
    });

    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text };
    }

    if (!res.ok) {
      const msg =
        (json && (json.message || json.error || json.errorMessage)) ||
        `Confluence API request failed (${res.status})`;
      const err = new Error(msg);
      err.status = res.status;
      err.response = json;
      throw err;
    }

    return json;
  }

  const server = new Server(
    { name: "mcp-confluence", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "confluence_search",
        description:
          "Search Confluence content using CQL. Returns search results.",
        inputSchema: {
          type: "object",
          properties: {
            cql: {
              type: "string",
              description:
                'CQL query, e.g. `type=page AND text ~ "incident" ORDER BY lastmodified DESC`',
            },
            limit: {
              type: "integer",
              description: "Max results (default 10).",
              minimum: 1,
              maximum: 50,
            },
            expand: {
              type: "string",
              description:
                'Confluence expand param, e.g. `content.version,content.space,content.body.storage`',
            },
          },
          required: ["cql"],
        },
      },
      {
        name: "confluence_get_page",
        description:
          "Get a Confluence page by content id. Can expand body/storage.",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string", description: "Confluence content id." },
            expand: {
              type: "string",
              description:
                'Expand param (default: `body.storage,version,space,history`) ',
            },
          },
          required: ["id"],
        },
      },
      {
        name: "confluence_get_page_by_title",
        description:
          "Find a Confluence page by spaceKey + title. Returns first match.",
        inputSchema: {
          type: "object",
          properties: {
            spaceKey: {
              type: "string",
              description: "Space key, e.g. `ENG`.",
            },
            title: { type: "string", description: "Exact page title." },
            expand: {
              type: "string",
              description:
                'Expand param (default: `body.storage,version,space,history`) ',
            },
          },
          required: ["spaceKey", "title"],
        },
      },
      {
        name: "confluence_list_spaces",
        description: "List Confluence spaces.",
        inputSchema: {
          type: "object",
          properties: {
            limit: {
              type: "integer",
              description: "Max spaces (default 25).",
              minimum: 1,
              maximum: 200,
            },
          },
        },
      },
      {
        name: "confluence_get_placeholders",
        description:
          "Extract {{PLACEHOLDER}} variables from a Confluence page title/body (storage). Useful for templates like `RCA – {{INCIDENT_ID}} – {{INCIDENT_TITLE}}`.",
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "Confluence content id (preferred if known).",
            },
            spaceKey: {
              type: "string",
              description:
                "Space key (used when id is not provided). Example: `ENG`.",
            },
            title: {
              type: "string",
              description:
                "Exact page title (used when id is not provided), e.g. `RCA – {{INCIDENT_ID}} – {{INCIDENT_TITLE}}`.",
            },
            includeTitle: {
              type: "boolean",
              description: "Scan title for placeholders. Default true.",
            },
            includeBody: {
              type: "boolean",
              description: "Scan body.storage for placeholders. Default true.",
            },
          },
        },
      },
      {
        name: "confluence_clone_page",
        description:
          "Clone a Confluence page (template) into a destination space (and optional parent). Supports replacing {{PLACEHOLDER}} variables via a replacements map.",
        inputSchema: {
          type: "object",
          properties: {
            templateId: {
              type: "string",
              description:
                "Template page content id. If provided, used directly.",
            },
            templateSpaceKey: {
              type: "string",
              description:
                "Template space key (used when templateId is not provided).",
            },
            templateTitle: {
              type: "string",
              description:
                "Template page title (used when templateId is not provided).",
            },
            destinationSpaceKey: {
              type: "string",
              description: "Destination space key for the new page.",
            },
            destinationParentId: {
              type: "string",
              description:
                "Optional parent page id (ancestor) to create the cloned page under.",
            },
            replacements: {
              type: "object",
              description:
                "Map of placeholder name to replacement value. Example: {\"INCIDENT_ID\":\"INC-123\",\"INCIDENT_TITLE\":\"DB outage\"}.",
              additionalProperties: { type: "string" },
            },
            incidentId: {
              type: "string",
              description:
                "Backward compatible: sets replacements.INCIDENT_ID",
            },
            incidentTitle: {
              type: "string",
              description:
                "Backward compatible: sets replacements.INCIDENT_TITLE",
            },
            destinationTitle: {
              type: "string",
              description:
                "Optional title for the new page. If omitted, defaults to template title with placeholders replaced.",
            },
            replacePlaceholders: {
              type: "boolean",
              description:
                "Whether to replace {{...}} in the template body/title. Default true.",
            },
          },
          required: ["destinationSpaceKey"],
        },
      },
      {
        name: "confluence_create_page",
        description: "Create a new Confluence page.",
        inputSchema: {
          type: "object",
          properties: {
            spaceKey: { type: "string", description: "Space key, e.g. `ENG`." },
            title: { type: "string", description: "Page title." },
            body: { type: "string", description: "Page content in storage format (HTML)." },
            parentId: { type: "string", description: "Optional parent page id." }
          },
          required: ["spaceKey", "title", "body"],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      if (name === "confluence_search") {
        const cql = args?.cql;
        const limit = args?.limit ?? 10;
        const expand = args?.expand;
        if (typeof cql !== "string" || !cql.trim()) {
          return errorText("`cql` must be a non-empty string.");
        }
        const result = await confluenceFetch("/content/search", {
          query: { cql, limit, ...(expand ? { expand } : {}) },
        });
        return jsonText(result);
      }

      if (name === "confluence_get_page") {
        const id = args?.id;
        const expand = args?.expand ?? "body.storage,version,space,history";
        if (typeof id !== "string" || !id.trim()) {
          return errorText("`id` must be a non-empty string.");
        }
        const result = await confluenceFetch(`/content/${encodeURIComponent(id)}`, {
          query: { expand },
        });
        return jsonText(result);
      }

      if (name === "confluence_get_page_by_title") {
        const spaceKey = args?.spaceKey;
        const title = args?.title;
        const expand = args?.expand ?? "body.storage,version,space,history";
        if (typeof spaceKey !== "string" || !spaceKey.trim()) {
          return errorText("`spaceKey` must be a non-empty string.");
        }
        if (typeof title !== "string" || !title.trim()) {
          return errorText("`title` must be a non-empty string.");
        }
        const result = await confluenceFetch("/content", {
          query: {
            type: "page",
            spaceKey,
            title,
            expand,
            limit: 1,
          },
        });
        return jsonText(result);
      }

      if (name === "confluence_list_spaces") {
        const limit = args?.limit ?? 25;
        const result = await confluenceFetch("/space", {
          query: { limit },
        });
        return jsonText(result);
      }

      if (name === "confluence_get_placeholders") {
        const id = args?.id;
        const spaceKey = args?.spaceKey;
        const title = args?.title;
        const includeTitle = args?.includeTitle ?? true;
        const includeBody = args?.includeBody ?? true;

        let page;
        if (typeof id === "string" && id.trim()) {
          page = await confluenceFetch(`/content/${encodeURIComponent(id.trim())}`, {
            query: { expand: "body.storage,space,version" },
          });
        } else {
          if (typeof spaceKey !== "string" || !spaceKey.trim()) {
            return errorText("Provide `id` OR a non-empty `spaceKey`.");
          }
          if (typeof title !== "string" || !title.trim()) {
            return errorText("Provide `id` OR a non-empty `title`.");
          }
          const search = await confluenceFetch("/content", {
            query: {
              type: "page",
              spaceKey: spaceKey.trim(),
              title: title.trim(),
              expand: "body.storage,space,version",
              limit: 1,
            },
          });
          page = search?.results?.[0];
        }

        if (!page) {
          return errorText("Page not found.");
        }

        const inTitle = includeTitle ? extractPlaceholders(page?.title) : [];
        const inBody = includeBody
          ? extractPlaceholders(page?.body?.storage?.value)
          : [];

        const merged = new Map();
        for (const { name: n, count } of [...inTitle, ...inBody]) {
          merged.set(n, (merged.get(n) ?? 0) + count);
        }
        const all = [...merged.entries()]
          .map(([n, count]) => ({ name: n, count }))
          .sort((a, b) => a.name.localeCompare(b.name));

        return jsonText({
          page: {
            id: page?.id,
            title: page?.title,
            spaceKey: page?.space?.key,
          },
          placeholders: {
            title: inTitle,
            body: inBody,
            all,
          },
        });
      }

      if (name === "confluence_clone_page") {
        const templateId = args?.templateId;
        const templateSpaceKey = args?.templateSpaceKey;
        const templateTitle = args?.templateTitle;
        const destinationSpaceKey = args?.destinationSpaceKey;
        const destinationParentId = args?.destinationParentId;
        const replacementsInput = args?.replacements;
        const incidentId = args?.incidentId;
        const incidentTitle = args?.incidentTitle;
        const destinationTitle = args?.destinationTitle;
        const replacePlaceholders = args?.replacePlaceholders ?? true;

        if (typeof destinationSpaceKey !== "string" || !destinationSpaceKey) {
          return errorText("`destinationSpaceKey` must be a non-empty string.");
        }

        const replacements =
          replacementsInput && typeof replacementsInput === "object"
            ? { ...replacementsInput }
            : {};
        if (typeof incidentId === "string" && incidentId.trim()) {
          replacements.INCIDENT_ID = incidentId.trim();
        }
        if (typeof incidentTitle === "string" && incidentTitle.trim()) {
          replacements.INCIDENT_TITLE = incidentTitle.trim();
        }

        let templatePage;
        if (typeof templateId === "string" && templateId.trim()) {
          templatePage = await confluenceFetch(
            `/content/${encodeURIComponent(templateId.trim())}`,
            { query: { expand: "body.storage,version,space,history" } }
          );
        } else {
          if (
            typeof templateSpaceKey !== "string" ||
            !templateSpaceKey.trim() ||
            typeof templateTitle !== "string" ||
            !templateTitle.trim()
          ) {
            return errorText(
              "Provide `templateId` OR (`templateSpaceKey` AND `templateTitle`)."
            );
          }
          const search = await confluenceFetch("/content", {
            query: {
              type: "page",
              spaceKey: templateSpaceKey.trim(),
              title: templateTitle.trim(),
              expand: "body.storage,version,space,history",
              limit: 1,
            },
          });
          templatePage = search?.results?.[0];
        }

        if (!templatePage?.body?.storage?.value) {
          return errorText(
            "Template page not found or missing `body.storage.value`."
          );
        }

        const titleTemplate =
          typeof destinationTitle === "string" && destinationTitle.trim()
            ? destinationTitle.trim()
            : templatePage?.title;
        if (typeof titleTemplate !== "string" || !titleTemplate.trim()) {
          return errorText(
            "Unable to determine destination title. Provide `destinationTitle`."
          );
        }

        const resolvedTitle = replacePlaceholders
          ? applyPlaceholders(titleTemplate, replacements)
          : titleTemplate;

        const templateHtml = templatePage.body.storage.value;
        const newHtml = replacePlaceholders
          ? applyPlaceholders(templateHtml, replacements)
          : templateHtml;

        const payload = {
          type: "page",
          title: resolvedTitle,
          space: { key: destinationSpaceKey.trim() },
          ...(typeof destinationParentId === "string" &&
          destinationParentId.trim()
            ? { ancestors: [{ id: destinationParentId.trim() }] }
            : {}),
          body: {
            storage: {
              value: newHtml,
              representation: "storage",
            },
          },
        };

        const created = await confluenceFetch("/content", {
          method: "POST",
          jsonBody: payload,
        });
        return jsonText(created);
      }

      if (name === "confluence_create_page") {
        const spaceKey = args?.spaceKey;
        const title = args?.title;
        const body = args?.body;
        const parentId = args?.parentId;

        if (!spaceKey || !title || !body) {
          return errorText("`spaceKey`, `title`, and `body` are required.");
        }

        const payload = {
          type: "page",
          title,
          space: { key: spaceKey },
          body: {
            storage: {
              value: body,
              representation: "storage",
            },
          },
          ...(parentId ? { ancestors: [{ id: parentId }] } : {}),
        };

        const result = await confluenceFetch("/content", {
          method: "POST",
          jsonBody: payload,
        });
        return jsonText(result);
      }

      return errorText(`Unknown tool: ${name}`);
    } catch (e) {
      return errorText(e?.message || "Unknown error", {
        status: e?.status,
        response: e?.response,
      });
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

await main();

