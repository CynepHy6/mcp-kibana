export const TRACE_ITEM_LIMIT = 80;

type Doc = Record<string, any>;

/** Kibana APM returns latency in microseconds. */
export const latencyMs = (latencyUs: unknown): number | undefined => {
    if (latencyUs === null || latencyUs === undefined) {
        return undefined;
    }
    return Math.round((Number(latencyUs) / 1000) * 1000) / 1000;
};

const withLatency = (compacted: Doc, latencyUs: unknown): Doc => {
    const converted = latencyMs(latencyUs);
    if (converted !== undefined) {
        compacted.latencyMs = converted;
    }
    return compacted;
};

export const compactService = (item: Doc): Doc =>
    withLatency(
        {
            serviceName: item.serviceName,
            transactionType: item.transactionType,
            environments: item.environments || [],
            agentName: item.agentName,
            errorRate: item.transactionErrorRate,
            throughputPerMinute: item.throughput,
        },
        item.latency,
    );

export const compactTransactionGroup = (item: Doc): Doc =>
    withLatency(
        {
            name: item.name,
            transactionType: item.transactionType,
            errorRate: item.errorRate,
            throughputPerMinute: item.throughput,
            impact: item.impact,
            alertsCount: item.alertsCount,
        },
        item.latency,
    );

export const compactTraceDoc = (doc: Doc): Doc => {
    const event = doc.processor?.event;
    const node = (event === "span" ? doc.span : doc.transaction) || {};
    const compacted: Doc = {
        event,
        id: node.id,
        parentId: doc.parent?.id,
        service: doc.service?.name,
        name: node.name,
        type: node.type,
        outcome: doc.event?.outcome,
        durationUs: node.duration?.us,
    };
    const timestampUs = doc.timestamp?.us;
    if (timestampUs !== undefined && timestampUs !== null) {
        compacted.timestampUs = timestampUs;
    }
    return compacted;
};

/**
 * Start offset from the entry transaction in microseconds. Item order stays as Kibana returned it.
 * Without the entry transaction among the items the earliest timestamp is the origin.
 */
export const attachOffsetUs = (items: Doc[], entryTransactionId: string): Doc[] => {
    const entry = items.find(
        (item) => item.event === "transaction" && item.id === entryTransactionId,
    );
    let origin: number | undefined = entry ? entry.timestampUs : undefined;
    if (!entry) {
        const stamps = items
            .map((item) => item.timestampUs)
            .filter((stamp): stamp is number => typeof stamp === "number");
        origin = stamps.length ? Math.min(...stamps) : undefined;
    }
    for (const item of items) {
        const stamp = item.timestampUs;
        delete item.timestampUs;
        if (origin === undefined || stamp === undefined) {
            continue;
        }
        item.offsetUs = stamp - origin;
    }
    return items;
};

export const capItems = <T>(items: T[], limit: number): { items: T[]; truncated: boolean } => {
    const bounded = Math.max(1, Math.min(Math.trunc(limit), 100));
    return { items: items.slice(0, bounded), truncated: items.length > bounded };
};

export const jsonContent = (payload: unknown) => ({
    content: [
        {
            type: "text" as const,
            text: JSON.stringify(payload, null, 2),
        },
    ],
});

export const errorContent = (text: string) => ({
    content: [
        {
            type: "text" as const,
            text,
        },
    ],
});
