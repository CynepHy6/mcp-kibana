import nock from "nock";
import { createKibanaClient, KibanaConfig } from "../../src/clients/kibana-client.js";
import { getApmTraceHandler } from "../../src/tools/apm/get-apm-trace.js";
import { listApmErrorsHandler } from "../../src/tools/apm/list-apm-errors.js";
import { listApmServicesHandler } from "../../src/tools/apm/list-apm-services.js";
import { listApmTraceSamplesHandler } from "../../src/tools/apm/list-apm-trace-samples.js";
import { listApmTransactionsHandler } from "../../src/tools/apm/list-apm-transactions.js";

const HOST = "https://kibana.example.com";
const START = "2026-10-16T08:00:00Z";
const END = "2026-10-16T08:15:00Z";
const WINDOW = { start: "2026-10-16T08:00:00.000Z", end: "2026-10-16T08:15:00.000Z" };

const config: KibanaConfig = {
    baseUrl: HOST,
    apiKey: "test-api-key",
    username: "",
    password: "",
    timeoutMs: 5000,
};

const parse = (result: any) => JSON.parse(result.content[0].text);

describe("Kibana APM tools", () => {
    const kibana = createKibanaClient(config);

    describe("listApmServicesHandler", () => {
        it("sends ApiKey auth and sorts services by throughput", async () => {
            nock(HOST, {
                reqheaders: { authorization: "ApiKey test-api-key", "kbn-xsrf": "true" },
            })
                .get("/internal/apm/services")
                .query((query) => query.start === WINDOW.start && query.end === WINDOW.end)
                .reply(200, {
                    items: [
                        { serviceName: "slow", throughput: 1, latency: 2000 },
                        { serviceName: "busy", throughput: 50, latency: 1000 },
                    ],
                });

            const result = await listApmServicesHandler(kibana, config)({
                start: START,
                end: END,
                environment: "ENVIRONMENT_ALL",
                kuery: "",
                limit: 1,
            });

            const body = parse(result);
            expect(body.total).toBe(2);
            expect(body.truncated).toBe(true);
            expect(body.services).toEqual([
                expect.objectContaining({ serviceName: "busy", latencyMs: 1 }),
            ]);
        });

        it("reports a Kibana HTTP error instead of an empty list", async () => {
            nock(HOST)
                .get("/internal/apm/services")
                .query(true)
                .reply(401, { message: "unable to authenticate" });

            const result = await listApmServicesHandler(kibana, config)({
                environment: "ENVIRONMENT_ALL",
                kuery: "",
                limit: 40,
            });

            expect(result.content[0].text).toBe(
                "Failed to list APM services: Kibana HTTP 401: unable to authenticate",
            );
        });

        it("does not call Kibana without credentials", async () => {
            const result = await listApmServicesHandler(kibana, { ...config, apiKey: "" })({
                environment: "ENVIRONMENT_ALL",
                kuery: "",
                limit: 40,
            });

            expect(result.content[0].text).toBe(
                "Configuration error: Set KIBANA_API_KEY or KIBANA_USERNAME and KIBANA_PASSWORD",
            );
        });
    });

    describe("listApmTransactionsHandler", () => {
        it("encodes the service name and flags overflowed groups", async () => {
            nock(HOST)
                .get("/internal/apm/services/my%20svc/transactions/groups/main_statistics")
                .query(
                    (query) =>
                        query.latencyAggregationType === "p95" &&
                        query.useDurationSummary === "false",
                )
                .reply(200, {
                    transactionGroups: [{ name: "GET /", latency: 1500, throughput: 3 }],
                    maxTransactionGroupsExceeded: true,
                });

            const result = await listApmTransactionsHandler(kibana, config)({
                serviceName: "my svc",
                transactionType: "request",
                latencyAggregationType: "p95",
                start: START,
                end: END,
                environment: "ENVIRONMENT_ALL",
                kuery: "",
                limit: 30,
            });

            const body = parse(result);
            expect(body.truncated).toBe(true);
            expect(body.transactions[0]).toEqual(
                expect.objectContaining({ name: "GET /", latencyMs: 1.5 }),
            );
        });
    });

    it("uses the duration summary for the average latency", async () => {
        nock(HOST)
            .get("/internal/apm/services/rtm/transactions/groups/main_statistics")
            .query((query) => query.useDurationSummary === "true")
            .reply(200, { transactionGroups: [] });

        const result = await listApmTransactionsHandler(kibana, config)({
            serviceName: "rtm",
            transactionType: "request",
            latencyAggregationType: "avg",
            environment: "ENVIRONMENT_ALL",
            kuery: "",
            limit: 30,
        });

        expect(parse(result).total).toBe(0);
    });

    describe("listApmErrorsHandler", () => {
        it("returns error groups as Kibana sends them", async () => {
            nock(HOST)
                .get("/internal/apm/services/rtm/errors/groups/main_statistics")
                .query(true)
                .reply(200, { errorGroups: [{ groupId: "g1", occurrences: 4 }] });

            const result = await listApmErrorsHandler(kibana, config)({
                serviceName: "rtm",
                environment: "ENVIRONMENT_ALL",
                kuery: "",
                limit: 30,
            });

            expect(parse(result).errors).toEqual([{ groupId: "g1", occurrences: 4 }]);
        });
    });

    describe("listApmTraceSamplesHandler", () => {
        it("passes the duration range in microseconds", async () => {
            nock(HOST)
                .get("/internal/apm/services/rtm/transactions/traces/samples")
                .query(
                    (query) =>
                        query.sampleRangeFrom === "1000000" &&
                        query.sampleRangeTo === "86400000000" &&
                        query.transactionName === "POST /x",
                )
                .reply(200, {
                    traceSamples: [{ timestamp: "t", traceId: "tr1", transactionId: "tx1", score: 1 }],
                });

            const result = await listApmTraceSamplesHandler(kibana, config)({
                serviceName: "rtm",
                transactionName: "POST /x",
                transactionType: "request",
                environment: "ENVIRONMENT_ALL",
                kuery: "",
                minDurationMs: 1000,
                limit: 20,
            });

            expect(parse(result).samples).toEqual([
                { timestamp: "t", traceId: "tr1", transactionId: "tx1" },
            ]);
        });

        it("rejects min above max without calling Kibana", async () => {
            const result = await listApmTraceSamplesHandler(kibana, config)({
                serviceName: "rtm",
                transactionName: "POST /x",
                transactionType: "request",
                environment: "ENVIRONMENT_ALL",
                kuery: "",
                minDurationMs: 10,
                maxDurationMs: 5,
                limit: 20,
            });

            expect(result.content[0].text).toBe(
                "minDurationMs must not be greater than maxDurationMs",
            );
        });
    });

    describe("getApmTraceHandler", () => {
        const traceReply = {
            traceItems: {
                exceedsMax: false,
                traceItemCount: 2,
                traceDocs: [
                    {
                        processor: { event: "span" },
                        span: { id: "s1", name: "SELECT", duration: { us: 100 } },
                        parent: { id: "root" },
                        timestamp: { us: 1300 },
                    },
                    {
                        processor: { event: "transaction" },
                        transaction: { id: "root", name: "GET /", duration: { us: 900 } },
                        timestamp: { us: 1000 },
                    },
                ],
            },
        };

        it("looks up the root transaction through the Kibana search proxy", async () => {
            let searchBody: any;
            nock(HOST)
                .post("/internal/search/es", (body) => {
                    searchBody = body;
                    return true;
                })
                .reply(200, {
                    rawResponse: { hits: { hits: [{ _source: { transaction: { id: "root" } } }] } },
                })
                .get("/internal/apm/traces/tr1")
                .query((query) => query.entryTransactionId === "root")
                .reply(200, traceReply);

            const result = await getApmTraceHandler(kibana, config)({
                traceId: "tr1",
                start: START,
                end: END,
            });

            expect(searchBody.params.index).toBe("traces-apm*");
            expect(searchBody.params.body.query.bool.must_not).toEqual([
                { exists: { field: "parent.id" } },
            ]);
            const body = parse(result);
            expect(body.entryTransactionId).toBe("root");
            expect(body.items.map((item: any) => [item.id, item.offsetUs])).toEqual([
                ["s1", 300],
                ["root", 0],
            ]);
        });

        it("falls back to any transaction of the trace when none lacks a parent", async () => {
            nock(HOST)
                .post("/internal/search/es")
                .reply(200, { rawResponse: { hits: { hits: [] } } })
                .post("/internal/search/es")
                .reply(200, {
                    rawResponse: { hits: { hits: [{ _source: { transaction: { id: "root" } } }] } },
                })
                .get("/internal/apm/traces/tr1")
                .query(true)
                .reply(200, traceReply);

            const result = await getApmTraceHandler(kibana, config)({ traceId: "tr1" });

            expect(parse(result).entryTransactionId).toBe("root");
        });

        it("asks to widen the window when the trace has no transactions", async () => {
            nock(HOST)
                .post("/internal/search/es")
                .twice()
                .reply(200, { rawResponse: { hits: { hits: [] } } });

            const result = await getApmTraceHandler(kibana, config)({ traceId: "tr1" });

            expect(result.content[0].text).toContain("Widen start/end or pass entryTransactionId");
        });

        it("skips the lookup when entryTransactionId is given", async () => {
            nock(HOST)
                .get("/internal/apm/traces/tr1")
                .query((query) => query.entryTransactionId === "root")
                .reply(200, traceReply);

            const result = await getApmTraceHandler(kibana, config)({
                traceId: "tr1",
                entryTransactionId: "root",
            });

            expect(parse(result).traceItemCount).toBe(2);
            expect(nock.isDone()).toBe(true);
        });
    });
});
