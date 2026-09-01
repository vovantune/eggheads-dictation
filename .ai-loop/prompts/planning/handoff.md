# Planning Loop Handoff Prompt

After user approval of a `full` plan, save the approved plan and prepare Programming Loop handoff. `light` and `lightweight` never use this prompt.

Required artifacts:

- canonical approved plan: `plans/<task-slug>.md`;
- runtime approved plan trace under `.ai-loop/runs/<planning-run-id>/`;
- `.ai-loop/runs/<planning-run-id>/handoff/approved-plan-path.txt`;
- `.ai-loop/runs/<planning-run-id>/handoff/programming-start-prompt.md`.

The Programming Loop start prompt must be minimal:

```text
Запусти Programming Loop по plans/<task-slug>.md
```

Append the planning run path when available.

If the user message starts with `PLEASE IMPLEMENT THIS PLAN:`, treat it as a Codex plan-button approval event. Save the plan text after the marker into `plans/<task-slug>.md`, write the handoff artifacts, and do not begin implementation in the current planning thread.

Create a clean session only when it can read the same checkout, approved plan, and handoff trace. For a separate worktree, explicitly copy both artifacts and verify that the target paths are readable before sending the prompt. Otherwise stop and show the exact handoff prompt instead of starting implementation in the planning context.
