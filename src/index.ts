#!/usr/bin/env node
import * as dotenv from "dotenv";
import { createRequire } from "module";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Local clone: .env in the repo root. With npx the env block of the MCP config is the only source.
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import {
    createConfiguredKibanaClient,
    getKibanaConfig,
} from "./clients/kibana-client.js";
import {
    getApmTraceHandler,
    getApmTraceSchema,
} from "./tools/apm/get-apm-trace.js";
import {
    listApmErrorsHandler,
    listApmErrorsSchema,
} from "./tools/apm/list-apm-errors.js";
import {
    listApmServicesHandler,
    listApmServicesSchema,
} from "./tools/apm/list-apm-services.js";
import {
    listApmTraceSamplesHandler,
    listApmTraceSamplesSchema,
} from "./tools/apm/list-apm-trace-samples.js";
import {
    listApmTransactionsHandler,
    listApmTransactionsSchema,
} from "./tools/apm/list-apm-transactions.js";
import { MCP_SERVER_INSTRUCTIONS } from "./utils/mcp-server-instructions.js";
import { validateKibanaConfig } from "./utils/validation.js";

const { version } = createRequire(import.meta.url)("../package.json") as { version: string };

const kibanaConfig = getKibanaConfig();
const kibana = createConfiguredKibanaClient();

const server = new McpServer(
    {
        name: "mcp-kibana",
        version,
    },
    {
        capabilities: {
            tools: {},
        },
        instructions: MCP_SERVER_INSTRUCTIONS,
    },
);

server.tool(
    "list-apm-services",
    "Kibana APM services for a time window: latencyMs, errorRate, throughputPerMinute (transactions per minute, as in the APM UI). Sorted by throughput.",
    listApmServicesSchema,
    listApmServicesHandler(kibana, kibanaConfig) as any,
);

server.tool(
    "list-apm-transactions",
    "Transaction groups of one Kibana APM service: name, latencyMs, errorRate, throughputPerMinute, impact.",
    listApmTransactionsSchema,
    listApmTransactionsHandler(kibana, kibanaConfig) as any,
);

server.tool(
    "list-apm-errors",
    "Error groups of one Kibana APM service: groupId, name, occurrences, culprit, type.",
    listApmErrorsSchema,
    listApmErrorsHandler(kibana, kibanaConfig) as any,
);

server.tool(
    "list-apm-trace-samples",
    "traceId and transactionId of sampled traces for one transaction group, the input for get-apm-trace. minDurationMs / maxDurationMs keep only requests in that duration range.",
    listApmTraceSamplesSchema,
    listApmTraceSamplesHandler(kibana, kibanaConfig) as any,
);

server.tool(
    "get-apm-trace",
    "Waterfall of one Kibana APM trace: transactions and spans with durationUs and offsetUs from the entry transaction start.",
    getApmTraceSchema,
    getApmTraceHandler(kibana, kibanaConfig) as any,
);

async function main() {
    try {
        const configError = validateKibanaConfig(kibanaConfig);
        if (configError) {
            // Tools report the same error on every call; the server still starts so the client shows it.
            console.error(`⚠️ ${configError}`);
        }

        const transport = new StdioServerTransport();
        await server.connect(transport);
        console.error("✅ Kibana APM MCP server running on stdio");
    } catch (error) {
        console.error("Error starting Kibana APM MCP server:", error);
        process.exit(1);
    }
}

main();
