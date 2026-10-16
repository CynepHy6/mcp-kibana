import { AxiosInstance } from "axios";
import { z } from "zod";
import { KibanaConfig } from "../../clients/kibana-client.js";
import {
    attachOffsetUs,
    capItems,
    compactTraceDoc,
    errorContent,
    jsonContent,
    TRACE_ITEM_LIMIT,
} from "../../utils/apm-format.js";
import { resolveWindow, TimeWindow } from "../../utils/time-window.js";
import { runTool, windowSchema } from "./common.js";

const TRACE_INDEX = "traces-apm*";

export const getApmTraceSchema = {
    traceId: z.string().trim().min(1).describe("trace.id"),
    entryTransactionId: z
        .string()
        .trim()
        .optional()
        .describe("transaction.id of the entry transaction. Empty: the root transaction is looked up in traces-apm*"),
    ...windowSchema,
};

interface GetApmTraceArgs {
    traceId: string;
    entryTransactionId?: string;
    start?: string;
    end?: string;
}

/** Searches traces-apm* through the Kibana search proxy, so no direct Elasticsearch access is needed. */
const searchTraceTransactions = async (
    kibana: AxiosInstance,
    query: Record<string, unknown>,
): Promise<any[]> => {
    const response = await kibana.post(
        "/internal/search/es",
        {
            params: {
                index: TRACE_INDEX,
                body: {
                    size: 1,
                    query,
                    sort: [{ "@timestamp": { order: "asc" } }],
                    _source: ["transaction.id"],
                },
            },
        },
        { headers: { "Content-Type": "application/json", "elastic-api-version": "1" } },
    );
    const raw = response.data?.rawResponse || response.data || {};
    return raw.hits?.hits || [];
};

/** Root transaction.id of the trace; the earliest transaction when no document lacks parent.id. */
export const findEntryTransactionId = async (
    kibana: AxiosInstance,
    traceId: string,
    window: TimeWindow,
): Promise<string | undefined> => {
    const filter = [
        { term: { "trace.id": traceId } },
        { term: { "processor.event": "transaction" } },
        { range: { "@timestamp": { gte: window.start, lte: window.end } } },
    ];
    const rootHits = await searchTraceTransactions(kibana, {
        bool: { filter, must_not: [{ exists: { field: "parent.id" } }] },
    });
    const hits = rootHits.length
        ? rootHits
        : await searchTraceTransactions(kibana, { bool: { filter } });
    return hits[0]?._source?.transaction?.id;
};

export const getApmTraceHandler =
    (kibana: AxiosInstance, config: KibanaConfig) =>
    async (args: GetApmTraceArgs) =>
        runTool(config, "get APM trace", async () => {
            const window = resolveWindow(args.start, args.end);
            const entryTransactionId =
                args.entryTransactionId ||
                (await findEntryTransactionId(kibana, args.traceId, window));
            if (!entryTransactionId) {
                return errorContent(
                    "Root transaction of the trace was not found in traces-apm*. Widen start/end or pass entryTransactionId",
                );
            }

            const response = await kibana.get(
                `/internal/apm/traces/${encodeURIComponent(args.traceId)}`,
                {
                    params: {
                        start: window.start,
                        end: window.end,
                        entryTransactionId,
                    },
                },
            );

            const traceItems = response.data?.traceItems || {};
            const docs = (traceItems.traceDocs || []).map(compactTraceDoc);
            attachOffsetUs(docs, entryTransactionId);
            const capped = capItems(docs, TRACE_ITEM_LIMIT);

            return jsonContent({
                traceId: args.traceId,
                entryTransactionId,
                ...window,
                exceedsMax: Boolean(traceItems.exceedsMax),
                traceItemCount: traceItems.traceItemCount,
                truncated: capped.truncated,
                items: capped.items,
            });
        });
