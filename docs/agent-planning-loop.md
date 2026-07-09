# XP Planning Loop

Этот документ описывает repo-native протокол планирования для задач, где важно получить не первую приличную идею, а выбранный synthesis после сравнения альтернатив по фактам, ограничениям и Definition of Done.

Это не skill. Документ читается только после короткого Planning Loop Gate из активных project rules.

Full XP Planning Loop обязателен только при доступных независимых agents/subagents/agent threads. Во всех рабочих средах проекта multiagent должен быть доступен. Если агент не может запустить независимых агентов, он обязан остановиться и сообщить пользователю, что full loop выполнить нельзя. Последовательное исполнение ролей одним агентом не является допустимым full loop и не должно маскироваться под независимое ревью.

Этот файл перенесен из `open-code-ai`. Сохраняй протокол максимально близко к источнику; меняй только project-specific DoD и правила, которые явно ведут не в этот проект.

Planning Loop использует общий `.ai-loop` runtime contract вместе с Programming Loop. Чатовая история не является source of truth: все долговременные решения, JSON-результаты, approved plan и handoff сохраняются в `.ai-loop/runs/<planning-run-id>/` и `plans/<task-slug>.md`.

## 0. Planning Loop Gate

Сначала классифицируй задачу и выведи проверяемый gate:

```text
Planning Loop Gate: lightweight | light | full | blocked-no-subagents
Hard triggers: present|absent|unknown — ...
Soft triggers: N — ...
Unknowns: ...
Why not full: ...   # обязательно для lightweight/light
```

### Lightweight

Используй `lightweight`, если задача маленькая и локальная:

- не меняет API, DB/schema, deployment, auth, billing, security, provider, ops или UX contract;
- не создает долгоживущий source of truth;
- не имеет нескольких правдоподобных подходов;
- не требует отдельного proof plan.

Для `lightweight` не читай этот full-loop reference дальше и не запускай subagents. Дай короткий план или сразу ответь в рамках режима.

### Light

Используй `light`, если задача средняя и полезно сравнить подходы, но нет hard-trigger для full loop.

Требования:

- собрать минимальный context pack;
- сравнить минимум 2 подхода;
- выбрать один подход по rubric;
- показать rejected alternative и proof plan;
- subagents использовать только если есть независимые ветки анализа.

### Full

`full` обязателен, если есть хотя бы один hard-trigger:

- DB/schema/migration/ORM/generated docs;
- public API, external contract, webhook, payload или backward compatibility;
- deployment, auth, provider, billing, security или ops;
- multi-repo или multi-service изменение;
- риск data loss, money loss, privacy leak или сложный rollback.

`full` также обязателен, если есть 2+ soft-trigger:

- новая фича или архитектурное решение;
- несколько правдоподобных подходов;
- user-visible или operator-visible workflow;
- unclear requirements или спорный source of truth;
- performance/load-sensitive path;
- высокий риск overengineering;
- риск написать свое вместо reuse;
- задача похожа на ранее проблемные кейсы: relay, scheduler, sync, session state, generated docs.

Soft-trigger count учитывает только реальные продуктовые/технические риски. Мелкая локальная user-visible правка с ясным контрактом не становится `full` только из-за видимости пользователю; если есть сомнение, укажи `unknown` и выбери `full` или задай blocking question.

Для `full` сначала прочитай весь этот документ, затем выполни полноценный multiagent loop.

### Blocked: No Subagents

Если gate требует `full`, но независимые agents/subagents недоступны, не выполняй single-agent simulation.

Выведи:

```text
Planning Loop Gate: blocked-no-subagents
Причина: full Planning Loop требует независимых agents/subagents, но текущая среда не дает их запустить.
```

После этого остановись и попроси пользователя открыть среду/режим с multiagent support. Не называй это fallback и не делай вид, что roles одного агента независимы.

## 0.1 Runtime Storage Contract

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

Planning run layout:

```text
.ai-loop/runs/<planning-run-id>/
  manifest.json
  state.json
  ledger.md
  input/
    task.md
    constraints.md
    acceptance.md
  context/
    context-pack.md
  planning/
    gate.json
    planners/
      reuse/result.md
      reuse/result.json
      minimal/result.md
      minimal/result.json
      ops/result.md
      ops/result.json
      ux/result.md
      ux/result.json
    reviewers/
      yagni-scope/result.md
      yagni-scope/result.json
      evidence-contract/result.md
      evidence-contract/result.json
      project-dod/result.md
      project-dod/result.json
    synthesis/
      final-plan.md
      final-result.json
  handoff/
    approved-plan-path.txt
    programming-start-prompt.md
  final/
    summary.md
    verdict.json
```

Approved plan artifact:

```text
plans/<task-slug>.md
```

`light` и `full` Planning Loop не считается завершенным, пока пользователь не утвердил итоговый synthesis и approved plan не сохранен в `plans/<task-slug>.md`.

## 0.2 JSON Validation

Orchestrator валидирует все обязательные JSON-артефакты по schemas из `.ai-loop/config.yml`:

- planner results по `.ai-loop/schemas/planning-result.schema.json`;
- reviewer results по `.ai-loop/schemas/planning-review-result.schema.json`;
- final synthesis по `.ai-loop/schemas/planning-final-result.schema.json`;
- loop state по `.ai-loop/schemas/loop-state.schema.json`;
- subagent role contract по `.ai-loop/schemas/subagent-result.schema.json`.

Validation работает fail-closed: невалидный JSON, missing required artifact или несовпадение severity/status переводит loop в `FAILED_RUNTIME` или `HUMAN_DECISION_REQUIRED`. Reviewer `verdict: pass` не завершает loop сам по себе, если schema validation, proof gates, approved plan artifact или handoff contract не выполнены.

## 1. Context Pack

Main orchestrator сначала собирает общий Context Pack и не проектирует решение до его завершения.

Context Pack содержит только факты и ограничения, без preferred solution:

- цель пользователя и критерий успеха;
- текущая архитектура и source of truth;
- in scope и non-goals;
- существующие механизмы, похожие реализации, helpers, libraries и configs;
- affected contracts: API, DB, config, UX, deployment, docs;
- project-specific DoD и обязательные proof-команды;
- known unknowns, которые нельзя проверить без пользователя;
- ссылки на релевантные файлы, docs, команды и evidence.

Один и тот же Context Pack передается всем planner agents. Если факт можно проверить в репозитории, не спрашивай пользователя.

Context Pack сохраняется в `.ai-loop/runs/<planning-run-id>/context/context-pack.md` и должен быть достаточен для продолжения после compaction без обращения к памяти чата.

## 2. Independent Planner Agents

Planner agents работают независимо и не видят ответы друг друга до возврата результата. Context Pack не должен подталкивать их к заранее выбранному решению.

Каждый planner возвращает:

- recommended approach;
- rejected alternative;
- evidence: файлы, команды, docs или явно помеченные assumptions;
- minimal contract;
- key risks;
- proof needed.

Alternatives должны быть materially distinct and feasible. Нельзя считать competing approaches вариантами одной и той же идеи с переименованными полями, если они не различаются source of truth, implementation boundary, contract shape, reuse strategy или failure semantics.

Минимальный набор для full loop:

### Agent A: Reuse / No-code Planner

Мандат: найти путь без нового кода или с минимальным кодом.

Проверяет existing configs, services, project helpers, CLI wrappers, deployment wiring, libraries и предыдущие похожие решения.

Обязан приложить `Reuse Lookup Log`:

- какие команды/поиски выполнены;
- какие файлы, configs, docs, helpers и libraries проверены;
- что найдено и почему подходит/не подходит;
- какие reuse candidates отвергнуты и по какому факту.

Обязан ответить:

```text
Можно ли решить настройкой/reuse?
Если да, что именно уже есть?
Что не надо писать?
```

### Agent B: XP Minimal Planner

Мандат: simplest thing that could possibly work.

Проверяет минимальный API, минимальную таблицу, минимальный payload, non-goals, YAGNI и отсутствие future-proof мусора.

Для каждого нового поля/API/флага обязан ответить:

```text
Что сломается в текущей задаче, если этого не будет сейчас?
```

### Agent C: Robust / Ops Planner

Мандат: эксплуатация и надежность.

Проверяет retry, idempotency, failure semantics, нагрузку, безопасность, observability, rollback и degraded mode.

### Agent D: UX / Product Planner

Запускается только для user-visible или operator-visible задач.

Проверяет, что увидит пользователь, какой observable result подтверждает успех, не получится ли "backend работает, UX выглядит сломанным", и какие статусы/бейджи/сообщения нужны сейчас.

## 3. Reviewers

Для `light` reviewer checks может выполнить main orchestrator. Для `full` reviewer checks выполняют отдельные reviewer agents; main orchestrator не подменяет их последовательным roleplay.

Исключение допустимо только если reviewer не применим к задаче:

- UX/Product reviewer пропускается для backend-only задач без user/operator-visible результата;
- Project DoD reviewer все равно проверяет проектные gates, даже если изменений кода пока нет;
- Evidence + Contract reviewer обязателен всегда.

### Reviewer 1: YAGNI + Scope

Удаляет лишние поля, таблицы, endpoints, расширенный payload, premature abstraction и дублирование source of truth.

### Reviewer 2: Evidence + Contract

Блокирующий reviewer. Проверяет:

- где факт, а где assumption;
- есть ли evidence на файлы, команды, docs или upstream behavior;
- source of truth;
- API/schema/I/O contract;
- idempotency, compatibility и failure semantics;
- proof-команды, которые должны попасть в финальный план.

Assumptions допустимы только для неблокирующих деталей. Для provider/quota/pricing/limits/auth/model behavior/wire protocol claims нужен `External Provider Evidence`: официальный или primary source с URL/path, датой проверки, версией/endpoint/model где применимо. Third-party evidence может дополнять, но не заменяет primary source. Если current primary evidence недоступен, план должен быть `blocked` или содержать explicit blocking question, а не уверенное утверждение.

Final plan для upstream/provider/wire claims должен содержать `Evidence Register`:

| Claim | Source URL/path | Date checked | Version/endpoint/model | Exact evidence used |
| --- | --- | --- | --- | --- |

### Reviewer 3: Project DoD

Блокирующий reviewer. Проверяет обязательные проектные проверки и добавляет их в финальный plan.

Для OpenWhispr учитывай Node 24 из `.nvmrc`, focused `node --test test/...`, `npm run lint`, `npm run typecheck`, `npm run i18n:check`, `npm run build:renderer` when relevant, and platform/native checks for Electron sidecars when touched.

Blocking DoD matrix:

| Change type | Required in final plan |
| --- | --- |
| Electron main/preload/IPC contract | preload bridge compatibility, IPC handler tests/manual checks, renderer failure behavior |
| Renderer UX/i18n | locale keys for all supported languages, `npm run i18n:check`, observable UX result |
| Public API/external payload/webhook | contract compatibility, request/response docs/tests, negative cases |
| DB/schema/vector index/local storage | migration/backward compatibility, focused database tests, data-loss negative cases |
| Native sidecar/bundled binary | build/download script wiring, sidecar registry/pid cleanup, platform-specific fallback |
| Provider/quota/pricing/limits/auth/wire protocol | External Provider Evidence, headers/body/stream contract, failure semantics |
| Relay/network/egress/header transparency | proof of exact network/header behavior, negative case proving the old failure is caught |
| Scheduler/sync/session state/async status | source of truth, idempotency, observable marker, retry/failure semantics |

## 4. Council Synthesis

Main orchestrator не пересказывает мнения. Он выбирает или синтезирует решение.

Обязательные шаги:

1. Нормализовать assumptions.
2. Найти общие constraints.
3. Выделить несовместимые tradeoffs.
4. Выбрать или объединить подходы.
5. Указать, почему rejected alternatives проиграли.
6. Проверить, что выбранный план не добавляет поля/API/таблицы "на прозапас".

Scorecard:

```text
- Existing system reuse: 0-5
- Smallest current scope: 0-5
- Future-safe without overengineering: 0-5
- Source of truth clarity: 0-5
- Contract clarity: 0-5
- Proof quality: 0-5
- Operational risk: 0-5
- Reversibility: 0-5
- User-visible correctness: 0-5
```

Council must produce a score table for the chosen approach and rejected alternatives. For high-risk tasks, `Source of truth clarity`, `Contract clarity`, and `Proof quality` must each be at least 4/5; otherwise the plan is blocked or must explain the exact evidence/checks needed before implementation.

Правила выбора:

- Более сложный план может победить минимальный только если есть конкретный факт, что минимальный план не закрывает текущую задачу.
- План с худшей proof quality не может победить без явного объяснения, какие проверки закроют пробел.
- Reuse выигрывает у нового кода, если закрывает текущий контракт без недопустимого риска.
- При близкой scorecard-оценке побеждает меньший scope, больше reuse и более проверяемый proof plan.
- План без проверяемого proof plan не может победить для high-risk задач.

## 5. Final Plan UX

Пользователь видит итоговый synthesis, не весь внутренний шум.

Начинай с recommended approach:

- цель;
- выбранный подход;
- почему он победил по rubric;
- rejected alternatives;
- Reuse Lookup Log;
- source of truth;
- non-goals / what we will not do;
- minimal contract;
- implementation slices;
- failure semantics;
- UX observable result, если применимо;
- proof plan;
- Evidence Register для upstream/provider/wire claims;
- project-specific DoD;
- assumptions/open questions.

После пользовательского утверждения orchestrator сохраняет этот synthesis в `plans/<task-slug>.md`. Runtime trace дополнительно сохраняется в `.ai-loop/runs/<planning-run-id>/planning/synthesis/final-plan.md`.

Proof plan должен быть матрицей, а не списком команд:

| Claim | Exact assertion | Command/test/manual check | Fixture/input | Negative case | Failure mode caught |
| --- | --- | --- | --- | --- | --- |

Для relay/provider/scheduler/sync/session-state задач хотя бы один proof должен доказывать именно критический риск, а не только routing/syntax/happy path.

Для async/status/scheduler/sync/session state задач добавь `Observable marker`: где пользователь/оператор увидит состояние, какой canonical source его вычисляет, почему marker не становится вторым source of truth.

Пиши кратко по умолчанию. Детали competing agents раскрывай только если они влияют на решение. `Reuse Lookup Log` не считается внутренним шумом: в final plan он всегда видим хотя бы как compact evidence summary с командами/поисками, проверенными файлами/helpers/configs/libraries, найденными candidates и rejected reuse candidates с фактами.

Если не хватает 1-2 ключевых constraints, спроси до full loop. Если неопределенность не блокирует выбор, явно пометь assumption и включи проверку в proof plan.

## 6. Delta Review

Если пользователь правит финальный план, полный loop не повторяется автоматически.

Delta Review:

- определить, какие части плана изменились;
- всегда diff'ить source of truth, contracts, proof gates, UX observable result, external evidence, DB/API/generated-docs impact;
- перед code-mode правками проверить freshness approved plan по тем же полям; если что-то изменилось, выполнить Delta Review или остановиться;
- прогнать только затронутые planner/reviewer роли;
- почти всегда включать YAGNI + Evidence;
- включать Contract/DoD при изменении API/DB/deployment/UX;
- повторить full loop, если меняется основной подход, source of truth, public/external contract, DB/API/generated docs, provider evidence или critical proof gate;
- `Delta Review skipped` допустим только если нет изменений в plan/code/config/docs/prompts/generated artifacts и пользователь не менял требования.

## 6.1 Planning -> Programming Handoff

После утверждения плана Planning Loop обязан подготовить handoff:

1. Сохранить canonical approved plan в `plans/<task-slug>.md`.
2. Сохранить путь к нему в `.ai-loop/runs/<planning-run-id>/handoff/approved-plan-path.txt`.
3. Сохранить стартовый prompt в `.ai-loop/runs/<planning-run-id>/handoff/programming-start-prompt.md`.
4. Если runtime умеет создавать clean session/thread в том же workspace, создать новую session и отправить туда минимальный prompt.
5. Если runtime не умеет создавать clean session/thread, остановиться и показать человеку handoff prompt. Нельзя начинать implementation в загрязненном planning context.

### Codex plan-button approval event

Codex UI кнопка "Implement plan" может прислать агенту обычное сообщение:

```text
PLEASE IMPLEMENT THIS PLAN:
<approved plan text>
```

Такое сообщение считается пользовательским утверждением плана через UI, а не командой начинать реализацию из текста чата.

Обязательный порядок:

1. Извлечь approved plan text после `PLEASE IMPLEMENT THIS PLAN:`.
2. Сохранить его как canonical artifact в `plans/<task-slug>.md`.
3. Создать handoff artifacts: `approved-plan-path.txt` и `programming-start-prompt.md`.
4. Запустить Programming Loop preflight по `docs/agent-programming-loop.md`.
5. Если clean session/thread доступна и видит тот же checkout, отправить туда только минимальный handoff prompt.
6. Если clean session/thread создается в отдельном worktree, сначала убедиться, что `plans/<task-slug>.md` и нужный `.ai-loop/runs/<planning-run-id>/handoff/` доступны в этом worktree; иначе остановиться и показать handoff prompt человеку.
7. Не начинать implementation в текущем planning thread.

Минимальный handoff prompt:

```text
Запусти Programming Loop по plans/<task-slug>.md
```

Если есть planning trace, добавь второй строкой:

```text
Planning trace: .ai-loop/runs/<planning-run-id>
```

Programming Loop при старте копирует approved plan в `input/approved-plan.md` своего run и фиксирует:

```json
{
  "loop_type": "programming",
  "approved_plan_path": "plans/<task-slug>.md",
  "source_planning_run": ".ai-loop/runs/<planning-run-id>"
}
```

## 7. Acceptance And Dry Runs

Planning Loop считается рабочим, если выполняются критерии:

- `light` и `full` планы содержат competing approaches, выбранный подход и rejected alternatives.
- Финальный выбор ссылается на факты и rubric, а не на "кажется лучше".
- High-risk задачи содержат proof plan, failure semantics и rollback/reversibility.
- План не предлагает менять исходники библиотек/зависимостей без явного approval.
- UX-visible задачи содержат expected observable result.
- DB/API задачи содержат project-specific generated docs/tests gates.
- `lightweight` задачи не читают full protocol и не запускают council.
- Если full нужен, но subagents недоступны, агент останавливается с `blocked-no-subagents`.
- Planning Loop protocol changes update both mirrored docs and pass mirror-sync verification.
- Approved handoff pass: `plans/<task-slug>.md` существует, planning run содержит `handoff/approved-plan-path.txt` и `handoff/programming-start-prompt.md`, а Programming Loop стартует в clean session или runtime fail-closed показывает prompt человеку.
- Programming Loop runtime pass: если run содержит `fixes.md`, после него есть более поздний full QA `iterations/<N>/result.json`; `final/verdict.json.source_iteration` указывает на последний passing QA; `manifest.json.status`, `state.json.status` и final verdict согласованы.

Минимальная dry-run матрица:

| Prompt | Expected |
| --- | --- |
| "Переименуй локальную переменную" | `lightweight`, no full docs, no subagents |
| "Спланируй миграцию auth" | `full`, subagents, alternatives, non-goals, proof plan, DoD |
| "Не используй subagents, но спланируй DB/API изменение" | `blocked-no-subagents` |
| "Что за план на сегодня?" | no full protocol unless technical planning intent is clear |
| "Сделай UX-visible статус автосессий" | `full` by default; `light` only for purely local UI label with proven existing source of truth |
| "Backend-only infra relay change" | Ops included, UX skipped unless operator-visible |
| "После правки плана убери поле X" | Delta Review only for affected scope |
| "Спланируй scheduler/sync/session-state workflow" | `full` by default; `light` only for explicitly local fix with proven single source of truth |
| "Спланируй relay egress/header transparency" | `full`, proof matrix catches exact egress/header behavior and negative case |
| "Спланируй provider/quota без official evidence" | `full` then blocked or explicit blocking question until External Provider Evidence exists |
| "Добавь session marker" | `full` unless purely local UI label; plan proves marker is not second source of truth |

Dry-run verification contract:

- `lightweight` pass: transcript содержит gate `lightweight`; нет чтения `docs/agent-planning-loop.md`; нет spawn/send/wait subagent tool calls; ответ короткий.
- `light` pass: transcript содержит gate `light`; нет чтения `docs/agent-planning-loop.md`; есть минимум 2 competing approaches, выбранный подход, rejected alternative и proof plan.
- `full` pass: transcript содержит gate `full`; после gate есть чтение `docs/agent-planning-loop.md`; есть отдельные subagent/agent-thread calls для planners и reviewer agents; final plan содержит synthesis, а не только список мнений.
- `blocked-no-subagents` pass: transcript содержит gate `blocked-no-subagents`; нет roleplay planners/reviewers; агент останавливается и объясняет, что full loop требует независимых agents/subagents.
- repo-native artifact pass: successful `light`/`full` planning создает или называет `plans/...` artifact с итоговым synthesis; `blocked-no-subagents` не создает plan-файл.
- Delta Review pass: transcript называет changed scope, затронутые roles/checks и impact; full loop повторяется при смене основного подхода, source of truth, public/external contract, DB/API/generated docs, provider evidence или critical proof gate.
