import { AxiosInstance } from "axios";
import { KibanaConfig } from "../../clients/kibana-client.js";
import { capItems, compactService, jsonContent } from "../../utils/apm-format.js";
import { resolveWindow } from "../../utils/time-window.js";
import { filterSchema, limitSchema, runTool, windowSchema } from "./common.js";

export const listApmServicesSchema = {
    ...windowSchema,
    ...filterSchema,
    limit: limitSchema(40),
};

interface ListApmServicesArgs {
    start?: string;
    end?: string;
    environment: string;
    kuery: string;
    limit: number;
}

export const listApmServicesHandler =
    (kibana: AxiosInstance, config: KibanaConfig) =>
    async ({ start, end, environment, kuery, limit }: ListApmServicesArgs) =>
        runTool(config, "list APM services", async () => {
            const window = resolveWindow(start, end);
            const response = await kibana.get("/internal/apm/services", {
                params: {
                    start: window.start,
                    end: window.end,
                    environment,
                    kuery,
                    documentType: "serviceTransactionMetric",
                    probability: "1",
                    rollupInterval: "1m",
                },
            });

            const services = (response.data?.items || []).map(compactService);
            services.sort(
                (a: any, b: any) => (b.throughputPerMinute || 0) - (a.throughputPerMinute || 0),
            );
            const capped = capItems(services, limit);

            return jsonContent({
                ...window,
                environment,
                total: services.length,
                truncated: capped.truncated,
                services: capped.items,
            });
        });
