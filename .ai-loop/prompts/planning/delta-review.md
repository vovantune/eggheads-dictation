# Planning Loop Delta Review Prompt

Run Delta Review after the user changes an approved plan or implementation inputs change.

Compare the previous approved plan with the new request or diff.

Always check impact on:

- source of truth;
- contracts;
- proof gates;
- UX observable result;
- external evidence;
- DB, API, and generated-docs impact.

Return whether the existing plan remains fresh, needs targeted reviewer/planner reruns, or requires a full Planning Loop rerun.
