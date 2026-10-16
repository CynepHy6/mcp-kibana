import { AxiosInstance } from "axios";
import { z } from "zod";
import { KibanaConfig } from "../../clients/kibana-client.js";
import { capItems, compactTransactionGroup, jsonContent } from "../../utils/apm-format.js";
import { resolveWindow } from "../../utils/time-window.js";
import {
    filterSchema,
    limitSchema,
    runTool,
    serviceNameSchema,
    windowSchema,
} from "./common.js";

export const listApmTransactionsSchema = {
    serviceName: serviceNameSchema,
    transactionType: z.string().default("request").describe("Transaction type"),
    latencyAggregationType: z
        .enum(["avg", "p95", "p99"])
        .default("avg")
        .describe("How latencyMs is aggregated"),
    ...windowSchema,
    ...filterSchema,
    limit: limitSchema(30),
};

interface ListApmTransactionsArgs {
    serviceName: string;
    transactionType: string;
    latencyAggregationType: "avg" | "p95" | "p99";
    start?: string;
    end?: string;
    environment: string;
    kuery: string;
    limit: number;
}

export const listApmTransactionsHandler =
    (kibana: AxiosInstance, config: KibanaConfig) =>
    async (args: ListApmTransactionsArgs) =>
        runTool(config, "list APM transactions", async () => {
            const window = resolveWindow(args.start, args.end);
            const response = await kibana.get(
                `/internal/apm/services/${encodeURIComponent(args.serviceName)}/transactions/groups/main_statistics`,
                {
                    params: {
                        start: window.start,
                        end: window.end,
                        environment: args.environment,
                        kuery: args.kuery,
                        transactionType: args.transactionType,
                        latencyAggregationType: args.latencyAggregationType,
                        // Duration summary metrics hold only the average; percentiles come back empty with it.
                        useDurationSummary: String(args.latencyAggregationType === "avg"),
                        documentType: "transactionMetric",
                        rollupInterval: "1m",
                    },
                },
            );

            const payload = response.data || {};
            const groups = (payload.transactionGroups || []).map(compactTransactionGroup);
            const capped = capItems(groups, args.limit);

            return jsonContent({
                serviceName: args.serviceName,
                transactionType: args.transactionType,
                latencyAggregationType: args.latencyAggregationType,
                ...window,
                environment: args.environment,
                total: groups.length,
                truncated: capped.truncated || Boolean(payload.maxTransactionGroupsExceeded),
                transactionOverflowCount: payload.transactionOverflowCount,
                transactions: capped.items,
            });
        });
