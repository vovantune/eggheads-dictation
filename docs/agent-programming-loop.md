# Universal Programming Loop

Этот документ описывает repo-native протокол реализации задач через чатового оркестратора и независимых subagents. Протокол не привязан к Codex, Cursor, OpenCode или конкретной IDE: среда обязана дать runtime capabilities, а пользователь общается только с orchestration chat.

Programming `full` сохраняет существующий цикл:

```text
implement -> full QA -> fix important findings -> full QA -> ... -> pass
```

Это не console-first workflow. CLI или команды могут быть внутренним runtime adapter, но не являются пользовательским интерфейсом.

Этот файл сохраняет project-specific OpenWhispr entrypoints. Portable profiles, budgets, guard и failure semantics синхронизируются с upstream protocol; project checks берутся из `CLAUDE.md`.

## 0. Profile Routing

Перед реализацией используй решение Gate v3 из `.ai-loop/gate-policy.json`:

```text
Planning: lightweight | light | full
Programming: direct | light | guarded | full
Proof: static | focused | contract | release
```

- `direct`: main реализует и проверяет; artifacts нет.
- `light`: main реализует, один стабильный independent reviewer делает initial review и максимум один recheck; persisted run отсутствует.
- `guarded`: один стабильный independent implementer и один стабильный independent reviewer используют compact run; тот же implementer исправляет, тот же reviewer перепроверяет.
- `full`: существующий independent implementer/fixer/fresh full-QA flow из следующих разделов сохраняется без ослабления.

Main в `guarded/full` остаётся orchestrator и не исправляет code/config/docs сам. Обычная просьба реализовать задачу не включает Programming Loop. Явный `Programming Loop` задаёт минимум `light`, `light Programming Loop` — одновременно потолок `light`, а `full Programming Loop` и `implement → full QA → fixes until pass` явно разрешают `full`.

Required profile выводится из present/unresolved effects и `execution_facts.independence_need`, а не из заранее выбранной формы реализации. Hard effect или `full_independent_cycle` может обосновать рекомендацию `full`; separation of duties — `guarded`; independent review — `light`. Resolved full planning может передать bounded local fix в `guarded`.

Автоматический потолок Programming — `guarded`. Если факты рекомендуют `full`, но пользователь не запросил `full Programming Loop`/`full QA until pass` в текущем диалоге, до создания run и dispatch ролей верни `HUMAN_DECISION_REQUIRED`/`FULL_PROGRAMMING_OPT_IN_REQUIRED`. Назови точные effects, почему `guarded` недостаточен, дополнительные роли/artifacts/checks и более дешёвый вариант. Repo-local правило не является пользовательским opt-in. Planning `full` также не разрешает Programming `full`.

## 0.1 Runtime Preflight

Перед стартом loop orchestrator проверяет capabilities, обязательные для выбранного profile:

```text
Programming Loop Preflight: supported | loop-unsupported
Subagents: yes|no — ...
Subagent result readback: yes|no — ...
Persistent state: yes|no — ...
Workspace snapshot/diff: yes|no — ...
Checks execution or explicit unavailable policy: yes|no — ...
Admission guard: yes|no — node .ai-loop/bin/guard.mjs
```

Для `light` обязательны stable independent reviewer, result readback, transient decision/state вне `.ai-loop/runs` и admission guard. Для `guarded` дополнительно обязательны independent implementer, persisted state v2 и snapshot. Для `full` сохраняются все текущие capabilities, включая independent fixer и fresh full QA. Если обязательная capability недоступна, loop не стартует.

Выведи:

```text
Programming Loop Preflight: loop-unsupported
Причина: текущая среда не поддерживает обязательную capability: <capability>.
```

Не делай manual fallback, copy-paste fallback или последовательный roleplay одним агентом. Независимый QA возможен только через новый subagent/thread/session с отдельным контекстом.

## 1. Storage Contract

`light` не создаёт `.ai-loop/runs`; review budget и обязательные transient `decision.json`/state guard snapshot остаются во временном файле вне runs. Planning council/roles для `light` запрещены. `guarded/full` хранят долговременное состояние в `.ai-loop/runs/<run-id>/`.

Tracked runtime contract:

```text
.ai-loop/
  config.yml
  gate-policy.json
  gate-cases.json
  bin/guard.mjs
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
    decision.json
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

`input/decision.json` по `.ai-loop/schemas/decision.schema.json` содержит три profiles, admission decision/reason, explicit request, scope capsule/hash, initial role assignments, effects, unresolved effects, execution facts, reasons и required checks. `state.json.decision_hash` — SHA-256 canonical JSON всего decision baseline. Guard сравнивает hash, profiles, scope и непрерывную role-change chain от initial roles, а затем независимо пересчитывает минимально допустимый Programming profile из hard effects, execution facts и explicit request по `gate-policy.json`; совместно заниженные profile/hash admission не проходят. Если Programming Loop стартует после Planning Loop, orchestrator обязан прочитать `approved_plan_path`, скопировать его содержимое в `input/approved-plan.md` и считать этот snapshot source of truth для реализации. История planning-чата не является source of truth.

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

Blocking severity берётся только из canonical `state.gate.fail_on_severity` (по умолчанию `blocker/critical/major`). Unresolved `minor`/`nit` могут остаться при `PASS`, фиксируются как residual findings и сами по себе не запускают fixer/recheck. Reviewer не обязан писать, что findings отсутствуют.

Orchestrator валидирует все JSON-артефакты по схемам из `.ai-loop/config.yml` и перед каждым admission action запускает `.ai-loop/bin/guard.mjs`. Новые `guarded/full` runs используют state schema v2; завершённые v1 runs остаются historical read-only и не мигрируются. `verdict: "pass"` от reviewer не является достаточным условием завершения, если schema validation, guard, checks, plan coverage или severity gate не проходят.

Final pass proof:

- после любого `iterations/<N>/fixes.md` orchestrator обязан запустить новый независимый full QA и сохранить его в `iterations/<N+1>/`;
- `final/verdict.json` не может быть самостоятельным QA-result: он должен ссылаться на latest QA event overall через `source_iteration`;
- latest QA event overall обязан иметь `verdict: "pass"`, полный plan coverage, passed/accepted checks и не иметь unresolved findings с severity из `gate.fail_on_severity`; `minor`/`nit` этому не мешают;
- если после указанного QA есть implementation/fix/non-pass QA либо существует более поздний QA, состояние `PASSED` запрещено и loop возвращается в `QA_RUNNING`;
- `manifest.json.status`, `state.json.status` и `final/verdict.json.verdict` должны согласованно отражать завершение (`passed` / `PASSED` / `pass`).

### Admission guard

Guard dependency-free, read-only и возвращает stable JSON:

- exit `0`, `decision: "ALLOW"`;
- exit `2`, `decision: "HUMAN_DECISION_REQUIRED"`;
- exit `1`, `decision: "INVALID"` для invalid invocation/state.

Перед каждым action передай актуальные state и отдельный decision baseline. CLI строго отклоняет отсутствующие и лишние action-specific args:

```bash
node .ai-loop/bin/guard.mjs --state <state.json> --decision <input/decision.json> --action validate-state
node .ai-loop/bin/guard.mjs --state <state.json> --decision <input/decision.json> --action dispatch-role --role reviewer --actor-id <id> --iteration 2
node .ai-loop/bin/guard.mjs --state <state.json> --decision <input/decision.json> --action dispatch-role --role reviewer-project-dod --actor-id <id> --iteration 2 --pass rerun
node .ai-loop/bin/guard.mjs --state <state.json> --decision <input/decision.json> --action run-check --check-id <id>
node .ai-loop/bin/guard.mjs --state <state.json> --decision <input/decision.json> --action extend-budget --next-limit 8 --approval-ref current-dialog:<record-id>
node .ai-loop/bin/guard.mjs --state <state.json> --decision <input/decision.json> --action finalize
```

State v2 хранит `decision_hash`, profiles, полный scope с `scope_hash` и approval evidence, current role assignments/change chain, base/active budgets, continuous extension ledger, current snapshot, Check Map и contiguous ordered planning/implementation/review/fix/QA activity. `scope_hash` — SHA-256 canonical JSON только полей `owner`, `source_of_truth`, `in_scope`, `out_of_scope`, `direct_consumers`, `rollback`: object keys сортируются, порядок array сохраняется.

Guard dependency-free валидирует decision/state напрямую по tracked JSON schemas, затем проверяет semantic invariants. После любой activity следующий role dispatch допускает только `current iteration + 1`; initial dispatch без activity использует iteration 1. Guard также производит число light reviews и planning initial/rerun budget из activity и требует совпадения state counters. Для planning dispatch обязателен `--pass initial|rerun`; устаревший `--rerun false` отклоняется как лишний аргумент. Initial roles, profiles и approved scope берутся из decision baseline; каждая role replacement обязана продолжать chain от baseline. Check с тем же `id` не повторяется на том же snapshot независимо от произвольного `invalidated_by`; invalidated rerun требует нового snapshot. Final admission использует latest QA event overall и отдельно требует отсутствие open important findings, passed/accepted mandatory checks и `plan_coverage_complete: true`.

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
- три profiles и explicit loop request;
- scope capsule с hash/approval;
- Check Map: risk/contract, id, exact command/procedure, failure mode, tier, snapshot, invalidation triggers и status.

Context Pack не должен зависеть от памяти длинного чата. После compaction новый orchestrator должен продолжить loop только из durable artifacts и текущего workspace snapshot.

## 4. Roles

Для `light/guarded` используется `.ai-loop/prompts/programming/compact-reviewer.md`: reviewer проверяет bounded scope и direct contracts, initial review и один recheck выполняет одна identity. Для `guarded` implementer prompt переиспользуется; исправления делает тот же implementer. Следующие Implementer/Reviewer/Fixer contracts полностью применяются к `full`.

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

`minor` и `nit` фиксируются в ledger, но не блокируют завершение и сами по себе не запускают fixer/recheck, если project rules не требуют обратного. PASS не требует формулировки «findings отсутствуют».

## 5.1 Proof and Check Map

- `static`: parse/syntax, readback, diff, wiring.
- `focused`: существующая focused-проверка или один regression/negative test названного failure mode.
- `contract`: focused contract/integration check и применимый smoke.
- `release`: full suite и post-deploy/live proof для broad release/deployment/complex migration или mandatory project gate.

Не создавай тест без названного непокрытого failure mode и не проверяй ordinary docs/help/prompt точным wording, если текст не machine-consumed contract/wiring. Не повторяй check на том же snapshot. После fix повторяй только invalidated checks. Full suite ниже `release` запрещён, кроме явно mandatory project rule. Unavailable check не равен pass.

## 6. Human Decisions

Orchestrator спрашивает пользователя только когда нельзя безопасно продолжить по протоколу:

- нужно расширить scope;
- нужно утвердить прямую правку source кода библиотеки;
- mandatory check недоступен и policy не разрешает unavailable;
- finding спорный после fix/review;
- loop достиг `max_iterations`.

`base_max_iterations=5` фиксируется при старте `guarded/full` run. `active_max_iterations` может измениться только через extension ledger; глобальный config не меняется. Новые findings, неудачная проверка, deployment failure или желание довести работу до `pass` не являются разрешением на продление. При достижении лимита orchestrator:

1. останавливает loop со статусом `HUMAN_DECISION_REQUIRED`;
2. сообщает пользователю текущий результат, unresolved findings и доступные artifacts;
3. продолжает только после явного разрешения пользователя в текущем диалоге;
4. сохраняет точный новый limit, `previous_limit → new_limit`, current-dialog approval evidence и timestamp в непрерывном extension ledger.

Без такого evidence любое повышение лимита считается нарушением протокола. После десяти суммарных итераций предложи новый loop/подход; продолжение требует отдельного явного решения пользователя и записи `post_ten_decision`.

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
