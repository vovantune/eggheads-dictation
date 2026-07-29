#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import { assertJsonSchema } from "./json-schema-validator.mjs";

const policy = JSON.parse(readFileSync(new URL("../gate-policy.json", import.meta.url), "utf8"));
const decisionSchema = JSON.parse(readFileSync(new URL("../schemas/decision.schema.json", import.meta.url), "utf8"));
const stateSchema = JSON.parse(readFileSync(new URL("../schemas/loop-state.schema.json", import.meta.url), "utf8"));
const planningRoles = new Set([
  "planner-minimal", "planner-reuse", "planner-ops", "planner-ux",
  "reviewer-yagni-scope", "reviewer-evidence-contract", "reviewer-project-dod",
]);
const programmingRoles = new Set(["implementer", "reviewer", "fixer"]);
const actions = new Set(["validate-state", "dispatch-role", "run-check", "extend-budget", "finalize"]);
const programmingRank = { direct: 0, light: 1, guarded: 2, full: 3 };
const hardEffects = new Set(Object.values(policy.planning.hard_effects).flatMap((category) => Object.keys(category)));
const actionArgs = {
  "validate-state": { required: ["state", "action", "decision"], optional: [] },
  "dispatch-role": { required: ["state", "action", "decision", "role", "actor-id", "iteration"], optional: ["pass"] },
  "run-check": { required: ["state", "action", "decision", "check-id"], optional: [] },
  "extend-budget": { required: ["state", "action", "decision", "next-limit", "approval-ref"], optional: ["post-ten-decision"] },
  finalize: { required: ["state", "action", "decision"], optional: [] },
};
function finish(state, action, decision, reasonCode, invariant, message, code) {
  process.stdout.write(`${JSON.stringify({
    decision,
    reason_code: reasonCode,
    action: action ?? null,
    profiles: state?.profiles ?? null,
    budget: state?.budget ?? null,
    violated_invariant: invariant ? { id: invariant, message } : null,
  })}\n`);
  process.exit(code);
}
const invalid = (state, action, reason, invariant, message) => finish(state, action, "INVALID", reason, invariant, message, 1);
const human = (state, action, reason, invariant, message) => finish(state, action, "HUMAN_DECISION_REQUIRED", reason, invariant, message, 2);
const allow = (state, action) => finish(state, action, "ALLOW", "ALLOW", null, null, 0);
function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value || value.startsWith("--") || result[key.slice(2)] !== undefined) {
      throw new Error(`Invalid option near ${key ?? "<end>"}`);
    }
    result[key.slice(2)] = value;
  }
  return result;
}
function validateActionArgs(args) {
  if (!args.state || !actions.has(args.action)) throw new Error("Use --state and a supported --action");
  const contract = actionArgs[args.action];
  const allowed = new Set([...contract.required, ...contract.optional]);
  const unexpected = Object.keys(args).filter((key) => !allowed.has(key));
  const missing = contract.required.filter((key) => args[key] === undefined);
  if (unexpected.length || missing.length) {
    throw new Error(`Arguments for ${args.action}: missing=[${missing}], unexpected=[${unexpected}]`);
  }
  if (args.pass !== undefined && !["initial", "rerun"].includes(args.pass)) throw new Error("--pass must be initial or rerun");
  if (args["post-ten-decision"] !== undefined && !["true", "false"].includes(args["post-ten-decision"])) throw new Error("--post-ten-decision must be true or false");
}
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
function required(condition, message) { if (!condition) throw new Error(message); }
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (object(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
const hash = (value) => createHash("sha256").update(canonical(value)).digest("hex");
const scopeFields = ["owner", "source_of_truth", "in_scope", "out_of_scope", "direct_consumers", "rollback"];
const scopeCapsule = (scope) => Object.fromEntries(scopeFields.map((key) => [key, scope[key]]));
const scopeHash = (scope) => hash(scopeCapsule(scope));
function validateDecisionSemantics(decision) {
  required(decision.decision === "ALLOW" && decision.reason_code === "PROFILE_ADMITTED", "decision must admit the selected profiles");
  required(decision.scope_hash === scopeHash(decision.scope), "decision scope hash is invalid");
  for (const effect of [...decision.effects, ...decision.unresolved_effects]) {
    required(hardEffects.has(effect), `unknown hard effect: ${effect}`);
  }
}
function requiredProgrammingProfile(decision) {
  const facts = decision.execution_facts;
  let requiredProfile = decision.effects.length || decision.unresolved_effects.length
    || facts.independence_need === "full_independent_cycle"
    ? "full"
    : facts.independence_need === "separation_of_duties"
      || (facts.resolved_full_planning_to_local_fix && decision.planning_profile === "full")
      ? "guarded"
      : facts.independence_need === "independent_review" ? "light" : "direct";
  const request = decision.explicit_loop_request;
  if (request === "light-programming-loop" && programmingRank[requiredProfile] > programmingRank.light) {
    return { blocked: true, profile: requiredProfile };
  }
  if (request === "full-programming-loop" || request === "full-qa-until-pass") requiredProfile = "full";
  if (request === "programming-loop" || request === "light-programming-loop") {
    requiredProfile = programmingRank[requiredProfile] < programmingRank.light ? "light" : requiredProfile;
  }
  return { blocked: false, profile: requiredProfile };
}
function validateDecisionAdmission(state, decision, action) {
  const derived = requiredProgrammingProfile(decision);
  if (derived.blocked || decision.programming_profile !== derived.profile) {
    human(
      state,
      action,
      derived.blocked ? "LIGHT_PROFILE_CEILING" : "DECISION_ADMISSION_MISMATCH",
      "programming-profile-derived-from-decision-facts",
      `Decision facts/request require ${derived.profile}, not ${decision.programming_profile}.`,
    );
  }
  const actors = Object.values(decision.initial_role_assignments).filter(Boolean);
  if ((decision.programming_profile === "guarded" && new Set(actors).size !== 2)
      || (decision.programming_profile === "full" && new Set(actors).size !== 3)) {
    human(state, action, "ROLE_INDEPENDENCE_VIOLATION", "independent-programming-identities", "Programming roles must use separate identities.");
  }
}
function validateStateSemantics(state, path) {
  const profile = state.profiles.programming;
  for (const role of Object.keys(state.budget.planning_role_reruns)) {
    required(planningRoles.has(role), `invalid rerun budget for ${role}`);
  }
  let previousIteration = 0;
  for (const [index, event] of state.activity.entries()) {
    required(
      object(event)
        && event.sequence === index + 1
        && Number.isInteger(event.iteration)
        && event.iteration >= previousIteration
        && ["planning", "implementation", "review", "fix", "qa"].includes(event.type)
        && typeof event.snapshot_id === "string"
        && typeof event.artifact_ref === "string",
      "activity must be contiguous and ordered",
    );
    if (event.type === "qa") required(["pass", "fail", "needs_human"].includes(event.verdict), "QA verdict is invalid");
    if (event.type === "planning") {
      required(planningRoles.has(event.role) && ["initial", "rerun"].includes(event.pass), "Planning activity role/pass is invalid");
    } else {
      required(event.role === undefined && event.pass === undefined, "Programming activity cannot carry planning role/pass");
    }
    previousIteration = event.iteration;
  }
  if (profile === "light" && resolve(path).split(sep).join("/").includes("/.ai-loop/runs/")) {
    throw new Error("Light state must be transient outside .ai-loop/runs");
  }
}
function derivedFacts(state) {
  const currentIteration = state.activity.length
    ? Math.max(...state.activity.map((event) => event.iteration))
    : state.loop_type === "planning" ? 0 : 1;
  const lightReviews = state.profiles.programming === "light"
    ? state.activity.filter((event) => event.type === "review").length
    : 0;
  const planningPasses = {};
  for (const event of state.activity.filter((item) => item.type === "planning")) {
    planningPasses[event.role] ??= { initial: 0, rerun: 0 };
    planningPasses[event.role][event.pass] += 1;
  }
  return {
    currentIteration,
    nextIteration: state.activity.length ? currentIteration + 1 : 1,
    lightReviews,
    planningPasses,
  };
}
function validateDecisionBinding(state, decision, action) {
  if (state.decision_hash !== hash(decision)) {
    human(state, action, "DECISION_BASELINE_MISMATCH", "decision-hash-binding", "state decision_hash differs from input/decision.json.");
  }
  const expectedProfiles = {
    planning: decision.planning_profile,
    programming: decision.programming_profile,
    proof: decision.proof_profile,
  };
  if (canonical(state.profiles) !== canonical(expectedProfiles)
      || state.scope.scope_hash !== decision.scope_hash
      || canonical(scopeCapsule(state.scope)) !== canonical(decision.scope)) {
    human(state, action, "DECISION_BASELINE_MISMATCH", "decision-profile-scope-binding", "State profiles or scope drifted from decision baseline.");
  }

  for (const role of programmingRoles) {
    let actor = decision.initial_role_assignments[role];
    for (const change of state.role_assignments.changes.filter((item) => item.role === role)) {
      required(
        object(change)
          && change.from === actor
          && typeof change.to === "string"
          && change.to
          && typeof change.reason === "string"
          && change.reason
          && typeof change.changed_at === "string"
          && change.changed_at,
        `${role} replacement chain is invalid`,
      );
      actor = change.to;
    }
    if (state.role_assignments[role] !== actor) {
      human(state, action, "ROLE_CHANGE_CHAIN_BROKEN", "decision-role-chain", `${role} does not follow the decision baseline.`);
    }
  }
  const currentActors = Object.values(state.role_assignments).filter((actor) => typeof actor === "string");
  if ((state.profiles.programming === "guarded" && new Set(currentActors).size !== 2)
      || (state.profiles.programming === "full" && new Set(currentActors).size !== 3)) {
    human(state, action, "ROLE_INDEPENDENCE_VIOLATION", "independent-programming-identities", "Current programming roles must remain separate.");
  }
}
function validateScope(state, action) {
  const expected = scopeHash(state.scope);
  if (state.scope.scope_hash !== expected) {
    human(state, action, "SCOPE_HASH_MISMATCH", "scope-hash-matches-capsule", "scope_hash does not match the capsule.");
  }
  const approval = state.scope.approval;
  if (approval.approved_hash !== expected || !approval.approval_evidence?.startsWith("current-dialog:")) {
    human(state, action, "SCOPE_APPROVAL_REQUIRED", "scope-change-needs-user-approval", "Scope lacks matching current-dialog approval.");
  }
}
function validateBudgets(state, action) {
  const derived = derivedFacts(state);
  if (state.iteration !== derived.currentIteration) {
    human(state, action, "ITERATION_COUNTER_MISMATCH", "iteration-derived-from-activity", `iteration must be ${derived.currentIteration}.`);
  }
  if (state.budget.light_review_passes !== derived.lightReviews) {
    human(state, action, "LIGHT_REVIEW_COUNTER_MISMATCH", "light-review-derived-from-activity", `light_review_passes must be ${derived.lightReviews}.`);
  }
  if (derived.lightReviews > 2) {
    human(state, action, "LIGHT_REVIEW_BUDGET_EXCEEDED", "light-review-budget", "Light permits two review passes.");
  }
  const derivedReruns = Object.fromEntries(
    Object.entries(derived.planningPasses)
      .filter(([, count]) => count.rerun > 0)
      .map(([role, count]) => [role, count.rerun]),
  );
  if (canonical(state.budget.planning_role_reruns) !== canonical(derivedReruns)) {
    human(state, action, "PLANNING_RERUN_COUNTER_MISMATCH", "planning-reruns-derived-from-activity", "planning_role_reruns differs from ordered activity.");
  }
  for (const [role, count] of Object.entries(derived.planningPasses)) {
    if (count.initial > 1 || count.rerun > 1 || count.rerun > count.initial) {
      human(state, action, "PLANNING_ROLE_BUDGET_EXCEEDED", "planning-role-pass-budget", `${role} exceeds one initial plus one rerun.`);
    }
  }
  if (state.profiles.programming === "full") {
    const qaActors = state.activity.filter((event) => event.type === "qa").map((event) => event.actor_id);
    if (qaActors.some((actor) => typeof actor !== "string" || !actor
        || [state.role_assignments.implementer, state.role_assignments.fixer].includes(actor))
        || new Set(qaActors).size !== qaActors.length) {
      human(state, action, "FRESH_QA_IDENTITY_REQUIRED", "fresh-full-qa-identity", "Every full QA pass needs a fresh reviewer identity.");
    }
  }
  let limit = 5;
  for (const [index, extension] of state.extensions.entries()) {
    required(object(extension), `extension ${index} is invalid`);
    if (extension.previous_limit !== limit || extension.new_limit <= limit) {
      human(state, action, "EXTENSION_CHAIN_BROKEN", "continuous-extension-chain", `Extension ${index} does not continue ${limit}.`);
    }
    if (!extension.approval_evidence?.startsWith("current-dialog:")) {
      human(state, action, "EXTENSION_APPROVAL_MISSING", "current-dialog-extension-approval", `Extension ${index} lacks approval.`);
    }
    if (extension.new_limit > 10 && extension.post_ten_decision !== true) {
      human(state, action, "POST_TEN_DECISION_MISSING", "post-ten-new-loop-decision", `Extension ${index} lacks post-ten decision.`);
    }
    limit = extension.new_limit;
  }
  if (state.budget.active_max_iterations !== limit) {
    human(state, action, "ACTIVE_LIMIT_MISMATCH", "active-limit-derived-from-ledger", `active_max_iterations must be ${limit}.`);
  }
}
function validateCompletion(state, action) {
  if (state.status !== "PASSED" && action !== "finalize") return;
  if (!object(state.final) || state.final.verdict !== "pass") {
    human(state, action, "FINAL_VERDICT_MISSING", "passed-needs-final-verdict", "PASSED requires final pass.");
  }
  const important = new Set(state.gate.fail_on_severity);
  if ((state.open_findings ?? []).some((finding) =>
    important.has(finding.severity) && !["fixed", "accepted_non_blocking"].includes(finding.status))) {
    human(state, action, "OPEN_IMPORTANT_FINDING", "no-open-important-findings", "An important finding remains open.");
  }
  const mandatoryIds = new Set([
    ...decision.required_checks,
    ...state.checks.filter((check) => check.mandatory_project_rule).map((check) => check.id),
  ]);
  for (const id of mandatoryIds) {
    const latest = state.checks.filter((check) => check.id === id).at(-1);
    if (!latest || latest.snapshot_id !== state.current_snapshot_id
        || !["passed", "accepted_unavailable"].includes(latest.status)) {
      human(state, action, "MANDATORY_CHECK_NOT_PASSING", "mandatory-checks-pass-or-accepted", `Mandatory check ${id} is not passing.`);
    }
  }
  if (state.final.plan_coverage_complete !== true) {
    human(state, action, "PLAN_COVERAGE_INCOMPLETE", "final-plan-coverage", "Final plan coverage is not complete.");
  }
  const latestQa = state.activity.filter((event) => event.type === "qa").at(-1);
  if (!latestQa) human(state, action, "PASSING_QA_MISSING", "passed-needs-passing-qa", "No QA exists.");
  if (latestQa.verdict !== "pass") {
    human(state, action, "LATEST_QA_NOT_PASSING", "latest-qa-must-pass", "The latest QA event overall is not passing.");
  }
  if (latestQa.snapshot_id !== state.current_snapshot_id) {
    human(state, action, "LATEST_QA_SNAPSHOT_MISMATCH", "latest-qa-covers-current-snapshot", "Latest QA does not cover the current snapshot.");
  }
  if (state.final.source_qa_iteration !== latestQa.iteration || state.final.source_qa_ref !== latestQa.artifact_ref) {
    human(state, action, "FINAL_QA_REFERENCE_MISMATCH", "final-references-latest-qa", "Final does not reference the latest QA event.");
  }
  if (state.activity.some((event) =>
    event.sequence > latestQa.sequence && ["implementation", "fix", "qa"].includes(event.type))) {
    human(state, action, "ACTIVITY_AFTER_FINAL_QA", "final-qa-is-fresh", "Implementation, fix, or QA exists after the referenced QA.");
  }
}
function dispatchRole(state, args) {
  const role = args.role;
  const iteration = Number(args.iteration);
  required(typeof role === "string" && Number.isInteger(iteration) && iteration > 0, "dispatch-role needs role/iteration");
  const derived = derivedFacts(state);
  const expectedIteration = state.activity.length ? derived.nextIteration : 1;
  if (iteration !== expectedIteration) {
    human(state, args.action, "ITERATION_SEQUENCE_MISMATCH", "iteration-derived-from-activity", `Dispatch iteration must be ${expectedIteration}.`);
  }
  if (iteration > state.budget.active_max_iterations) {
    human(state, args.action, "ITERATION_LIMIT_REACHED", "active-iteration-limit", `Iteration ${iteration} exceeds the active limit.`);
  }
  if (planningRoles.has(role)) {
    if (state.profiles.planning !== "full") {
      human(state, args.action, "ROLE_FORBIDDEN_FOR_PROFILE", "profile-role-permissions", `${role} requires full planning.`);
    }
    required(args.pass !== undefined, "Planning dispatch requires --pass initial|rerun");
    const counts = derived.planningPasses[role] ?? { initial: 0, rerun: 0 };
    if (args.pass === "initial" && counts.initial >= 1) {
      human(state, args.action, "PLANNING_INITIAL_ALREADY_USED", "planning-role-initial-budget", `${role} already used its initial pass.`);
    }
    if (args.pass === "rerun" && counts.initial !== 1) {
      human(state, args.action, "PLANNING_RERUN_BEFORE_INITIAL", "planning-role-pass-order", `${role} needs an initial pass before rerun.`);
    }
    if (args.pass === "rerun" && counts.rerun >= 1) {
      human(state, args.action, "PLANNING_ROLE_RERUN_BUDGET_EXCEEDED", "planning-role-rerun-budget", `${role} exhausted its rerun.`);
    }
    return allow(state, args.action);
  }
  required(args.pass === undefined, "--pass is only valid for planning roles");
  if (!programmingRoles.has(role)) invalid(state, args.action, "INVALID_ROLE", "known-role", `Unknown role: ${role}`);
  const permitted = {
    direct: [], light: ["reviewer"], guarded: ["implementer", "reviewer"], full: ["implementer", "reviewer", "fixer"],
  }[state.profiles.programming];
  if (!permitted.includes(role)) {
    human(state, args.action, "ROLE_FORBIDDEN_FOR_PROFILE", "profile-role-permissions", `${role} is forbidden for this profile.`);
  }
  if (state.role_assignments[role] !== args["actor-id"]) {
    human(state, args.action, "ROLE_IDENTITY_CHANGED", "guarded-role-stability", `${role} identity changed.`);
  }
  if (state.profiles.programming === "light" && derived.lightReviews >= 2) {
    human(state, args.action, "LIGHT_REVIEW_BUDGET_EXCEEDED", "light-review-budget", "A third light review is forbidden.");
  }
  allow(state, args.action);
}
function runCheck(state, args) {
  const records = state.checks.filter((check) => check.id === args["check-id"]);
  const planned = records.findLast((check) => check.status === "not_run" && check.snapshot_id === state.current_snapshot_id);
  if (!planned) invalid(state, args.action, "CHECK_NOT_PLANNED", "check-map-entry-required", "Current snapshot has no planned check.");
  if (planned.suite === "full" && state.profiles.proof !== "release" && planned.mandatory_project_rule !== true) {
    human(state, args.action, "FULL_SUITE_BELOW_RELEASE", "full-suite-tier", "Full suite is forbidden below release.");
  }
  if (records.some((check) =>
    check !== planned && check.snapshot_id === state.current_snapshot_id && check.status !== "not_run")) {
    human(state, args.action, "DUPLICATE_SNAPSHOT_CHECK", "no-duplicate-check-on-snapshot", "Check already completed on this snapshot.");
  }
  allow(state, args.action);
}
function extendBudget(state, args) {
  const next = Number(args["next-limit"]);
  required(Number.isInteger(next) && next > state.budget.active_max_iterations, "next-limit must increase the active limit");
  if (!args["approval-ref"].startsWith("current-dialog:")) {
    human(state, args.action, "EXTENSION_APPROVAL_MISSING", "current-dialog-extension-approval", "Extension needs current-dialog approval.");
  }
  if (next > 10 && args["post-ten-decision"] !== "true") {
    human(state, args.action, "POST_TEN_DECISION_MISSING", "post-ten-new-loop-decision", "Continuation beyond ten needs a separate decision.");
  }
  allow(state, args.action);
}

let args;
let state;
let decision;
try {
  args = parseArgs(process.argv.slice(2));
  validateActionArgs(args);
} catch (error) {
  invalid(null, args?.action, "INVALID_INVOCATION", "valid-invocation", error.message);
}
try {
  state = JSON.parse(readFileSync(args.state, "utf8"));
  decision = JSON.parse(readFileSync(args.decision, "utf8"));
  assertJsonSchema(state, stateSchema, "state");
  assertJsonSchema(decision, decisionSchema, "decision");
  validateStateSemantics(state, args.state);
  validateDecisionSemantics(decision);
} catch (error) {
  invalid(state, args.action, "INVALID_STATE", "valid-state-and-decision", error.message);
}

try {
  validateDecisionAdmission(state, decision, args.action);
  validateDecisionBinding(state, decision, args.action);
  validateScope(state, args.action);
  validateBudgets(state, args.action);
  validateCompletion(state, args.action);
  if (args.action === "validate-state" || args.action === "finalize") allow(state, args.action);
  if (args.action === "dispatch-role") dispatchRole(state, args);
  if (args.action === "run-check") runCheck(state, args);
  if (args.action === "extend-budget") extendBudget(state, args);
} catch (error) {
  invalid(state, args.action, "INVALID_STATE", "state-invariant", error.message);
}
