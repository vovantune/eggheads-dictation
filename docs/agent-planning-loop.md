# XP Planning Loop

Этот документ описывает repo-native протокол планирования для задач, где важно получить не первую приличную идею, а выбранный synthesis после сравнения альтернатив по фактам, ограничениям и Definition of Done.

Это не skill. Перед классификацией прочитай только `.ai-loop/gate-policy.json`; `.ai-loop/gate-cases.json` — regression fixture. Этот full-loop reference после раздела Gate читается только для Planning `full`.

Full XP Planning Loop обязателен только при доступных независимых agents/subagents/agent threads. Во всех рабочих средах проекта multiagent должен быть доступен. Если агент не может запустить независимых агентов, он обязан остановиться и сообщить пользователю, что full loop выполнить нельзя. Последовательное исполнение ролей одним агентом не является допустимым full loop и не должно маскироваться под независимое ревью.

Этот файл сохраняет project-specific OpenWhispr DoD. Portable core синхронизируется byte-identical между development-agent repositories; локальные integration boundaries определяются `CLAUDE.md`.

Full Planning Loop использует общий `.ai-loop` runtime contract вместе с Programming Loop. Для `full` чатовая история не является source of truth: долговременные решения, JSON-результаты, approved plan и handoff сохраняются в `.ai-loop/runs/<planning-run-id>/` и `plans/<task-slug>.md`. `lightweight` и `light` не создают эти artifacts.

## 0. Adaptive Gate v3

Gate v3 классифицирует доказанные фактические effects, а не ключевые слова, имя файла, репозитория или количество строк. Перед планированием и реализацией независимо выбери:

```text
Planning: lightweight | light | full
Programming: direct | light | guarded | full
Proof: static | focused | contract | release
Explicit loop request: yes|no — ordinary|Programming Loop|light Programming Loop|full Programming Loop
Scope: owner; source_of_truth; in_scope; out_of_scope; direct_consumers; rollback
Hard effects: present|absent|unknown — ...
Bounded change: yes|no|unknown — ...
Independence need: none|independent_review|separation_of_duties|full_independent_cycle
Resolved full planning to local fix: yes|no
Risk groups: N/4 — design, reach, runtime, proof_rollback
Unknowns: ...
Why not full: ...   # обязательно для lightweight/light
```

Для `lightweight` decision остаётся компактно в чате. Programming `light` обязательно использует guard: transient `decision.json` и state лежат вне `.ai-loop/runs`. Для Programming `guarded/full` сохрани baseline как `input/decision.json`. Decision фиксирует profiles, admission decision/reason, scope hash, initial roles и фактические execution inputs; source of truth алгоритма остаётся только `.ai-loop/gate-policy.json`.

Planning profile выбирается в прежнем порядке:

1. Выполни bounded read-only discovery по репозиторию. Не повышай gate из-за слова `provider`, `auth`, `deployment`, `payload`, `session` или `UX`.
2. Если доказан material hard effect, boundary hard effect или после discovery остается возможный hard effect, выбери `full` либо задай blocking question.
3. Если доказаны все bounded-change facts и hard effects отсутствуют, gate не выше `light`.
4. Иначе считай только независимые risk groups. Коррелирующие опасения внутри одной группы считаются один раз.
5. Три или четыре независимые risk groups дают `full`; одна-две дают `light`; direct work без risk groups дает `lightweight`.

Programming profile выбирается независимо:

- `direct`: main реализует и проверяет, artifacts нет;
- `light`: main реализует, один стабильный independent reviewer делает initial review и максимум один recheck, persisted run отсутствует;
- `guarded`: один стабильный independent implementer и один стабильный independent reviewer используют compact run; тот же implementer исправляет, тот же reviewer перепроверяет;
- `full`: сохраняется существующий independent implementer/fixer/fresh full-QA flow.

Required Programming profile выводится из effects и `independence_need`: present/unresolved hard effect или `full_independent_cycle` требует `full`; `separation_of_duties` требует `guarded`; `independent_review` требует `light`; `none` допускает `direct`. Если full planning снял критическую неизвестность и оставил bounded local fix без present/unresolved hard effect, доступен `guarded`. Planning `full` сам по себе Programming `full` не форсирует.

Обычная просьба реализовать задачу не включает loop. Явный `Programming Loop` задаёт минимум `light`; `light Programming Loop` одновременно задаёт потолок `light`; `full Programming Loop` и `implement → full QA → fixes until pass` форсируют `full`. Потолок `light` проверяется до admission более высокого required profile: результат — `HUMAN_DECISION_REQUIRED`, reason `LIGHT_PROFILE_CEILING` и точный `proposed_programming_profile`, а не молчаливое повышение.

Proof profile:

- `static`: parse/syntax, readback, diff, wiring;
- `focused`: существующая focused-проверка или один test для названного непокрытого failure mode;
- `contract`: focused contract/integration check и применимый smoke;
- `release`: full suite и post-deploy/live proof для широкого rollout, deployment, сложной migration или mandatory project gate.

Full QA — независимая проверка существенных рисков и plan coverage, а не автоматический full suite.

### Hard effects

Material hard effects:

- изменение persisted-state semantics, destructive DDL/backfill либо schema/migration с material lock, cross-version, consumer, rollout или сложным rollback risk;
- изменение public/external API, payload, webhook, wire или backward-compatibility контракта;
- изменение executable auth/authz/security/privacy/secret enforcement;
- изменение billing, charging, quota accounting, balances, pricing или money semantics;
- реальный риск data loss, money loss, privacy leak или destructive operation.

Boundary hard effects:

- изменение provider routing/wire behavior/externally meaningful model identity;
- изменение deployment topology, production rollout или runtime ownership;
- coordinated cross-service/repository state change;
- rollback, требующий coordinated migration, rollout или state repair.

Локальные provider label/copy/docs/metadata/config сами по себе не являются hard effect, если routing, wire, model identity, accounting, auth и external/state contracts сохранены.

Имя DB/schema/migration/SQL/ORM файла само по себе не является hard effect. Additive nullable change без backfill, material lock, cross-version/consumer/rollout risk может оставаться `light/guarded/contract`; SQL/ORM bug с неизменными schema, payload и persisted semantics может оставаться `light/light/focused`.

### Bounded change

Bounded change доказан только когда одновременно верны все факты:

- один runtime owner;
- используется существующий source of truth;
- external и persisted-state contracts сохранены;
- security, accounting и provider routing сохранены;
- rollback локален, а focused proof ловит изменяемое поведение.

Bounded change не может перекрыть hard effect.

### Independent risk groups

- `design`: существенная неоднозначность решения, новая feature boundary или architecture decision;
- `reach`: user/operator workflow или multi-module reach шире локальной presentation-правки;
- `runtime`: performance/load/async/scheduler/sync/session-state/relay/degraded-runtime behavior;
- `proof_rollback`: критическое поведение трудно доказать локально или rollback не является прямым bounded revert.

Неизвестность не является дополнительной risk group. Сначала проверь evidence; unresolved possible hard effect означает blocking question или `full`.

### Lightweight

Используй `lightweight`, когда hard effects отсутствуют, работа прямая и независимых risk groups нет.

Для `lightweight` не читай full Planning protocol дальше, не запускай planning council и не создавай planning/plan/handoff artifacts. Дальнейшая реализация следует независимо выбранному Programming profile: обычный `direct` работает напрямую, а явный Programming Loop может потребовать одного reviewer.

### Light

Используй `light`, когда hard effects отсутствуют и доказан bounded change либо присутствуют одна-две независимые risk groups.

Требования:

- в чате кратко зафиксировать проверенные факты и выбранный подход;
- назвать focused proof и локальный rollback/reversibility;
- не запускать planning council/subagents;
- не создавать `.ai-loop/runs`, `plans/...`, approved-plan или handoff artifacts;
- не требовать отдельного approval сверх обычного пользовательского разрешения на изменение.

Для Planning `light` не читай документ дальше. Если Programming profile — `light` или `guarded`, продолжай по `docs/agent-programming-loop.md`.

### Full

Planning `full` обязателен при любом present/unresolved hard effect или при трех-четырех независимых risk groups, если bounded-change cap не доказан.

Для Planning `full` сначала прочитай весь этот документ, затем выполни полноценный multiagent loop. Planning `full` не форсирует Programming `full`: доказанно bounded implementation может быть `guarded`.

### Blocked: No Subagents

Если Planning `full` уже выбран, но независимые agents/subagents недоступны, не выполняй single-agent simulation.

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
  gate-policy.json
  gate-cases.json
  schemas/
  prompts/
```

Ignored runtime artifacts:

```text
.ai-loop/runs/
```

Full Planning run layout:

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

`full` Planning Loop не считается завершенным, пока пользователь не утвердил итоговый synthesis и approved plan не сохранен в `plans/<task-slug>.md`. Для `lightweight/light` отдельное утверждение, artifact и handoff не требуются.

## 0.2 JSON Validation

В `full` orchestrator валидирует все обязательные JSON-артефакты по schemas из `.ai-loop/config.yml`. Новые persisted runs используют `loop-state.schema.json` v2; завершённые v1 artifacts остаются historical read-only и не мигрируются:

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

Применимые роли для full loop:

### Agent A: Reuse / No-code Planner

Запускается при существующем аналоге или старом механизме.

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

Запускается всегда.

Мандат: simplest thing that could possibly work.

Проверяет минимальный API, минимальную таблицу, минимальный payload, non-goals, YAGNI и отсутствие future-proof мусора.

Для каждого нового поля/API/флага обязан ответить:

```text
Что сломается в текущей задаче, если этого не будет сейчас?
```

### Agent C: Robust / Ops Planner

Запускается для deployment, runtime или data migration.

Мандат: эксплуатация и надежность.

Проверяет retry, idempotency, failure semantics, нагрузку, безопасность, observability, rollback и degraded mode.

### Agent D: UX / Product Planner

Запускается только для user-visible или operator-visible задач.

Проверяет, что увидит пользователь, какой observable result подтверждает успех, не получится ли "backend работает, UX выглядит сломанным", и какие статусы/бейджи/сообщения нужны сейчас.

## 3. Reviewers

Для `full` reviewer checks выполняют отдельные reviewer agents; main orchestrator не подменяет их последовательным roleplay. `light` не входит в reviewer/council protocol и ограничивается compact chat proof из Gate.

YAGNI/Scope, Evidence/Contract и Project DoD reviewers запускаются всегда. Каждая применимая planner/reviewer role получает один initial pass и максимум один targeted rerun после invalidating plan change. Второй rerun, новая role или restart требуют `HUMAN_DECISION_REQUIRED`.

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

## 5. Full Final Plan UX

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

Если пользователь правит approved `full` plan, полный loop не повторяется автоматически. Для chat-only `lightweight/light` заново вычисли три профиля Gate v3; Delta Review artifact не нужен.

Delta Review:

- определить, какие части плана изменились;
- всегда diff'ить source of truth, contracts, proof gates, UX observable result, external evidence, DB/API/generated-docs impact;
- перед code-mode правками проверить freshness approved plan по тем же полям; если что-то изменилось, выполнить Delta Review или остановиться;
- прогнать только затронутые planner/reviewer роли;
- почти всегда включать YAGNI + Evidence;
- включать Contract/DoD при изменении API/DB/deployment/UX;
- повторить full loop, если меняется основной подход, owner, material effect или critical proof gate;
- соблюдать budget: одна targeted rerun на затронутую роль; следующий rerun, новая роль или restart требуют `HUMAN_DECISION_REQUIRED`;
- `Delta Review skipped` допустим только если нет изменений в plan/code/config/docs/prompts/generated artifacts и пользователь не менял требования.

## 6.1 Planning -> Programming Handoff

После утверждения `full` плана Planning Loop обязан подготовить handoff. `light` и `lightweight` не используют этот раздел:

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

Для `full` такое сообщение считается пользовательским утверждением плана через UI, а не командой начинать реализацию из текста чата. Для `light` отдельный handoff не создается.

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

- Gate классифицирует effects по `.ai-loop/gate-policy.json`, а `.ai-loop/gate-cases.json` проходит как regression-матрица.
- Planning `light` содержит compact approach, proof и rollback в чате без planning council, persisted planning run, approved-plan artifact или handoff.
- `full` планы содержат competing approaches, выбранный подход и rejected alternatives.
- Финальный выбор ссылается на факты и rubric, а не на "кажется лучше".
- High-risk задачи содержат proof plan, failure semantics и rollback/reversibility.
- План не предлагает менять исходники библиотек/зависимостей без явного approval.
- UX-visible задачи содержат expected observable result.
- DB/API задачи содержат project-specific generated docs/tests gates.
- `lightweight` задачи не читают full protocol и не запускают council.
- Gate фиксирует все три profiles; explicit Programming Loop для простой задачи даёт Programming `light`, а Planning `full` не форсирует Programming `full`.
- Каждая applicable full-planning role имеет один initial pass и максимум один targeted rerun. Оба pass записываются как ordered `activity.type=planning` с `role` и `pass=initial|rerun`; guard выводит budget из activity, поэтому CLI-флаг или сброс counter не может открыть дополнительный запуск.
- Check Map запрещает duplicate check того же snapshot и full suite ниже `release`, кроме mandatory project gate.
- Если full нужен, но subagents недоступны, агент останавливается с `blocked-no-subagents`.
- Portable core остаётся byte-identical во всех repositories; локальные docs и project rules сохраняют OpenWhispr DoD.
- Approved full handoff pass: `plans/<task-slug>.md` существует, planning run содержит `handoff/approved-plan-path.txt` и `handoff/programming-start-prompt.md`, а Programming Loop стартует в clean session или runtime fail-closed показывает prompt человеку.
- Programming Loop runtime pass: если run содержит `fixes.md`, после него есть более поздний full QA `iterations/<N>/result.json`; latest QA event overall имеет `verdict: "pass"`, final ссылается именно на него, а после него нет implementation/fix/non-pass QA; `manifest.json.status`, `state.json.status` и final verdict согласованы.

Минимальная dry-run матрица:

| Prompt | Expected profiles |
| --- | --- |
| Docs typo | `lightweight/direct/static` |
| Простая задача с явным Programming Loop | `lightweight|light / light / static|focused` |
| PHP controller или SQL/ORM bug без contract change | `light/light/focused` |
| Additive nullable column без backfill/lock/consumer risk | `light/guarded/contract` |
| Bounded Sentry env-wrapper | `light/guarded/contract` |
| Provider label/copy | `lightweight/direct/static` |
| Provider selection/failover/model identity | `full/full/contract|release` |
| Rename/drop/backfill/multi-service migration | `full/full/release` |
| Глубокое исследование с локальным fix | `full/guarded/focused|contract` |
| RC deploy/широкий rollout | `full/full/release` |
| "Не используй subagents, но спланируй DB/API изменение" | Planning outcome `blocked-no-subagents` |

Dry-run verification contract:

- Planning `lightweight` pass: нет planning council/artifacts; Programming `direct` не создаёт subagents, Programming `light` использует ровно одного reviewer.
- Planning `light` pass: нет planning council, planning run, `plans/...` или handoff; Programming `light/guarded` следует отдельному protocol.
- `full` pass: transcript содержит gate `full`; после gate есть чтение `docs/agent-planning-loop.md`; есть отдельные subagent/agent-thread calls для planners и reviewer agents; final plan содержит synthesis, а не только список мнений.
- `blocked-no-subagents` pass: transcript содержит gate `blocked-no-subagents`; нет roleplay planners/reviewers; агент останавливается и объясняет, что full loop требует независимых agents/subagents.
- OpenWhispr planning pass: successful `full` planning создаёт или называет `plans/...` artifact; `lightweight/light` остаются chat-only.
- Delta Review pass: transcript называет changed scope, затронутые roles/checks и impact; full loop повторяется при смене подхода, owner, material effect или critical proof gate.
