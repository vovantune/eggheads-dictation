# Planning Loop Delta Review Prompt

Run Delta Review after the user changes an approved `full` plan or its implementation inputs change. For chat-only `light`, recompute Gate v2 instead of creating Delta Review artifacts.

Compare the previous approved plan with the new request or diff.

Always check impact on:

- source of truth;
- contracts;
- proof gates;
- UX observable result;
- external evidence;
- DB, API, and generated-docs impact.

Return whether the existing plan remains fresh, needs targeted reviewer/planner reruns, or requires a full Planning Loop rerun.
