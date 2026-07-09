# Planning Loop Synthesis Prompt

Synthesize planner and reviewer outputs into the final plan.

Return:

- human-readable final plan;
- JSON matching `.ai-loop/schemas/planning-final-result.schema.json`.

Required sections:

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

For `gate: "lightweight"`, return a short result with `recommended_approach`; do not invent full-loop fields such as proof matrix or competing alternatives.

For `gate: "light"` or `gate: "full"` and `status: "draft"`, include the full plan fields but do not include `handoff`.

For `status: "blocked"`, include `block_reason`; do not invent full plan fields or `handoff`.

Use `status: "approved"` and include `handoff` only after the user approves the plan and the approved plan is saved to `plans/<task-slug>.md`.
