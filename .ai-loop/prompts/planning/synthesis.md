# Planning Loop Synthesis Prompt

Use the gate from `.ai-loop/gate-policy.json`.

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

For `gate: "light"`, do not run council synthesis. Return only a compact single-agent result in chat plus optional non-persisted JSON with:

- `recommended_approach`;
- `source_of_truth`;
- 1–5 `implementation_slices`;
- 1–3 focused `proof_plan` checks;
- rollback or reversibility in the human-readable result.

Do not require rejected alternatives, Reuse Lookup Log, full project DoD, `.ai-loop/runs`, `plans/...`, approval, or handoff for `light`.

For `gate: "lightweight"`, answer or implement directly. If JSON is useful, return only `recommended_approach`; do not invent full-loop fields.

For `gate: "full"` and `status: "draft"`, include the full plan fields but do not include `handoff`.

For `status: "blocked"`, include `block_reason`; do not invent full plan fields or `handoff`.

Use `status: "approved"` with `handoff` only for `gate: "full"`, after the user approves the plan and the approved plan is saved to `plans/<task-slug>.md`.
