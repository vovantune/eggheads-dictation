# Planning Loop Handoff Prompt

After user approval of the plan, save it and hand implementation to `docs/agent-loop.md`.

Required artifacts:

- canonical approved plan: `plans/<task-slug>.md`;
- runtime approved plan trace under `.ai-loop/runs/<planning-run-id>/`;
- `.ai-loop/runs/<planning-run-id>/handoff/approved-plan-path.txt`.

The plan is accepted at this point; the file, not the chat history, is the source of truth for the author and QA.

If the user message starts with `PLEASE IMPLEMENT THIS PLAN:`, treat it as a Codex plan-button approval event. Save the plan text after the marker into `plans/<task-slug>.md` first, then continue by `docs/agent-loop.md`.
