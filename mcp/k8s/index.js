import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

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
  let dir = startDir;
  while (true) {
    const envPath = path.join(dir, ".env");
    try {
      if (fs.existsSync(envPath)) {
        const contents = fs.readFileSync(envPath, "utf8");
        return { envPath, values: parseDotEnv(contents), exists: true };
      }
    } catch {
      return { envPath, values: {}, exists: false };
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return {
    envPath: path.join(startDir, ".env"),
    values: {},
    exists: false,
  };
}

function firstEnv(names, { fileEnv }) {
  for (const name of names) {
    const value = process.env[name] ?? fileEnv.values[name];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function buildRuntimeEnv(fileEnv) {
  const env = { ...process.env };
  for (const [key, value] of Object.entries(fileEnv.values)) {
    if (env[key] === undefined && typeof value === "string") {
      env[key] = value;
    }
  }
  return env;
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

function parseLines(text) {
  if (!text) return [];
  return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

async function runKubectl(fileEnv, args) {
  const kubectlBin =
    firstEnv(["KUBECTL_BIN", "K8S_KUBECTL_BIN"], { fileEnv }) || "kubectl";
  const timeoutRaw = firstEnv(["KUBECTL_TIMEOUT_MS", "K8S_TIMEOUT_MS"], {
    fileEnv,
  });
  const timeoutMs = Number(timeoutRaw || "30000");
  const env = buildRuntimeEnv(fileEnv);

  try {
    const { stdout, stderr } = await execFileAsync(kubectlBin, args, {
      env,
      timeout: Number.isFinite(timeoutMs) ? timeoutMs : 30000,
      maxBuffer: 10 * 1024 * 1024,
    });
    return {
      command: kubectlBin,
      args,
      stdout: stdout?.trimEnd() || "",
      stderr: stderr?.trimEnd() || "",
    };
  } catch (error) {
    return {
      command: kubectlBin,
      args,
      error: error?.message || "kubectl failed",
      stdout: error?.stdout?.toString?.() || "",
      stderr: error?.stderr?.toString?.() || "",
      code: error?.code,
      signal: error?.signal,
    };
  }
}

function buildKubectlArgs(fileEnv, { context, namespace, allNamespaces }) {
  const args = [];
  const defaultContext = firstEnv(["KUBECTL_CONTEXT", "K8S_CONTEXT"], {
    fileEnv,
  });
  const defaultNamespace = firstEnv(["KUBECTL_NAMESPACE", "K8S_NAMESPACE"], {
    fileEnv,
  });
  const resolvedContext =
    typeof context === "string" && context.trim()
      ? context.trim()
      : defaultContext;
  const resolvedNamespace =
    typeof namespace === "string" && namespace.trim()
      ? namespace.trim()
      : defaultNamespace;

  if (resolvedContext) args.push("--context", resolvedContext);
  if (allNamespaces) {
    args.push("--all-namespaces");
  } else if (resolvedNamespace) {
    args.push("--namespace", resolvedNamespace);
  }
  return args;
}

async function main() {
  const fileEnv = loadWorkspaceEnvFile();
  const server = new Server(
    { name: "mcp-k8s", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "k8s_get",
        description:
          "Get Kubernetes resources using kubectl (read-only). Defaults to JSON output.",
        inputSchema: {
          type: "object",
          properties: {
            kind: {
              type: "string",
              description: "Resource kind, e.g. pods, deployments, svc.",
            },
            name: {
              type: "string",
              description: "Optional resource name.",
            },
            namespace: {
              type: "string",
              description: "Namespace override.",
            },
            context: {
              type: "string",
              description: "Kubectl context override.",
            },
            output: {
              type: "string",
              description: "Output format (json|yaml|wide|name). Default json.",
              enum: ["json", "yaml", "wide", "name"],
            },
            labels: {
              type: "string",
              description: "Label selector, e.g. app=myapp",
            },
            fieldSelector: {
              type: "string",
              description: "Field selector, e.g. status.phase=Running",
            },
            allNamespaces: {
              type: "boolean",
              description: "List across all namespaces (overrides namespace).",
            },
          },
          required: ["kind"],
        },
      },
      {
        name: "k8s_describe",
        description:
          "Describe a Kubernetes resource (read-only). Requires name.",
        inputSchema: {
          type: "object",
          properties: {
            kind: {
              type: "string",
              description: "Resource kind, e.g. pod, deployment, service.",
            },
            name: {
              type: "string",
              description: "Resource name to describe.",
            },
            namespace: {
              type: "string",
              description: "Namespace override.",
            },
            context: {
              type: "string",
              description: "Kubectl context override.",
            },
          },
          required: ["kind", "name"],
        },
      },
      {
        name: "k8s_logs",
        description: "Fetch pod logs (read-only).",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Pod name.",
            },
            namespace: {
              type: "string",
              description: "Namespace override.",
            },
            context: {
              type: "string",
              description: "Kubectl context override.",
            },
            container: {
              type: "string",
              description: "Container name.",
            },
            tail: {
              type: "integer",
              description: "Number of lines to tail (default 200).",
              minimum: 1,
              maximum: 5000,
            },
            since: {
              type: "string",
              description: "Only return logs newer than a duration, e.g. 1h.",
            },
            previous: {
              type: "boolean",
              description: "Return logs for the previous container instance.",
            },
            timestamps: {
              type: "boolean",
              description: "Include timestamps on each log line.",
            },
          },
          required: ["name"],
        },
      },
      {
        name: "k8s_get_contexts",
        description: "List available kubectl contexts.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "k8s_current_context",
        description: "Get current kubectl context.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      if (name === "k8s_get") {
        const kind = args?.kind;
        const nameArg = args?.name;
        const namespace = args?.namespace;
        const context = args?.context;
        const output = args?.output ?? "json";
        const labels = args?.labels;
        const fieldSelector = args?.fieldSelector;
        const allNamespaces = args?.allNamespaces ?? false;

        if (typeof kind !== "string" || !kind.trim()) {
          return errorText("`kind` must be a non-empty string.");
        }
        if (typeof output !== "string") {
          return errorText("`output` must be a string.");
        }

        const argsList = ["get", kind.trim()];
        if (typeof nameArg === "string" && nameArg.trim()) {
          argsList.push(nameArg.trim());
        }
        if (typeof labels === "string" && labels.trim()) {
          argsList.push("-l", labels.trim());
        }
        if (typeof fieldSelector === "string" && fieldSelector.trim()) {
          argsList.push("--field-selector", fieldSelector.trim());
        }
        if (output) {
          argsList.push("-o", output);
        }
        argsList.push(
          ...buildKubectlArgs(fileEnv, { context, namespace, allNamespaces })
        );

        const result = await runKubectl(fileEnv, argsList);
        if (result.error) {
          return errorText("kubectl get failed", result);
        }
        let parsed = undefined;
        if (output === "json") {
          try {
            parsed = JSON.parse(result.stdout);
          } catch {
            parsed = undefined;
          }
        }
        return jsonText({ ...result, parsed });
      }

      if (name === "k8s_describe") {
        const kind = args?.kind;
        const nameArg = args?.name;
        const namespace = args?.namespace;
        const context = args?.context;

        if (typeof kind !== "string" || !kind.trim()) {
          return errorText("`kind` must be a non-empty string.");
        }
        if (typeof nameArg !== "string" || !nameArg.trim()) {
          return errorText("`name` must be a non-empty string.");
        }

        const argsList = ["describe", kind.trim(), nameArg.trim()];
        argsList.push(...buildKubectlArgs(fileEnv, { context, namespace }));
        const result = await runKubectl(fileEnv, argsList);
        if (result.error) {
          return errorText("kubectl describe failed", result);
        }
        return jsonText(result);
      }

      if (name === "k8s_logs") {
        const pod = args?.name;
        const namespace = args?.namespace;
        const context = args?.context;
        const container = args?.container;
        const tail = args?.tail ?? 200;
        const since = args?.since;
        const previous = args?.previous ?? false;
        const timestamps = args?.timestamps ?? false;

        if (typeof pod !== "string" || !pod.trim()) {
          return errorText("`name` must be a non-empty string.");
        }

        const argsList = ["logs", pod.trim()];
        if (typeof container === "string" && container.trim()) {
          argsList.push("-c", container.trim());
        }
        if (typeof tail === "number" && Number.isFinite(tail)) {
          argsList.push("--tail", String(tail));
        }
        if (typeof since === "string" && since.trim()) {
          argsList.push("--since", since.trim());
        }
        if (previous) {
          argsList.push("--previous");
        }
        if (timestamps) {
          argsList.push("--timestamps");
        }
        argsList.push(...buildKubectlArgs(fileEnv, { context, namespace }));

        const result = await runKubectl(fileEnv, argsList);
        if (result.error) {
          return errorText("kubectl logs failed", result);
        }
        return jsonText(result);
      }

      if (name === "k8s_get_contexts") {
        const result = await runKubectl(fileEnv, [
          "config",
          "get-contexts",
          "-o",
          "name",
        ]);
        if (result.error) {
          return errorText("kubectl get-contexts failed", result);
        }
        return jsonText({ ...result, contexts: parseLines(result.stdout) });
      }

      if (name === "k8s_current_context") {
        const result = await runKubectl(fileEnv, ["config", "current-context"]);
        if (result.error) {
          return errorText("kubectl current-context failed", result);
        }
        return jsonText({ ...result, currentContext: result.stdout.trim() });
      }

      return errorText(`Unknown tool: ${name}`);
    } catch (error) {
      return errorText(error?.message || "Unknown error");
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

await main();
