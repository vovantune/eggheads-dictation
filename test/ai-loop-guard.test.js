import assert from "node:assert/strict";
import test from "node:test";
import {
  activity,
  approvedScope,
  assertOutcome,
  bindDecision,
  decisionFixture,
  expectedCase,
  invoke,
  stateFixture,
} from "./ai_loop_guard_fixtures.mjs";

test("guard binds state to decision profiles, scope, hash, and initial role chain", () => {
  const state = stateFixture("guarded");
  assertOutcome(invoke(state, ["--action", "validate-state"]), {
    exit: 0, decision: "ALLOW", reason_code: "ALLOW",
  });

  state.scope = approvedScope({in_scope: [".ai-loop", "AGENTS.md"]});
  assertOutcome(
    invoke(state, ["--action", "validate-state"]),
    expectedCase("scope-or-profile-drift-from-decision"),
  );

  const changed = stateFixture("guarded");
  changed.role_assignments.changes = [{
    role: "implementer",
    from: "impl-a",
    to: "impl-b",
    reason: "approved replacement",
    changed_at: "2026-07-29T01:00:00Z",
  }];
  changed.role_assignments.implementer = "impl-b";
  assert.equal(invoke(changed, [
    "--action", "dispatch-role", "--role", "implementer", "--actor-id", "impl-b", "--iteration", "1",
  ]).status, 0);
  changed.role_assignments.changes[0].from = "self-issued-other";
  const broken = invoke(changed, ["--action", "validate-state"]);
  assert.equal(broken.status, 1);
  assert.equal(broken.json.reason_code, "INVALID_STATE");
});

test("guard allows assigned roles and rejects identity or profile drift", () => {
  const state = stateFixture("guarded");
  assert.equal(invoke(state, [
    "--action", "dispatch-role", "--role", "implementer", "--actor-id", "impl-a", "--iteration", "1",
  ]).status, 0);
  assertOutcome(
    invoke(state, ["--action", "dispatch-role", "--role", "reviewer", "--actor-id", "review-b", "--iteration", "1"]),
    expectedCase("stable-guarded-pair"),
  );
  const forbidden = invoke(state, [
    "--action", "dispatch-role", "--role", "fixer", "--actor-id", "fix-a", "--iteration", "1",
  ]);
  assert.equal(forbidden.status, 2);
  assert.equal(forbidden.json.reason_code, "ROLE_FORBIDDEN_FOR_PROFILE");
  assert.equal(invoke(stateFixture("full"), [
    "--action", "dispatch-role", "--role", "fixer", "--actor-id", "fix-a", "--iteration", "1",
  ]).status, 0);
});

test("full planning and programming require separate explicit opt-ins", () => {
  const planningDecision = decisionFixture("guarded", {
    planning_profile: "full",
    explicit_loop_request: "programming-loop",
  });
  const planningState = bindDecision(stateFixture("guarded"), planningDecision);
  planningState.loop_type = "planning";
  planningState.iteration = 0;
  assertOutcome(
    invoke(planningState, ["--action", "validate-state"], {decision: planningDecision}),
    expectedCase("full-planning-without-opt-in-blocked"),
  );

  planningDecision.explicit_loop_request = "full-planning-loop";
  bindDecision(planningState, planningDecision);
  assert.equal(
    invoke(planningState, ["--action", "validate-state"], {decision: planningDecision}).status,
    0,
  );

  const programmingDecision = decisionFixture("full", {
    explicit_loop_request: "programming-loop",
  });
  const programmingState = bindDecision(stateFixture("full"), programmingDecision);
  assertOutcome(
    invoke(programmingState, ["--action", "validate-state"], {decision: programmingDecision}),
    expectedCase("full-programming-without-opt-in-blocked"),
  );

  programmingDecision.explicit_loop_request = "full-programming-loop";
  bindDecision(programmingState, programmingDecision);
  assert.equal(
    invoke(programmingState, ["--action", "validate-state"], {decision: programmingDecision}).status,
    0,
  );
});

test("light review count is derived from ordered activity and cannot be reset", () => {
  const state = stateFixture("light");
  state.activity = [
    activity("review", 1),
    activity("review", 2, {sequence: 2}),
  ];
  state.iteration = 2;
  state.budget.light_review_passes = 2;
  assertOutcome(
    invoke(state, ["--action", "dispatch-role", "--role", "reviewer", "--actor-id", "review-a", "--iteration", "3"]),
    expectedCase("third-light-review-blocked"),
  );

  state.budget.light_review_passes = 0;
  const reset = invoke(state, ["--action", "validate-state"]);
  assert.equal(reset.status, 2);
  assert.equal(reset.json.reason_code, "LIGHT_REVIEW_COUNTER_MISMATCH");
  const persisted = invoke(stateFixture("light"), ["--action", "validate-state"], {nestedRun: true});
  assert.equal(persisted.status, 1);
  assert.equal(persisted.json.reason_code, "INVALID_STATE");
});

test("iteration is derived from activity and extension ledger remains continuous", () => {
  const state = stateFixture("guarded");
  state.activity = Array.from({length: 5}, (_, index) =>
    activity(index === 0 ? "implementation" : "review", index + 1, {sequence: index + 1}));
  state.iteration = 5;
  assertOutcome(
    invoke(state, ["--action", "dispatch-role", "--role", "reviewer", "--actor-id", "review-a", "--iteration", "5"]),
    expectedCase("current-iteration-dispatch-bypass-blocked"),
  );
  assertOutcome(
    invoke(state, ["--action", "dispatch-role", "--role", "reviewer", "--actor-id", "review-a", "--iteration", "6"]),
    expectedCase("iteration-six-needs-extension"),
  );

  const reset = structuredClone(state);
  reset.iteration = 1;
  const resetResult = invoke(reset, ["--action", "validate-state"]);
  assert.equal(resetResult.status, 2);
  assert.equal(resetResult.json.reason_code, "ITERATION_COUNTER_MISMATCH");

  const fresh = stateFixture("guarded");
  const unapproved = invoke(fresh, [
    "--action", "extend-budget", "--next-limit", "8", "--approval-ref", "old-ledger:42",
  ]);
  assert.equal(unapproved.status, 2);
  assert.equal(unapproved.json.reason_code, "EXTENSION_APPROVAL_MISSING");
  assert.equal(invoke(fresh, [
    "--action", "extend-budget", "--next-limit", "8", "--approval-ref", "current-dialog:42",
  ]).status, 0);
  fresh.budget.active_max_iterations = 8;
  fresh.extensions = [{
    previous_limit: 6,
    new_limit: 8,
    approval_evidence: "current-dialog:42",
    approved_at: "2026-07-29T00:00:00Z",
    post_ten_decision: false,
  }];
  const broken = invoke(fresh, ["--action", "validate-state"]);
  assert.equal(broken.status, 2);
  assert.equal(broken.json.reason_code, "EXTENSION_CHAIN_BROKEN");
});

test("continuing beyond ten needs a separate post-ten decision", () => {
  const state = stateFixture("guarded");
  const blocked = invoke(state, [
    "--action", "extend-budget", "--next-limit", "11", "--approval-ref", "current-dialog:extend",
  ]);
  assert.equal(blocked.status, 2);
  assert.equal(blocked.json.reason_code, "POST_TEN_DECISION_MISSING");
  assert.equal(invoke(state, [
    "--action", "extend-budget", "--next-limit", "11", "--approval-ref", "current-dialog:extend",
    "--post-ten-decision", "true",
  ]).status, 0);
});

test("full suite and duplicate same-snapshot checks are blocked by behavior", () => {
  const fullSuite = stateFixture("guarded");
  fullSuite.checks.push({
    id: "product-suite",
    tier: "focused",
    snapshot_id: "snapshot-a",
    status: "not_run",
    invalidated_by: null,
    suite: "full",
    mandatory_project_rule: false,
  });
  assertOutcome(
    invoke(fullSuite, ["--action", "run-check", "--check-id", "product-suite"]),
    expectedCase("full-suite-below-release-blocked"),
  );
  fullSuite.checks[0].mandatory_project_rule = true;
  assert.equal(invoke(fullSuite, ["--action", "run-check", "--check-id", "product-suite"]).status, 0);

  const duplicate = stateFixture("guarded");
  duplicate.checks = [
    {
      id: "focused-contract",
      tier: "focused",
      snapshot_id: "snapshot-a",
      status: "passed",
      invalidated_by: "arbitrary-label",
      suite: "focused",
      mandatory_project_rule: false,
    },
    {
      id: "focused-contract",
      tier: "focused",
      snapshot_id: "snapshot-a",
      status: "not_run",
      invalidated_by: null,
      suite: "focused",
      mandatory_project_rule: false,
    },
  ];
  assertOutcome(
    invoke(duplicate, ["--action", "run-check", "--check-id", "focused-contract"]),
    expectedCase("duplicate-snapshot-check-blocked"),
  );
  duplicate.current_snapshot_id = "snapshot-b";
  duplicate.checks[1].snapshot_id = "snapshot-b";
  assert.equal(invoke(duplicate, ["--action", "run-check", "--check-id", "focused-contract"]).status, 0);
});

test("action-specific CLI contracts reject missing and unexpected arguments", () => {
  const state = stateFixture("guarded");
  assertOutcome(
    invoke(state, ["--action", "validate-state", "--role", "reviewer"]),
    expectedCase("unexpected-action-argument-fails-closed"),
  );
  const missing = invoke(state, ["--action", "dispatch-role", "--role", "reviewer", "--iteration", "1"]);
  assert.equal(missing.status, 1);
  assert.equal(missing.json.reason_code, "INVALID_INVOCATION");
  state.schema_version = 1;
  const historical = invoke(state, ["--action", "validate-state"]);
  assert.equal(historical.status, 1);
  assert.equal(historical.json.reason_code, "INVALID_STATE");
});
