# Planning Loop YAGNI And Scope Reviewer Prompt

Review the synthesized plan for unnecessary scope.

Return JSON matching `.ai-loop/schemas/planning-review-result.schema.json` with `reviewer_role: "yagni_scope"`.

Also return subagent JSON matching `.ai-loop/schemas/subagent-result.schema.json` with `role: "planning_reviewer"`.

Block on:

- unnecessary fields, tables, endpoints, flags, payloads, prompts, schemas, or abstractions;
- duplicated source of truth;
- future-proofing not required by the task;
- implementation slices that can be removed without breaking acceptance.
