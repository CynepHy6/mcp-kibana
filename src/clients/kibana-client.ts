import axios, { AxiosError, AxiosInstance } from "axios";

export interface KibanaConfig {
    baseUrl: string;
    apiKey: string;
    username: string;
    password: string;
    timeoutMs: number;
}

export const getKibanaConfig = (): KibanaConfig => ({
    baseUrl: (process.env.KIBANA_BASE_URL || "").trim().replace(/\/+$/, ""),
    apiKey: (process.env.KIBANA_API_KEY || "").trim(),
    username: process.env.KIBANA_USERNAME || "",
    password: process.env.KIBANA_PASSWORD || "",
    timeoutMs: Number(process.env.KIBANA_TIMEOUT_MS || 30000),
});

/** Kibana host, not the Elasticsearch cluster: /internal/apm/* serve the APM UI aggregates. */
export const createKibanaClient = (config: KibanaConfig): AxiosInstance => {
    const headers: Record<string, string> = {
        Accept: "application/json",
        "kbn-xsrf": "true",
    };

    if (config.apiKey) {
        headers.Authorization = `ApiKey ${config.apiKey}`;
    } else if (config.username && config.password) {
        const authString = Buffer.from(
            `${config.username}:${config.password}`,
        ).toString("base64");
        headers.Authorization = `Basic ${authString}`;
    }

    return axios.create({
        baseURL: config.baseUrl,
        headers,
        timeout: config.timeoutMs,
    });
};

export const createConfiguredKibanaClient = (): AxiosInstance =>
    createKibanaClient(getKibanaConfig());

export const kibanaErrorMessage = (error: unknown): string => {
    const axiosError = error as AxiosError<unknown>;
    if (axiosError?.isAxiosError && axiosError.response) {
        const data = axiosError.response.data as
            | { message?: string; error?: string }
            | string
            | undefined;
        let message = "";
        if (data && typeof data === "object") {
            message = String(data.message || data.error || "");
        } else if (typeof data === "string") {
            message = data.slice(0, 300);
        }
        return `Kibana HTTP ${axiosError.response.status}: ${message}`;
    }
    return (error as Error).message;
};
