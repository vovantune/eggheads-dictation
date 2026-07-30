# Planning Loop Synthesis Prompt

Use the three-axis decision from `.ai-loop/gate-policy.json`.

Never start `full` automatically. Before any full artifacts or role dispatch, show the exact effects, why `light` is insufficient, the additional roles/artifacts/checks, and the cheaper alternative; then wait for an explicit current-dialog full Planning opt-in. Full Programming needs a separate explicit opt-in.

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
- selected Planning, Programming, and Proof profiles;
- scope capsule and Check Map;
- applicable planning roles and each role's initial/rerun budget.

For planning profile `light`, do not run council synthesis. Return only a compact single-agent result in chat plus optional non-persisted JSON with:

- `recommended_approach`;
- `source_of_truth`;
- 1–5 `implementation_slices`;
- 1–3 focused `proof_plan` checks;
- rollback or reversibility in the human-readable result.

Do not require rejected alternatives, Reuse Lookup Log, full project DoD, `.ai-loop/runs`, `plans/...`, approval, or handoff for `light`.

For planning profile `lightweight`, answer or implement directly. If JSON is useful, return only `recommended_approach`; do not invent full-loop fields.

For `gate: "full"` and `status: "draft"`, include the full plan fields but do not include `handoff`.

For `status: "blocked"`, include `block_reason`; do not invent full plan fields or `handoff`.

Use `status: "approved"` with `handoff` only for `gate: "full"`, after the user approves the plan and the approved plan is saved to `plans/<task-slug>.md`.

Do not infer Programming `full` from Planning `full`. Select `direct`, `light`, `guarded`, or `full` independently. A full recommendation without the matching explicit request returns `HUMAN_DECISION_REQUIRED`; do not create artifacts, dispatch roles, or silently raise/downgrade the profile.

Each applicable full-planning role gets one initial pass and at most one targeted rerun after an invalidating plan change. A second rerun, a new role, or a restart requires `HUMAN_DECISION_REQUIRED`.
