# mcp-kibana

MCP-сервер для **Kibana APM** в Cursor и Claude Code: сервисы, группы транзакций, группы ошибок, сэмплы трейсов и водопад трейса.

Сервер ходит во внутренние роуты Kibana `/internal/apm/*` — те же агрегаты, что показывает UI APM. Сырые логи и документы `traces-apm*` ищут другими средствами (например, MCP Gateway `logs`); здесь только то, что считает Kibana.

## Быстрый старт (npx, без клона)

Добавить в MCP-конфиг (`~/.cursor/mcp.json`, `.mcp.json` или project config):

```json
{
  "mcpServers": {
    "kibana": {
      "command": "npx",
      "args": ["-y", "github:CynepHy6/mcp-kibana#semver:^1"],
      "env": {
        "KIBANA_BASE_URL": "https://kibana.example.com",
        "KIBANA_API_KEY": "your_api_key"
      }
    }
  }
}
```

Креды передаются **только через `env`** в MCP-конфиге (файл `.env` рядом с репозиторием при npx не используется).

| Переменная | Нужна | Примечание |
|------------|-------|------------|
| `KIBANA_BASE_URL` | всегда | адрес Kibana, не кластера Elasticsearch `:9200` |
| `KIBANA_API_KEY` | или логин с паролем | уходит как `Authorization: ApiKey <key>` |
| `KIBANA_USERNAME`, `KIBANA_PASSWORD` | если нет API key | Basic auth |
| `KIBANA_TIMEOUT_MS` | нет | таймаут запроса, по умолчанию `30000` |

Без кредов сервер стартует, а каждый tool отвечает текстом ошибки конфигурации.

### Версия в `args`

`npx` скачивает пакет из GitHub по адресу `github:CynepHy6/mcp-kibana`. Суффикс после `#` выбирает, **какую версию** установить:

- каждый релиз помечен git-тегом вида `v1.0.0` (история — в [CHANGELOG.md](CHANGELOG.md));
- `npx` сохраняет установку в `~/.npm/_npx/<hash>/`, где hash зависит от строки в `args`.

| Ref | Пример `args` | Когда использовать |
|-----|---------------|-------------------|
| диапазон `v1.x` | `["-y", "github:CynepHy6/mcp-kibana#semver:^1"]` | по умолчанию; при старте MCP подтягивает максимальный git-тег `v1.x` |
| конкретный тег | `["-y", "github:CynepHy6/mcp-kibana#v1.0.0"]` | зафиксировать версию |

**Обновление:** с `#semver:^1` новый релиз `v1.x` обычно подтягивается при старте MCP — reload клиента чаще всего достаточно. С `#v1.0.0` версия зафиксирована: смените ref. Если не помогло — `npx clear-npx-cache` и снова reload MCP.

## Альтернатива: локальный клон

```bash
git clone https://github.com/CynepHy6/mcp-kibana.git
cd mcp-kibana
cp .env.example .env   # заполнить креды
npm install && npm run compile
```

```json
{
  "mcpServers": {
    "kibana": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-kibana/build/index.js"]
    }
  }
}
```

## Что умеет

| Tool | Что отдаёт |
|------|-----------|
| `list-apm-services` | сервисы за окно: `latencyMs`, `errorRate`, `throughputPerMinute` |
| `list-apm-transactions` | группы транзакций сервиса; latency `avg`, `p95` или `p99` |
| `list-apm-errors` | группы ошибок сервиса: `name`, `occurrences`, `culprit`, `type` |
| `list-apm-trace-samples` | `traceId` и `transactionId` сэмплов группы; `minDurationMs` / `maxDurationMs` оставляют медленные |
| `get-apm-trace` | водопад трейса: транзакции и спаны с `durationUs` и `offsetUs` |

Типичная цепочка для медленной ручки: `list-apm-transactions` (p95) → `list-apm-trace-samples` с именем транзакции → `get-apm-trace`.

- Окно — `start` / `end` в ISO-8601; без зоны — UTC. Без границ — последние 15 минут.
- `latencyMs` — миллисекунды; `durationUs` и `offsetUs` — микросекунды.
- Элементы `get-apm-trace` идут не по времени, сортировать по `offsetUs`.
- Пустой список — за окно ничего нет, не ошибка. Сэмплируется не каждый запрос.
- `truncated` или `exceedsMax` — список или водопад неполный.

## Разработка

```bash
npm install
npm test
npm run compile
./test-tool.sh list-apm-services '{"limit": 5}'
```

Релиз: поднять `version` в `package.json`, дописать [CHANGELOG.md](CHANGELOG.md), push в `master`. CI прогоняет тесты, собирает `build/`, публикует ветку `dist` и тег `v{version}`.
