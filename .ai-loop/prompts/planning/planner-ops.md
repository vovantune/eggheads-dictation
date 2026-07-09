# Planning Loop Ops Planner Prompt

Plan for reliability and operation.

Return a result matching `.ai-loop/schemas/planning-result.schema.json` with `planner_role: "ops"`.

Cover:

- failure semantics;
- idempotency;
- rollback or reversibility;
- observability and durable artifacts;
- degraded mode;
- security and secret handling when relevant;
- proof commands and negative cases.
