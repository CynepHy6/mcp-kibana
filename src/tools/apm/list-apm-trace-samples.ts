import { AxiosInstance } from "axios";
import { z } from "zod";
import { KibanaConfig } from "../../clients/kibana-client.js";
import { capItems, errorContent, jsonContent } from "../../utils/apm-format.js";
import { resolveWindow } from "../../utils/time-window.js";
import {
    filterSchema,
    limitSchema,
    runTool,
    serviceNameSchema,
    windowSchema,
} from "./common.js";

const MAX_DURATION_MS = 86_400_000;

export const listApmTraceSamplesSchema = {
    serviceName: serviceNameSchema,
    transactionName: z
        .string()
        .trim()
        .min(1)
        .describe("Transaction group name from list-apm-transactions, e.g. 'POST /server-api/v1/room'"),
    transactionType: z.string().default("request").describe("Transaction type"),
    ...windowSchema,
    ...filterSchema,
    minDurationMs: z.number().min(0).optional().describe("Lower duration bound, ms"),
    maxDurationMs: z.number().min(0).optional().describe("Upper duration bound, ms"),
    limit: limitSchema(20),
};

interface ListApmTraceSamplesArgs {
    serviceName: string;
    transactionName: string;
    transactionType: string;
    start?: string;
    end?: string;
    environment: string;
    kuery: string;
    minDurationMs?: number;
    maxDurationMs?: number;
    limit: number;
}

export const listApmTraceSamplesHandler =
    (kibana: AxiosInstance, config: KibanaConfig) =>
    async (args: ListApmTraceSamplesArgs) =>
        runTool(config, "list APM trace samples", async () => {
            const { minDurationMs, maxDurationMs } = args;
            if (
                minDurationMs !== undefined &&
                maxDurationMs !== undefined &&
                minDurationMs > maxDurationMs
            ) {
                return errorContent("minDurationMs must not be greater than maxDurationMs");
            }

            const window = resolveWindow(args.start, args.end);
            const params: Record<string, string> = {
                start: window.start,
                end: window.end,
                environment: args.environment,
                kuery: args.kuery,
                transactionName: args.transactionName,
                transactionType: args.transactionType,
            };
            // Kibana takes the duration range in microseconds and needs both bounds.
            if (minDurationMs !== undefined || maxDurationMs !== undefined) {
                params.sampleRangeFrom = String(Math.trunc((minDurationMs ?? 0) * 1000));
                params.sampleRangeTo = String(Math.trunc((maxDurationMs ?? MAX_DURATION_MS) * 1000));
            }

            const response = await kibana.get(
                `/internal/apm/services/${encodeURIComponent(args.serviceName)}/transactions/traces/samples`,
                { params },
            );

            const samples = (response.data?.traceSamples || []).map((item: any) => ({
                timestamp: item.timestamp,
                traceId: item.traceId,
                transactionId: item.transactionId,
            }));
            const capped = capItems(samples, args.limit);

            return jsonContent({
                serviceName: args.serviceName,
                transactionName: args.transactionName,
                ...window,
                total: samples.length,
                truncated: capped.truncated,
                samples: capped.items,
            });
        });
