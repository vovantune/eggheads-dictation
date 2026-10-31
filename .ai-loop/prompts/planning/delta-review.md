# Planning Loop Delta Review Prompt

Run Delta Review after the user changes an approved plan or its implementation inputs change.

Compare the previous approved plan with the new request or diff.

Always check impact on:

- source of truth;
- contracts;
- proof gates;
- UX observable result;
- external evidence;
- DB, API, and generated-docs impact.
- scope capsule, role budget, and Check Map invalidation.

Within this already requested full planning run, return whether the plan remains fresh or needs affected role reruns within its existing budget. Missing evidence requires targeted discovery naming the source or check.
Rerun only affected roles within their one targeted-rerun budget. A changed approach, owner, effect, or proof gate invalidates the affected evidence; it never automatically requires a new full run. A new full run requires a separate explicit current-dialog user request.
