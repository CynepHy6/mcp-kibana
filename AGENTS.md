# mcp-kibana — инструкции для агента

MCP-сервер Kibana APM. Точка входа — `src/index.ts` (регистрация tools + `instructions`), маршрутизация задач → tools — `src/utils/mcp-server-instructions.ts`. После правок: `npm test`, `npm run compile`, **поднять `version` в `package.json`**, дописать `CHANGELOG.md`, push в `master` (CI → `dist` + git-тег `v{version}`) и reload MCP.

Подробности для людей — [README.md](README.md).

## Релиз

`.github/workflows/publish-dist.yml`: на push в `master` читает `version` из `package.json`. Тег `v{version}` уже есть — только тесты. Нет — тесты, `npm run compile`, на ветку `dist` уходят `build/` и runtime-only `package.json`, ставится тег.

**Скрипт сборки — `compile`, не `build`:** `npx` + `github:` ломается, когда в `package.json` есть скрипт `build` (npm/cli#4003). На `dist` нет `devDependencies` и compile-скриптов.

Креды в режиме npx — только `env` MCP-конфига. `.env` в корне читается только у локального клона.

## Структура кода

```text
src/
  index.ts                  # регистрация MCP tools
  clients/kibana-client.ts  # axios → Kibana, ApiKey или Basic, kbn-xsrf
  tools/apm/
    common.ts               # общие zod-поля, runTool (проверка конфига, текст ошибки HTTP)
    list-apm-*.ts, get-apm-trace.ts
  utils/
    time-window.ts          # окно ISO-8601, по умолчанию 15 минут
    apm-format.ts           # сжатие ответов Kibana, offsetUs, лимиты
    mcp-server-instructions.ts
    validation.ts
tests/
  tools/                    # nock по handlers
  src/                      # unit-тесты utils
```

**Паттерн нового tool:** `tools/apm/<name>.ts` экспортирует `*Schema` (zod) и `*Handler(kibana, config)` → регистрация в `index.ts` через `server.tool(...)`. Тело handler — внутри `runTool`, чтобы ошибка Kibana вернулась текстом, а не пустым списком.

## Kibana 8.9: что важно в параметрах

- `/internal/apm/*` требуют `kbn-xsrf` и полный набор параметров, иначе 400 со списком недостающих полей.
- `list-apm-transactions`: `useDurationSummary=true` только для `avg`. Со сводкой длительностей `p95`/`p99` возвращают пустые группы.
- `list-apm-trace-samples`: `sampleRangeFrom` / `sampleRangeTo` — микросекунды, нужны обе границы.
- `get-apm-trace` без `entryTransactionId` ищет корневую транзакцию в `traces-apm*` через `POST /internal/search/es` (`elastic-api-version: 1`). Ответ лежит в `rawResponse`.
- Latency в ответах Kibana — микросекунды; в выдаче tools — `latencyMs`.

## `MCP_SERVER_INSTRUCTIONS`

Единая маршрутизация, Cursor подмешивает её агенту на каждый ход. Не дублировать те же правила в descriptions tools. Только поведенческие указания, без текста про HTTP и авторизацию.

## Отладка

```bash
npm run compile
./test-tool.sh list-apm-services '{"limit":5,"environment":"prod"}'
./test-tool.sh list-apm-transactions '{"serviceName":"rtm","latencyAggregationType":"p95"}'
./test-tool.sh get-apm-trace '{"traceId":"<trace.id>","start":"2026-10-16T13:55:00Z"}'
```

| Симптом | Причина |
|---------|---------|
| 401 | неверный API key / логин |
| 404 на `/internal/apm` | `KIBANA_BASE_URL` указывает на Elasticsearch, а не на Kibana |
| пустые группы при живом трафике | окно не то или `environment` не совпадает |
