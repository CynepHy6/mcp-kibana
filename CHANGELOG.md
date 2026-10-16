# Changelog

Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/); нумерация версий — [Semantic Versioning](https://semver.org/lang/ru/).

## [1.0.0] - 2026-10-16

### Добавлено

- **`list-apm-services`** — сервисы Kibana APM за окно: `latencyMs`, `errorRate`, `throughputPerMinute`, сортировка по throughput.
- **`list-apm-transactions`** — группы транзакций сервиса; `latencyAggregationType` `avg`, `p95` или `p99`.
- **`list-apm-errors`** — группы ошибок сервиса.
- **`list-apm-trace-samples`** — `traceId` и `transactionId` сэмплов группы транзакций, фильтр по длительности.
- **`get-apm-trace`** — водопад трейса с `durationUs` и `offsetUs`. Без `entryTransactionId` корневая транзакция ищется в `traces-apm*` через поисковый прокси Kibana, прямой доступ к Elasticsearch не нужен.
- Авторизация `KIBANA_API_KEY` или `KIBANA_USERNAME` + `KIBANA_PASSWORD`.
