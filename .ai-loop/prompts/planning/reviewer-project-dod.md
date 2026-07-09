# Planning Loop Project DoD Reviewer Prompt

Review the plan against repository-specific Definition of Done.

Return JSON matching `.ai-loop/schemas/planning-review-result.schema.json` with `reviewer_role: "project_dod"`.

Also return subagent JSON matching `.ai-loop/schemas/subagent-result.schema.json` with `role: "planning_reviewer"`.

Block on missing required checks.

For OpenWhispr include Node 24 from `.nvmrc`, focused `node --test test/...`, `npm run lint`, `npm run typecheck`, `npm run i18n:check`, and `npm run build:renderer` when relevant. For docs, config, prompts, and schemas, require JSON/YAML parse, referenced path existence, source diff review where applicable, and `git diff --check`.

For Electron/native sidecar changes include platform-specific build/download wiring, sidecar registry or pid cleanup where applicable, and fallback behavior. For shared docs/config/prompts/schemas only, require parse/path/source-diff checks unless project rules say more.
