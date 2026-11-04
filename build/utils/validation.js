/** Error text for a missing setting, or null when the config is usable. */
export const validateKibanaConfig = (config) => {
    if (!config.baseUrl) {
        return "KIBANA_BASE_URL is not set";
    }
    if (!config.apiKey && !(config.username && config.password)) {
        return "Set KIBANA_API_KEY or KIBANA_USERNAME and KIBANA_PASSWORD";
    }
    return null;
};
