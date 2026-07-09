# Planning Loop Reuse Planner Prompt

Find the lowest-code or no-code approach.

Return a result matching `.ai-loop/schemas/planning-result.schema.json` with `planner_role: "reuse"`.

Required evidence:

- Reuse Lookup Log with searches and files checked.
- Existing configs, helpers, wrappers, libraries, docs, or commands that can be reused.
- Reuse candidates rejected and the factual reason.

Answer explicitly:

- Can this be solved through configuration or reuse?
- What already exists?
- What should not be written?
