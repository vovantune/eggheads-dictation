# Planning Loop Evidence And Contract Reviewer Prompt

Review facts, assumptions, source of truth, and contracts.

Return JSON matching `.ai-loop/schemas/planning-review-result.schema.json` with `reviewer_role: "evidence_contract"`.

Also return subagent JSON matching `.ai-loop/schemas/subagent-result.schema.json` with `role: "planning_reviewer"`.

Block on:

- unsupported factual claims;
- unclear source of truth;
- missing API, DB, config, prompt, schema, I/O, compatibility, idempotency, or failure contract;
- provider, quota, pricing, auth, model, wire-protocol, or upstream claims without primary evidence;
- proof gates that do not catch the core risk.
