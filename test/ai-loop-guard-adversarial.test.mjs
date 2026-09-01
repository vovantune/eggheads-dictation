import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { assertJsonSchema } from "../.ai-loop/bin/json-schema-validator.mjs";
import {
  activity,
  assertOutcome,
  bindDecision,
  cases,
  decisionFixture,
  expectedCase,
  invoke,
  invokeRaw,
  passingState,
  stateFixture,
} from "./ai_loop_guard_fixtures.mjs";

test("final admission references the latest QA event overall and it must pass", () => {
  const state = stateFixture("full");
  state.status = "PASSED";
  state.activity = [
    activity("qa", 1, {verdict: "pass"}),
    activity("qa", 2, {sequence: 2, verdict: "fail"}),
  ];
  state.iteration = 2;
  state.current_snapshot_id = state.activity[1].snapshot_id;
  state.final = {
    verdict: "pass",
    source_qa_iteration: 1,
    source_qa_ref: state.activity[0].artifact_ref,
    plan_coverage_complete: true,
  };
  assertOutcome(invoke(state, ["--action", "finalize"]), expectedCase("preserve-full-fixer-fresh-qa"));

  state.activity[1].verdict = "pass";
  const wrongReference = invoke(state, ["--action", "finalize"]);
  assert.equal(wrongReference.status, 2);
  assert.equal(wrongReference.json.reason_code, "FINAL_QA_REFERENCE_MISMATCH");
  state.final = {
    verdict: "pass",
    source_qa_iteration: 2,
    source_qa_ref: state.activity[1].artifact_ref,
    plan_coverage_complete: true,
  };
  assert.equal(invoke(state, ["--action", "finalize"]).status, 0);

  state.activity.push(activity("fix", 3, {sequence: 3}));
  state.iteration = 3;
  const stale = invoke(state, ["--action", "finalize"]);
  assert.equal(stale.status, 2);
  assert.equal(stale.json.reason_code, "ACTIVITY_AFTER_FINAL_QA");
});

test("final admission blocks open important findings, mandatory checks, and incomplete plan coverage", () => {
  const findingState = passingState();
  findingState.open_findings = [{
    id: "major-1",
    severity: "major",
    summary: "missing contract proof",
    blocking: true,
    status: "open",
  }];
  assertOutcome(
    invoke(findingState, ["--action", "finalize"]),
    expectedCase("open-major-finding-blocks-finalize"),
  );
  const booleanBypass = passingState();
  booleanBypass.open_findings = [{
    id: "major-boolean-bypass",
    severity: "major",
    summary: "blocking false must not override canonical severity",
    blocking: false,
    status: "open",
  }];
  assertOutcome(
    invoke(booleanBypass, ["--action", "finalize"]),
    expectedCase("open-major-blocking-false-blocks-finalize"),
  );

  for (const [status, caseId] of [
    ["failed", "failed-mandatory-check-blocks-finalize"],
    ["not_run", "not-run-mandatory-check-blocks-finalize"],
  ]) {
    const decision = decisionFixture("full", {required_checks: ["contract-check"]});
    const checkState = bindDecision(passingState(), decision);
    checkState.checks = [{
      id: "contract-check",
      tier: "contract",
      snapshot_id: "snapshot-1",
      status,
      invalidated_by: null,
      suite: "focused",
      mandatory_project_rule: false,
    }];
    assertOutcome(invoke(checkState, ["--action", "finalize"], {decision}), expectedCase(caseId));
  }
  const staleDecision = decisionFixture("full", {required_checks: ["contract-check"]});
  const staleCheck = bindDecision(passingState(), staleDecision);
  staleCheck.checks = [{
    id: "contract-check",
    tier: "contract",
    snapshot_id: "snapshot-old",
    status: "passed",
    invalidated_by: null,
    suite: "focused",
    mandatory_project_rule: false,
  }];
  assertOutcome(
    invoke(staleCheck, ["--action", "finalize"], {decision: staleDecision}),
    expectedCase("failed-mandatory-check-blocks-finalize"),
  );

  const coverageState = passingState();
  coverageState.final.plan_coverage_complete = false;
  assertOutcome(
    invoke(coverageState, ["--action", "finalize"]),
    expectedCase("incomplete-plan-coverage-blocks-finalize"),
  );
});

test("open minor and nit findings do not block final admission", () => {
  const state = passingState();
  state.open_findings = ["minor", "nit"].map((severity) => ({
    id: `${severity}-finding`,
    severity,
    summary: `${severity} residual`,
    blocking: true,
    status: "open",
  }));
  assert.equal(invoke(state, ["--action", "finalize"]).status, 0);
});

test("guard independently rejects a hash-consistent hard-effect profile downgrade", () => {
  const decision = decisionFixture("guarded", {
    effects: ["public_external_contract"],
    explicit_loop_request: "full-programming-loop",
    execution_facts: {independence_need: "separation_of_duties", resolved_full_planning_to_local_fix: false},
  });
  const state = bindDecision(stateFixture("guarded"), decision);
  assertOutcome(
    invoke(state, ["--action", "validate-state"], {decision}),
    expectedCase("hard-effect-decision-downgrade-blocked"),
  );
});

test("full role identities are separate and each QA reviewer is fresh", () => {
  const decision = decisionFixture("full", {
    initial_role_assignments: {implementer: "same-a", reviewer: "review-a", fixer: "same-a"},
  });
  const state = bindDecision(stateFixture("full"), decision);
  assertOutcome(
    invoke(state, ["--action", "validate-state"], {decision}),
    expectedCase("separate-fixer-reviewer-identities-required"),
  );

  const validDecision = decisionFixture("full");
  const converged = bindDecision(stateFixture("full"), validDecision);
  converged.role_assignments.changes = [{
    role: "fixer",
    from: "fix-a",
    to: "impl-a",
    reason: "invalid convergence",
    changed_at: "2026-07-29T02:00:00Z",
  }];
  converged.role_assignments.fixer = "impl-a";
  assertOutcome(
    invoke(converged, ["--action", "validate-state"], {decision: validDecision}),
    expectedCase("separate-fixer-reviewer-identities-required"),
  );

  const repeatedQa = passingState();
  repeatedQa.activity.push(activity("qa", 2, {sequence: 2, actor_id: "qa-1", verdict: "pass"}));
  repeatedQa.iteration = 2;
  repeatedQa.final.source_qa_iteration = 2;
  repeatedQa.final.source_qa_ref = repeatedQa.activity[1].artifact_ref;
  assertOutcome(
    invoke(repeatedQa, ["--action", "finalize"]),
    expectedCase("fresh-qa-reviewer-identity-required"),
  );
  const fixerAsQa = passingState();
  fixerAsQa.activity[0].actor_id = "fix-a";
  assertOutcome(
    invoke(fixerAsQa, ["--action", "finalize"]),
    expectedCase("fresh-qa-reviewer-identity-required"),
  );
});

test("planning role initial and rerun budgets derive only from ordered activity", () => {
  const role = "reviewer-project-dod";
  const decision = decisionFixture("guarded", {
    planning_profile: "full",
    explicit_loop_request: "full-planning-loop",
  });
  const state = bindDecision(stateFixture("guarded"), decision);
  state.loop_type = "planning";
  state.iteration = 0;
  assert.equal(invoke(state, [
    "--action", "dispatch-role", "--role", role, "--actor-id", "planner-a", "--iteration", "1", "--pass", "initial",
  ], {decision}).status, 0);

  state.activity = [activity("planning", 1, {role, pass: "initial"})];
  state.iteration = 1;
  assertOutcome(
    invoke(state, [
      "--action", "dispatch-role", "--role", role, "--actor-id", "planner-a", "--iteration", "2", "--pass", "initial",
    ], {decision}),
    expectedCase("planning-initial-pass-limit"),
  );
  assert.equal(invoke(state, [
    "--action", "dispatch-role", "--role", role, "--actor-id", "planner-a", "--iteration", "2", "--pass", "rerun",
  ], {decision}).status, 0);

  state.activity.push(activity("planning", 2, {sequence: 2, role, pass: "rerun"}));
  state.iteration = 2;
  state.budget.planning_role_reruns = {[role]: 1};
  assertOutcome(
    invoke(state, [
      "--action", "dispatch-role", "--role", role, "--actor-id", "planner-a", "--iteration", "3", "--pass", "rerun",
    ], {decision}),
    expectedCase("planning-rerun-pass-limit"),
  );

  state.budget.planning_role_reruns = {};
  const reset = invoke(state, ["--action", "validate-state"], {decision});
  assert.equal(reset.status, 2);
  assert.equal(reset.json.reason_code, "PLANNING_RERUN_COUNTER_MISMATCH");
  assertOutcome(
    invoke(state, [
      "--action", "dispatch-role", "--role", role, "--actor-id", "planner-a", "--iteration", "3", "--rerun", "false",
    ], {decision}),
    expectedCase("planning-rerun-flag-bypass-invalid"),
  );
});

test("light requires transient guard state and forbids planning council roles", () => {
  assertOutcome(
    invoke(stateFixture("light"), ["--action", "validate-state"], {nestedRun: true}),
    expectedCase("light-persisted-state-forbidden"),
  );
  assertOutcome(
    invoke(stateFixture("light"), [
      "--action", "dispatch-role", "--role", "planner-minimal", "--actor-id", "planner-a", "--iteration", "1", "--pass", "initial",
    ]),
    expectedCase("light-planning-council-forbidden"),
  );
});

test("fix activity requires a later passing QA before final admission", () => {
  const state = passingState();
  state.activity = [
    activity("qa", 1, {verdict: "pass"}),
    activity("fix", 2, {sequence: 2}),
  ];
  state.iteration = 2;
  assertOutcome(invoke(state, ["--action", "finalize"]), expectedCase("qa-after-fix-required"));
});

test("invalid JSON and missing decision/state artifacts fail closed separately", () => {
  const directory = mkdtempSync(join(tmpdir(), "ai-loop-invalid-"));
  const validState = join(directory, "state.json");
  const validDecision = join(directory, "decision.json");
  const invalidJson = join(directory, "invalid.json");
  writeFileSync(validState, JSON.stringify(stateFixture("guarded")));
  writeFileSync(validDecision, JSON.stringify(decisionFixture("guarded")));
  writeFileSync(invalidJson, "{not-json");

  assertOutcome(
    invokeRaw(["--state", invalidJson, "--decision", validDecision, "--action", "validate-state"]),
    expectedCase("invalid-json-artifact"),
  );
  assertOutcome(
    invokeRaw(["--state", join(directory, "missing-state.json"), "--decision", validDecision, "--action", "validate-state"]),
    expectedCase("missing-state-artifact"),
  );
  assertOutcome(
    invokeRaw(["--state", validState, "--decision", join(directory, "missing-decision.json"), "--action", "validate-state"]),
    expectedCase("missing-decision-artifact"),
  );
});

test("tracked schemas reject unknown, missing, additional, and nested-invalid data", () => {
  for (const profile of ["light", "guarded", "full"]) {
    assert.equal(invoke(stateFixture(profile), ["--action", "validate-state"]).status, 0);
  }

  const unknownStatus = stateFixture("guarded");
  unknownStatus.status = "MYSTERY";
  assertOutcome(
    invoke(unknownStatus, ["--action", "validate-state"]),
    expectedCase("schema-unknown-state-status"),
  );

  const missingDecision = decisionFixture("guarded");
  delete missingDecision.proposed_programming_profile;
  assertOutcome(
    invoke(stateFixture("guarded"), ["--action", "validate-state"], {decision: missingDecision}),
    expectedCase("schema-missing-decision-field"),
  );

  const additional = stateFixture("guarded");
  additional.scope.untracked = true;
  assertOutcome(
    invoke(additional, ["--action", "validate-state"]),
    expectedCase("schema-additional-property"),
  );

  const nestedEnum = stateFixture("guarded");
  nestedEnum.open_findings = [{
    id: "schema-ref",
    severity: "warning",
    summary: "invalid local ref enum",
    blocking: true,
    status: "open",
  }];
  assertOutcome(
    invoke(nestedEnum, ["--action", "validate-state"]),
    expectedCase("schema-invalid-nested-enum"),
  );
});

test("schema preflight inspects unreachable branches, refs, siblings, and cycles", () => {
  assert.throws(
    () => assertJsonSchema("selected", {
      if: {const: "selected"},
      then: {type: "string"},
      else: {futureKeyword: true},
    }),
    /unsupported schema keyword futureKeyword/,
  );
  assert.throws(
    () => assertJsonSchema("selected", {
      if: {const: "selected"},
      then: {type: "string"},
      else: {$ref: "#/$defs/missing"},
      $defs: {},
    }),
    /unresolved ref/,
  );
  assert.throws(
    () => assertJsonSchema("x", {
      $defs: {text: {type: "string"}},
      $ref: "#/$defs/text",
      minLength: 3,
    }),
    /shorter than minLength/,
  );
  assert.doesNotThrow(() => assertJsonSchema("cycle-safe", {
    $defs: {loop: {$ref: "#/$defs/loop"}},
    $ref: "#/$defs/loop",
  }));
});

test("every structured guard negative case has an executable scenario", () => {
  const covered = new Set([
    "role-identity-drift",
    "failed-qa-after-pass",
    "iteration-limit",
    "light-review-limit",
    "duplicate-snapshot-check-with-invalidation-label",
    "full-suite-below-release",
    "decision-baseline-drift",
    "unexpected-action-argument",
    "mandatory-check-failed",
    "mandatory-check-not-run",
    "open-major-finding",
    "plan-coverage-false",
    "decision-hard-effect-downgrade",
    "full-planning-without-opt-in",
    "full-programming-without-opt-in",
    "planning-initial-limit",
    "planning-rerun-limit",
    "planning-rerun-false-bypass",
    "separate-role-identities",
    "fresh-qa-reviewer-identity",
    "qa-after-fix",
    "invalid-json",
    "missing-state-artifact",
    "missing-decision-artifact",
    "light-persisted-artifact",
    "light-planning-council",
    "current-iteration-dispatch-bypass",
    "schema-unknown-state-status",
    "schema-missing-decision-field",
    "schema-additional-property",
    "schema-invalid-nested-enum",
    "open-major-blocking-false",
  ]);
  const required = cases.negative_cases
    .filter((entry) => entry.kind === "guard")
    .map((entry) => entry.input.scenario);
  assert.deepEqual(new Set(required), covered);
  for (const entry of cases.negative_cases.filter((item) => item.kind === "guard")) {
    assert.ok(entry.expected.decision);
    assert.ok(entry.expected.reason_code);
    assert.ok(Number.isInteger(entry.expected.exit));
  }
});
