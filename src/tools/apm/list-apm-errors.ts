import { AxiosInstance } from "axios";
import { KibanaConfig } from "../../clients/kibana-client.js";
import { capItems, jsonContent } from "../../utils/apm-format.js";
import { resolveWindow } from "../../utils/time-window.js";
import {
    filterSchema,
    limitSchema,
    runTool,
    serviceNameSchema,
    windowSchema,
} from "./common.js";

export const listApmErrorsSchema = {
    serviceName: serviceNameSchema,
    ...windowSchema,
    ...filterSchema,
    limit: limitSchema(30),
};

interface ListApmErrorsArgs {
    serviceName: string;
    start?: string;
    end?: string;
    environment: string;
    kuery: string;
    limit: number;
}

export const listApmErrorsHandler =
    (kibana: AxiosInstance, config: KibanaConfig) =>
    async (args: ListApmErrorsArgs) =>
        runTool(config, "list APM errors", async () => {
            const window = resolveWindow(args.start, args.end);
            const response = await kibana.get(
                `/internal/apm/services/${encodeURIComponent(args.serviceName)}/errors/groups/main_statistics`,
                {
                    params: {
                        start: window.start,
                        end: window.end,
                        environment: args.environment,
                        kuery: args.kuery,
                    },
                },
            );

            const groups: unknown[] = response.data?.errorGroups || [];
            const capped = capItems(groups, args.limit);

            return jsonContent({
                serviceName: args.serviceName,
                ...window,
                environment: args.environment,
                total: groups.length,
                truncated: capped.truncated,
                errors: capped.items,
            });
        });
