export const DEFAULT_WINDOW_MINUTES = 15;
/** Window as ISO-8601 UTC. Empty bounds mean the last `defaultMinutes` minutes before end. */
export const resolveWindow = (start, end, defaultMinutes = DEFAULT_WINDOW_MINUTES, now = new Date()) => {
    const endDate = end ? parseIso(end) : now;
    const startDate = start
        ? parseIso(start)
        : new Date(endDate.getTime() - defaultMinutes * 60000);
    if (startDate.getTime() >= endDate.getTime()) {
        throw new Error("start must be earlier than end");
    }
    return { start: startDate.toISOString(), end: endDate.toISOString() };
};
/** A value without a zone is read as UTC, not as the local time of the MCP host. */
export const parseIso = (value) => {
    const text = value.trim();
    const hasZone = /(Z|[+-]\d{2}:?\d{2})$/i.test(text);
    const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(text);
    const normalized = hasZone || isDateOnly ? text : `${text}Z`;
    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) {
        throw new Error(`invalid time: ${value}`);
    }
    return parsed;
};
