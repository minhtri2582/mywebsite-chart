import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { S3Client, ListBucketsCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { EC2Client, DescribeInstancesCommand } from "@aws-sdk/client-ec2";
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import { CloudWatchLogsClient, FilterLogEventsCommand } from "@aws-sdk/client-cloudwatch-logs";
import { RDSClient, DescribeDBInstancesCommand } from "@aws-sdk/client-rds";
import { LambdaClient, ListFunctionsCommand } from "@aws-sdk/client-lambda";
import { EKSClient, ListClustersCommand, DescribeClusterCommand, ListNodegroupsCommand, DescribeNodegroupCommand, ListFargateProfilesCommand } from "@aws-sdk/client-eks";
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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key) out[key] = value;
  }
  return out;
}

function loadEnv() {
  const searchPaths = [
    path.join(process.cwd(), ".env"),
    path.join(os.homedir(), ".cursor", ".env")
  ];
  for (const p of searchPaths) {
    if (fs.existsSync(p)) {
      const env = parseDotEnv(fs.readFileSync(p, "utf8"));
      for (const [k, v] of Object.entries(env)) {
        if (!process.env[k]) process.env[k] = v;
      }
    }
  }
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

function errorText(message) {
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: JSON.stringify({ error: message }, null, 2),
      },
    ],
  };
}

async function main() {
  loadEnv();
  const region = process.env.AWS_REGION || "ap-southeast-1";
  
  const s3Client = new S3Client({ region });
  const ec2Client = new EC2Client({ region });
  const stsClient = new STSClient({ region });
  const cwLogsClient = new CloudWatchLogsClient({ region });
  const rdsClient = new RDSClient({ region });
  const lambdaClient = new LambdaClient({ region });
  const eksClient = new EKSClient({ region });

  const server = new Server(
    { name: "mcp-aws", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "aws_get_identity",
        description: "Get the current AWS IAM identity (who am I).",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "aws_list_s3_buckets",
        description: "List all S3 buckets in the account.",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "aws_list_s3_objects",
        description: "List objects in a specific S3 bucket.",
        inputSchema: {
          type: "object",
          properties: {
            bucket: { type: "string", description: "Bucket name" },
            prefix: { type: "string", description: "Optional prefix/folder path" },
            limit: { type: "integer", description: "Max objects to list", default: 20 },
          },
          required: ["bucket"],
        },
      },
      {
        name: "aws_list_ec2_instances",
        description: "List EC2 instances with their status and tags.",
        inputSchema: {
          type: "object",
          properties: {
            state: { type: "string", description: "Filter by state (e.g., running, stopped)" },
          },
        },
      },
      {
        name: "aws_list_rds_instances",
        description: "List RDS database instances.",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "aws_list_lambda_functions",
        description: "List Lambda functions.",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "aws_get_cloudwatch_logs",
        description: "Fetch recent logs from a CloudWatch Log Group.",
        inputSchema: {
          type: "object",
          properties: {
            logGroupName: { type: "string", description: "Name of the log group" },
            filterPattern: { type: "string", description: "Optional filter pattern" },
            limit: { type: "integer", description: "Max log events", default: 50 },
          },
          required: ["logGroupName"],
        },
      },
      {
        name: "aws_list_eks_clusters",
        description: "List EKS clusters in the account.",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "aws_describe_eks_cluster",
        description: "Get detailed information about a specific EKS cluster.",
        inputSchema: {
          type: "object",
          properties: {
            clusterName: { type: "string", description: "Name of the EKS cluster" },
          },
          required: ["clusterName"],
        },
      },
      {
        name: "aws_list_eks_nodegroups",
        description: "List node groups in an EKS cluster.",
        inputSchema: {
          type: "object",
          properties: {
            clusterName: { type: "string", description: "Name of the EKS cluster" },
          },
          required: ["clusterName"],
        },
      },
      {
        name: "aws_describe_eks_nodegroup",
        description: "Get detailed information about an EKS node group.",
        inputSchema: {
          type: "object",
          properties: {
            clusterName: { type: "string", description: "Name of the EKS cluster" },
            nodegroupName: { type: "string", description: "Name of the node group" },
          },
          required: ["clusterName", "nodegroupName"],
        },
      },
      {
        name: "aws_list_eks_fargate_profiles",
        description: "List Fargate profiles in an EKS cluster.",
        inputSchema: {
          type: "object",
          properties: {
            clusterName: { type: "string", description: "Name of the EKS cluster" },
          },
          required: ["clusterName"],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case "aws_get_identity": {
          const result = await stsClient.send(new GetCallerIdentityCommand({}));
          return jsonText(result);
        }

        case "aws_list_s3_buckets": {
          const result = await s3Client.send(new ListBucketsCommand({}));
          return jsonText(result.Buckets || []);
        }

        case "aws_list_s3_objects": {
          const result = await s3Client.send(new ListObjectsV2Command({
            Bucket: args.bucket,
            Prefix: args.prefix,
            MaxKeys: args.limit || 20,
          }));
          return jsonText(result.Contents || []);
        }

        case "aws_list_ec2_instances": {
          const filter = args.state ? [{ Name: "instance-state-name", Values: [args.state] }] : [];
          const result = await ec2Client.send(new DescribeInstancesCommand({ Filters: filter }));
          const instances = result.Reservations?.flatMap(r => r.Instances || []) || [];
          return jsonText(instances.map(i => ({
            InstanceId: i.InstanceId,
            InstanceType: i.InstanceType,
            State: i.State?.Name,
            PublicIp: i.PublicIpAddress,
            PrivateIp: i.PrivateIpAddress,
            Tags: i.Tags,
          })));
        }

        case "aws_list_rds_instances": {
          const result = await rdsClient.send(new DescribeDBInstancesCommand({}));
          return jsonText(result.DBInstances || []);
        }

        case "aws_list_lambda_functions": {
          const result = await lambdaClient.send(new ListFunctionsCommand({}));
          return jsonText(result.Functions || []);
        }

        case "aws_get_cloudwatch_logs": {
          const result = await cwLogsClient.send(new FilterLogEventsCommand({
            logGroupName: args.logGroupName,
            filterPattern: args.filterPattern,
            limit: args.limit || 50,
          }));
          return jsonText(result.events || []);
        }

        case "aws_list_eks_clusters": {
          const result = await eksClient.send(new ListClustersCommand({}));
          return jsonText(result.clusters || []);
        }

        case "aws_describe_eks_cluster": {
          const result = await eksClient.send(new DescribeClusterCommand({
            name: args.clusterName,
          }));
          return jsonText(result.cluster || {});
        }

        case "aws_list_eks_nodegroups": {
          const result = await eksClient.send(new ListNodegroupsCommand({
            clusterName: args.clusterName,
          }));
          return jsonText(result.nodegroups || []);
        }

        case "aws_describe_eks_nodegroup": {
          const result = await eksClient.send(new DescribeNodegroupCommand({
            clusterName: args.clusterName,
            nodegroupName: args.nodegroupName,
          }));
          return jsonText(result.nodegroup || {});
        }

        case "aws_list_eks_fargate_profiles": {
          const result = await eksClient.send(new ListFargateProfilesCommand({
            clusterName: args.clusterName,
          }));
          return jsonText(result.fargateProfileNames || []);
        }

        default:
          return errorText(`Unknown tool: ${name}`);
      }
    } catch (e) {
      return errorText(e.message || "Unknown AWS error");
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("AWS MCP Server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error in main():", err);
  process.exit(1);
});
