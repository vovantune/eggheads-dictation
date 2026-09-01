# Planning Loop Delta Review Prompt

Run Delta Review after the user changes an approved `full` plan or its implementation inputs change. For chat-only `lightweight/light`, recompute the v3 three-axis decision instead of creating Delta Review artifacts.

Compare the previous approved plan with the new request or diff.

Always check impact on:

- source of truth;
- contracts;
- proof gates;
- UX observable result;
- external evidence;
- DB, API, and generated-docs impact.
- selected Programming and Proof profiles;
- scope capsule, role budget, and Check Map invalidation.

Return whether the existing plan remains fresh, needs targeted reviewer/planner reruns, or justifies recommending a full Planning Loop rerun.
Rerun only affected roles within their one targeted-rerun budget. A changed approach, owner, material effect, or critical proof gate may justify full planning, but a new full run still requires explicit current-dialog user opt-in; ordinary text changes do not.
