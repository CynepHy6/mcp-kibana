import {
    attachOffsetUs,
    capItems,
    compactService,
    compactTraceDoc,
    latencyMs,
} from "../../src/utils/apm-format.js";

describe("latencyMs", () => {
    it("converts microseconds to milliseconds", () => {
        expect(latencyMs(12345)).toBe(12.345);
    });

    it("keeps a missing latency missing", () => {
        expect(latencyMs(null)).toBeUndefined();
    });
});

describe("compactService", () => {
    it("renames Kibana fields and drops absent latency", () => {
        expect(
            compactService({
                serviceName: "rtm",
                transactionType: "request",
                agentName: "php",
                transactionErrorRate: 0.01,
                throughput: 120,
            }),
        ).toEqual({
            serviceName: "rtm",
            transactionType: "request",
            environments: [],
            agentName: "php",
            errorRate: 0.01,
            throughputPerMinute: 120,
        });
    });
});

describe("compactTraceDoc", () => {
    it("takes span fields for a span document", () => {
        expect(
            compactTraceDoc({
                processor: { event: "span" },
                span: { id: "s1", name: "SELECT", type: "db", duration: { us: 500 } },
                parent: { id: "t1" },
                service: { name: "rtm" },
                event: { outcome: "success" },
                timestamp: { us: 1000 },
            }),
        ).toEqual({
            event: "span",
            id: "s1",
            parentId: "t1",
            service: "rtm",
            name: "SELECT",
            type: "db",
            outcome: "success",
            durationUs: 500,
            timestampUs: 1000,
        });
    });
});

describe("attachOffsetUs", () => {
    it("measures offsets from the entry transaction and keeps the order", () => {
        const items = attachOffsetUs(
            [
                { event: "span", id: "s1", timestampUs: 1500 },
                { event: "transaction", id: "t1", timestampUs: 1000 },
                { event: "span", id: "s0", timestampUs: 900 },
            ],
            "t1",
        );
        expect(items).toEqual([
            { event: "span", id: "s1", offsetUs: 500 },
            { event: "transaction", id: "t1", offsetUs: 0 },
            { event: "span", id: "s0", offsetUs: -100 },
        ]);
    });

    it("falls back to the earliest timestamp without the entry transaction", () => {
        const items = attachOffsetUs(
            [
                { event: "span", id: "s1", timestampUs: 1500 },
                { event: "span", id: "s2", timestampUs: 1200 },
            ],
            "missing",
        );
        expect(items.map((item) => item.offsetUs)).toEqual([300, 0]);
    });
});

describe("capItems", () => {
    it("bounds the limit to 1..100 and reports truncation", () => {
        const items = Array.from({ length: 150 }, (_, index) => index);
        expect(capItems(items, 500).items).toHaveLength(100);
        expect(capItems(items, 500).truncated).toBe(true);
        expect(capItems([1, 2], 0)).toEqual({ items: [1], truncated: true });
        expect(capItems([1, 2], 5)).toEqual({ items: [1, 2], truncated: false });
    });
});
