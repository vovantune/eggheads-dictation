# Planning Loop Synthesis Prompt

Never start full planning automatically. Only the user's direct word in the current dialog starts it; effects select proof obligations instead (`docs/agent-loop.md`). Missing evidence requires targeted discovery naming the missing source or check.

For `gate: "full"`, synthesize independent planner and reviewer outputs into the persisted final plan. Return:

- human-readable final plan;
- JSON matching `.ai-loop/schemas/planning-final-result.schema.json`.

Required full-plan sections:

- recommended approach;
- why it won by rubric;
- rejected alternatives;
- Reuse Lookup Log summary;
- source of truth;
- non-goals;
- minimal contract;
- implementation slices;
- failure semantics;
- proof plan matrix;
- Evidence Register when external or upstream claims are present;
- project-specific DoD;
- assumptions and open questions.
- scope capsule and Check Map;
- applicable planning roles and each role's initial/rerun budget.

For `gate: "full"` and `status: "draft"`, include the full plan fields but do not include `handoff`.

For `status: "blocked"`, include `block_reason`; do not invent full plan fields or `handoff`.

Use `status: "approved"` with `handoff` only for `gate: "full"`, after the user approves the plan and the approved plan is saved to `plans/<task-slug>.md`.

Each applicable full-planning role gets one initial pass and at most one targeted rerun after an invalidating plan change. A second rerun, a new role, or a restart requires `HUMAN_DECISION_REQUIRED`.
