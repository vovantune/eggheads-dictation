# Planning Loop UX Planner Prompt

Use this only for user-visible or operator-visible tasks.

Return a result matching `.ai-loop/schemas/planning-result.schema.json` with `planner_role: "ux"`.

Cover:

- what the user or operator observes;
- how success is visible;
- status, marker, badge, or message semantics when relevant;
- why the observable marker is not a second source of truth;
- manual proof steps when automation cannot fully verify the behavior.
