import { z } from "zod";
import { KibanaConfig, kibanaErrorMessage } from "../../clients/kibana-client.js";
import { errorContent } from "../../utils/apm-format.js";
import { validateKibanaConfig } from "../../utils/validation.js";

export const windowSchema = {
    start: z
        .string()
        .optional()
        .describe("Window start, ISO-8601 (UTC if no zone). Empty: 15 minutes before end"),
    end: z
        .string()
        .optional()
        .describe("Window end, ISO-8601 (UTC if no zone). Empty: now"),
};

export const filterSchema = {
    environment: z
        .string()
        .default("ENVIRONMENT_ALL")
        .describe("ENVIRONMENT_ALL, ENVIRONMENT_NOT_DEFINED or an environment name such as prod"),
    kuery: z.string().default("").describe("Kibana KQL filter"),
};

export const serviceNameSchema = z
    .string()
    .trim()
    .min(1)
    .describe("Service name as shown in APM");

export const limitSchema = (defaultLimit: number) =>
    z
        .number()
        .int()
        .min(1)
        .max(100)
        .default(defaultLimit)
        .describe("How many items to return, 1..100");

/** Wraps a handler body: config check first, Kibana errors become text instead of an empty result. */
export const runTool = async <T>(
    config: KibanaConfig,
    label: string,
    body: () => Promise<T>,
): Promise<T | ReturnType<typeof errorContent>> => {
    const configError = validateKibanaConfig(config);
    if (configError) {
        return errorContent(`Configuration error: ${configError}`);
    }
    try {
        return await body();
    } catch (error) {
        // The message only: the axios error carries request headers with credentials.
        const message = kibanaErrorMessage(error);
        console.error(`Error in ${label}: ${message}`);
        return errorContent(`Failed to ${label}: ${message}`);
    }
};
