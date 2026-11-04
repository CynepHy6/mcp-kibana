import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";

/**
 * MCP-аннотации инструментов. Клиент (Cursor, Claude, Рабочий стол) по `readOnlyHint` решает,
 * спрашивать ли человека и пускать ли вызов в режимах только чтения. Без аннотации клиент угадывает
 * по имени, а имена здесь через дефис (`list-apm-services`) и под его шаблоны не попадают.
 */
const READ_ONLY: ToolAnnotations = { readOnlyHint: true, openWorldHint: true };

export const TOOL_ANNOTATIONS: Record<string, ToolAnnotations> = {
    "list-apm-services": READ_ONLY,
    "list-apm-transactions": READ_ONLY,
    "list-apm-errors": READ_ONLY,
    "list-apm-trace-samples": READ_ONLY,
    // POST /internal/search/es — поисковый запрос через прокси Kibana, ничего не меняет.
    "get-apm-trace": READ_ONLY,
};

/** Аннотации инструмента по имени. Незнакомое имя — ошибка: новый инструмент без пометки не регистрируется. */
export function toolAnnotations(name: string): ToolAnnotations {
    const annotations = TOOL_ANNOTATIONS[name];
    if (!annotations) throw new Error(`No MCP annotations for tool "${name}"`);
    return annotations;
}
