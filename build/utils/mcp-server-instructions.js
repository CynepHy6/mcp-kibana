/** MCP server instructions (InitializeResult.instructions) — visible to the agent before tool choice. */
export const MCP_SERVER_INSTRUCTIONS = [
    "Kibana APM aggregates: list-apm-services for latency, error rate and throughput across services; list-apm-transactions and list-apm-errors for one service.",
    "Slow or failing endpoint: list-apm-transactions (latencyAggregationType p95 or p99) → list-apm-trace-samples with that transaction name (minDurationMs narrows to slow requests) → get-apm-trace with traceId and transactionId as entryTransactionId.",
    "Time bounds are ISO-8601; a value without a zone is UTC. Empty bounds mean the last 15 minutes. The window for get-apm-trace must cover the trace.",
    "latencyMs is milliseconds; durationUs and offsetUs in get-apm-trace are microseconds. get-apm-trace items are not in chronological order: order them by offsetUs.",
    "An empty list for the window means nothing matched, not an error. Trace samples are sampled, so an empty sample list does not mean there were no requests.",
    "truncated or exceedsMax means the list or waterfall is partial; say so when reporting.",
    "User-facing replies: return the fetched data. Do not meta-comment on tools, HTTP, auth, or access method unless the user explicitly asks.",
].join(" ");
