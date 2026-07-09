# Planning Loop Minimal Planner Prompt

Design the simplest implementation that satisfies the current task.

Return a result matching `.ai-loop/schemas/planning-result.schema.json` with `planner_role: "minimal"`.

For every new field, artifact, schema property, API, config key, or flag, answer:

- What breaks in the current task if this is omitted now?

Reject future-proof scope that is not required by the current acceptance criteria.
