import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

export const root = new URL("../", import.meta.url);
export const guard = new URL("../.ai-loop/bin/guard.mjs", import.meta.url);
export const cases = JSON.parse(readFileSync(new URL("../.ai-loop/gate-cases.json", import.meta.url), "utf8"));

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
export const hash = (value) => createHash("sha256").update(canonical(value)).digest("hex");

function plainScope(overrides = {}) {
  return {
    owner: "open-code-ai/.ai-loop",
    source_of_truth: "plans/adaptive-planning-programming-loop-v3.md",
    in_scope: [".ai-loop"],
    out_of_scope: ["product code"],
    direct_consumers: ["development agents"],
    rollback: "revert the protocol diff",
    ...overrides,
  };
}
export function approvedScope(overrides = {}) {
  const capsule = plainScope(overrides);
  const digest = hash(capsule);
  return {
    ...capsule,
    scope_hash: digest,
    approval: {
      approved_hash: digest,
      approval_evidence: "current-dialog:approved-plan",
      approved_at: "2026-07-29T00:00:00Z",
    },
  };
}
export function rolesFor(profile) {
  return {
    implementer: profile === "guarded" || profile === "full" ? "impl-a" : null,
    reviewer: profile === "light" || profile === "guarded" || profile === "full" ? "review-a" : null,
    fixer: profile === "full" ? "fix-a" : null,
  };
}
export function decisionFixture(profile = "guarded", overrides = {}) {
  const scope = overrides.scope ?? plainScope();
  const decision = {
    schema_version: 1,
    policy_version: 3,
    decision: "ALLOW",
    reason_code: "PROFILE_ADMITTED",
    planning_profile: "light",
    programming_profile: profile,
    proof_profile: "focused",
    proposed_programming_profile: null,
    explicit_loop_request: profile === "full" ? "full-programming-loop" : "programming-loop",
    scope,
    scope_hash: hash(scope),
    initial_role_assignments: rolesFor(profile),
    effects: [],
    unresolved_effects: [],
    execution_facts: {
      independence_need: profile === "full"
        ? "full_independent_cycle"
        : profile === "guarded" ? "separation_of_duties" : profile === "light" ? "independent_review" : "none",
      resolved_full_planning_to_local_fix: false,
    },
    reasons: ["fixture"],
    required_checks: [],
    ...overrides,
  };
  decision.scope_hash = hash(decision.scope);
  return decision;
}
export function stateFixture(profile = "guarded") {
  const decision = decisionFixture(profile);
  return {
    schema_version: 2,
    loop_id: "guard-test",
    loop_type: "programming",
    status: "IMPLEMENTING",
    iteration: 1,
    decision_hash: hash(decision),
    profiles: {
      planning: decision.planning_profile,
      programming: decision.programming_profile,
      proof: decision.proof_profile,
    },
    scope: approvedScope(),
    role_assignments: {...rolesFor(profile), changes: []},
    budget: {
      base_max_iterations: 5,
      active_max_iterations: 5,
      planning_role_reruns: {},
      light_review_passes: 0,
    },
    extensions: [],
    current_snapshot_id: "snapshot-a",
    checks: [],
    activity: [],
    gate: {fail_on_severity: ["blocker", "critical", "major"]},
  };
}
export function bindDecision(state, decision) {
  state.decision_hash = hash(decision);
  state.profiles = {
    planning: decision.planning_profile,
    programming: decision.programming_profile,
    proof: decision.proof_profile,
  };
  state.role_assignments = {...decision.initial_role_assignments, changes: []};
  return state;
}
export function activity(type, iteration, overrides = {}) {
  return {
    sequence: 1,
    type,
    iteration,
    snapshot_id: `snapshot-${iteration}`,
    artifact_ref: `iterations/${String(iteration).padStart(3, "0")}/${type}.json`,
    ...(type === "qa" ? {actor_id: `qa-${iteration}`} : {}),
    ...overrides,
  };
}
export function passingState(profile = "full") {
  const state = stateFixture(profile);
  state.status = "PASSED";
  state.activity = [activity("qa", 1, {verdict: "pass"})];
  state.current_snapshot_id = state.activity[0].snapshot_id;
  state.final = {
    verdict: "pass",
    source_qa_iteration: 1,
    source_qa_ref: state.activity[0].artifact_ref,
    plan_coverage_complete: true,
  };
  return state;
}
export function invoke(state, args, {decision = decisionFixture(state.profiles.programming), nestedRun = false} = {}) {
  const directory = mkdtempSync(join(tmpdir(), "ai-loop-guard-"));
  const statePath = nestedRun
    ? join(directory, ".ai-loop", "runs", "run", "state.json")
    : join(directory, "state.json");
  const decisionPath = join(directory, "decision.json");
  if (nestedRun) mkdirSync(join(directory, ".ai-loop", "runs", "run"), {recursive: true});
  writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
  writeFileSync(decisionPath, `${JSON.stringify(decision, null, 2)}\n`);
  const beforeState = readFileSync(statePath, "utf8");
  const beforeDecision = readFileSync(decisionPath, "utf8");
  const result = spawnSync(
    process.execPath,
    [guard.pathname, "--state", statePath, "--decision", decisionPath, ...args],
    {cwd: root, encoding: "utf8"},
  );
  assert.equal(readFileSync(statePath, "utf8"), beforeState, "guard must not write state");
  assert.equal(readFileSync(decisionPath, "utf8"), beforeDecision, "guard must not write decision");
  assert.ok(result.stdout, result.stderr);
  return {...result, json: JSON.parse(result.stdout)};
}
export function invokeRaw(args) {
  const result = spawnSync(process.execPath, [guard.pathname, ...args], {cwd: root, encoding: "utf8"});
  assert.ok(result.stdout, result.stderr);
  return {...result, json: JSON.parse(result.stdout)};
}
export function expectedCase(id) {
  const entry = cases.negative_cases.find((item) => item.id === id);
  assert.ok(entry, `missing structured negative case ${id}`);
  return entry.expected;
}
export function assertOutcome(result, expected) {
  assert.deepEqual(
    {exit: result.status, decision: result.json.decision, reason_code: result.json.reason_code},
    {exit: expected.exit, decision: expected.decision, reason_code: expected.reason_code},
  );
}
