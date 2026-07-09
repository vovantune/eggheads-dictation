# Universal Programming Loop

Этот документ описывает repo-native протокол реализации задач через чатового оркестратора и независимых subagents. Протокол не привязан к Codex, Cursor, OpenCode или конкретной IDE: среда обязана дать runtime capabilities, а пользователь общается только с orchestration chat.

Programming Loop реализует цикл:

```text
implement -> full QA -> fix important findings -> full QA -> ... -> pass
```

Это не console-first workflow. CLI или команды могут быть внутренним runtime adapter, но не являются пользовательским интерфейсом.

Этот файл перенесен из `open-code-ai`. Сохраняй протокол максимально близко к источнику; меняй только project-specific DoD и правила, которые явно ведут не в этот проект.

## 0. Runtime Preflight

Перед стартом loop orchestrator проверяет обязательные capabilities:

```text
Programming Loop Preflight: supported | loop-unsupported
Subagents: yes|no — ...
Subagent result readback: yes|no — ...
Persistent state: yes|no — ...
Workspace snapshot/diff: yes|no — ...
Checks execution or explicit unavailable policy: yes|no — ...
```

Если любая обязательная capability недоступна, loop не стартует.

Выведи:

```text
Programming Loop Preflight: loop-unsupported
Причина: текущая среда не поддерживает обязательную capability: <capability>.
```

Не делай manual fallback, copy-paste fallback или последовательный roleplay одним агентом. Независимый QA возможен только через новый subagent/thread/session с отдельным контекстом.

## 1. Storage Contract

Все долговременное состояние хранится вне чата в `.ai-loop/runs/<run-id>/`.

Tracked runtime contract:

```text
.ai-loop/
  config.yml
  schemas/
  prompts/
```

Ignored runtime artifacts:

```text
.ai-loop/runs/
```

Run layout:

```text
.ai-loop/runs/<run-id>/
  manifest.json
  state.json
  ledger.md
  input/
    task.md
    approved-plan.md
    constraints.md
    acceptance.md
  context/
    context-pack.md
  workspace/
    snapshot.md
    diff.patch
    touched-files.txt
  implementation/
    summary.md
  iterations/
    001/
      phase.json
      prompt.md
      result.md
      result.json
      checks.log
      diff.patch
  final/
    summary.md
    verdict.json
```

`manifest.json` содержит тип цикла:

```json
{
  "loop_type": "programming",
  "approved_plan_path": "plans/<task-slug>.md",
  "source_planning_run": ".ai-loop/runs/<planning-run-id>",
  "runtime": "codex|cursor|opencode|server|other",
  "created_by": "chat-orchestrator",
  "status": "precheck"
}
```

Если Programming Loop стартует после Planning Loop, orchestrator обязан прочитать `approved_plan_path`, скопировать его содержимое в `input/approved-plan.md` и считать этот snapshot source of truth для реализации. История planning-чата не является source of truth.

## 2. State Machine

Допустимые состояния:

- `PRECHECK`
- `IMPLEMENTING`
- `IMPLEMENTED`
- `QA_RUNNING`
- `FIX_REQUIRED`
- `FIXING`
- `PASSED`
- `FAILED_RUNTIME`
- `LOOP_UNSUPPORTED`
- `HUMAN_DECISION_REQUIRED`

Main orchestrator is not an implementer, fixer, or reviewer.

The orchestrator may:

- run preflight;
- create and update `.ai-loop/runs/<run-id>/` artifacts;
- build context packs, snapshots, diff summaries, ledgers, prompts, and verdicts;
- start independent implementer/reviewer/fixer subagents or clean threads;
- run or collect checks as the runtime adapter when required by the loop;
- adjudicate results and decide the next state.

The orchestrator must not:

- edit application code, config, docs, tests, deployment templates, or runtime prompts to implement the approved plan;
- fix reviewer findings directly;
- perform reviewer duties itself after implementation;
- treat its own implementation work as an independent role result.

If no independent implementer can be launched, the loop status is `LOOP_UNSUPPORTED`; do not continue as a single-agent implementation.

Stop condition:

- checks passed или checks explicitly unavailable by policy;
- нет unresolved `blocker`, `critical`, `major`;
- QA подтвердил покрытие исходной задачи и плана;
- нет runtime errors;
- все спорные important findings либо исправлены, либо человек явно перевел их в non-blocking.

Orchestrator валидирует все JSON-артефакты по схемам из `.ai-loop/config.yml` и пересчитывает gate fail-closed. `verdict: "pass"` от reviewer не является достаточным условием завершения, если schema validation, checks, plan coverage или severity gate не проходят. Невалидный обязательный JSON считается runtime failure и переводит loop в `FAILED_RUNTIME` или `HUMAN_DECISION_REQUIRED` с фактической причиной.

Final pass proof:

- после любого `iterations/<N>/fixes.md` orchestrator обязан запустить новый независимый full QA и сохранить его в `iterations/<N+1>/`;
- `final/verdict.json` не может быть самостоятельным QA-result: он должен ссылаться на последний successful full QA через `source_iteration`;
- `source_iteration` должен указывать на существующий `iterations/<N>/result.json` с `verdict: "pass"`, полным plan coverage, passed/accepted checks и без important findings;
- если после указанной `source_iteration` есть более поздний `fixes.md`, состояние `PASSED` запрещено и loop возвращается в `QA_RUNNING`;
- `manifest.json.status`, `state.json.status` и `final/verdict.json.verdict` должны согласованно отражать завершение (`passed` / `PASSED` / `pass`).

## 3. Context Pack

Перед каждым subagent запуском orchestrator пересобирает полный `context-pack.md`.

Context Pack содержит:

- исходную задачу;
- approved plan;
- acceptance criteria;
- constraints и non-goals;
- current state и iteration;
- current diff/workspace snapshot;
- touched files;
- results of checks;
- ledger прошлых important findings;
- role-specific instruction.

Context Pack не должен зависеть от памяти длинного чата. После compaction новый orchestrator должен продолжить loop только из durable artifacts и текущего workspace snapshot.

## 4. Roles

### Implementer

Implementer must be a separate independent subagent/thread/session from the main orchestrator.

Делает исходную задачу по approved plan.

Возвращает:

- что изменено;
- какие требования плана покрыты;
- какие checks запускались;
- что не удалось проверить;
- known risks.
- JSON по `.ai-loop/schemas/subagent-result.schema.json` с `role: "implementer"`.

### Reviewer

Каждый QA запуск — новый независимый subagent. Reviewer получает полный Context Pack и выполняет полный review от исходной задачи и плана.

Запрещенный prompt:

```text
Посмотри, исправлены ли прошлые замечания.
```

Обязательный смысл prompt:

```text
Do a full review from the original task and approved plan.
Do not limit scope to previous findings or recent fixes.
Re-check correctness, completeness, regressions, tests, edge cases, maintainability, and project rules.
```

Reviewer возвращает markdown для человека, JSON по `.ai-loop/schemas/qa-result.schema.json` и JSON по `.ai-loop/schemas/subagent-result.schema.json` с `role: "reviewer"`.

### Fixer

Fixer must be a separate independent subagent/thread/session from the main orchestrator. If no fixer can be launched, the orchestrator records `LOOP_UNSUPPORTED` or `HUMAN_DECISION_REQUIRED` instead of fixing findings directly.

Исправляет все unresolved `blocker`, `critical`, `major` findings.

Fixer получает полный Context Pack, а не только список последних замечаний. Если finding спорный, fixer не должен молча игнорировать его: он возвращает `HUMAN_DECISION_REQUIRED` с фактическим объяснением.

Fixer возвращает JSON по `.ai-loop/schemas/subagent-result.schema.json` с `role: "fixer"`.

### Adjudicator

Adjudicator опционален. Main orchestrator может классифицировать findings формально по JSON. Отдельный adjudicator нужен только если:

- reviewer и fixer спорят о blocking status;
- finding требует изменения scope;
- исправление требует прямой правки кода библиотеки;
- требуется решение пользователя.

## 5. QA Severity Gate

Severity:

- `blocker` — loop не может продолжаться или результат непригоден;
- `critical` — correctness/security/data loss/money loss/privacy risk;
- `major` — важное требование, regression risk или missing proof;
- `minor` — не блокирует сдачу;
- `nit` — косметика.

Gate fails при любом unresolved `blocker`, `critical`, `major`.

`minor` и `nit` фиксируются в ledger, но не блокируют завершение, если project rules не требуют обратного.

## 6. Human Decisions

Orchestrator спрашивает пользователя только когда нельзя безопасно продолжить по протоколу:

- нужно расширить scope;
- нужно утвердить прямую правку source кода библиотеки;
- mandatory check недоступен и policy не разрешает unavailable;
- finding спорный после fix/review;
- loop достиг `max_iterations`.

В остальных случаях orchestrator продолжает цикл без дополнительных подтверждений.

## 7. Relationship With Planning Loop

Programming Loop использует тот же общий `.ai-loop` runtime contract, что и Planning Loop.

Planning -> Programming handoff:

1. Planning Loop сохраняет approved plan в `plans/<task-slug>.md`.
2. Planning Loop сохраняет trace в `.ai-loop/runs/<planning-run-id>/`.
3. Handoff prompt содержит только путь к approved plan и optional planning trace path.
4. Programming Loop стартует в clean session/thread, если runtime поддерживает создание новой session.
5. Если clean session недоступна, текущая session останавливается и показывает handoff prompt человеку, не начиная реализацию в planning context.

Если стартовое сообщение начинается с `PLEASE IMPLEMENT THIS PLAN:`, Programming Loop не стартует напрямую из текста чата. Это Codex plan-button approval event: сначала должен быть выполнен Planning -> Programming handoff, создан readable `plans/<task-slug>.md`, затем preflight читает approved plan из файла и копирует snapshot в `input/approved-plan.md`.

Минимальный handoff prompt:

```text
Запусти Programming Loop по plans/<task-slug>.md
```
