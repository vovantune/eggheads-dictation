const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const readJson = (relativePath) => JSON.parse(read(relativePath));
const profiles = (policy, scenario) => {
  const hard = new Set(
    Object.values(policy.planning.hard_effects).flatMap((group) => Object.keys(group))
  );
  const risks = new Set(Object.keys(policy.planning.risk_groups));
  const observedHard = [...scenario.hard_effects, ...scenario.unresolved_effects];
  assert.ok(observedHard.every((effect) => hard.has(effect)), `${scenario.id}: unknown hard effect`);
  assert.ok(scenario.risk_groups.every((risk) => risks.has(risk)), `${scenario.id}: unknown risk group`);

  const bounded = policy.planning.bounded_change.required_facts.every((fact) =>
    scenario.bounded_facts.includes(fact)
  );
  const riskCount = new Set(scenario.risk_groups).size;
  let planning;
  if (observedHard.length) planning = "full";
  else if (bounded) planning = scenario.direct_work && riskCount === 0 ? "lightweight" : "light";
  else if (riskCount >= policy.planning.full_min_independent_risk_groups) planning = "full";
  else planning = scenario.direct_work && riskCount === 0 ? "lightweight" : "light";

  const request = scenario.request_mode;
  const execution = scenario.execution_facts;
  const independence = execution.independence_need;
  let requiredProgramming = "direct";
  if (observedHard.length || independence === "full_independent_cycle") {
    requiredProgramming = "full";
  } else if (independence === "separation_of_duties") {
    requiredProgramming = "guarded";
  } else if (execution.resolved_full_planning_to_local_fix && planning === "full") {
    requiredProgramming = "guarded";
  } else if (independence === "independent_review") {
    requiredProgramming = "light";
  }

  const rank = { direct: 0, light: 1, guarded: 2, full: 3 };
  let programming = requiredProgramming;
  let decision = "ALLOW";
  let reasonCode = "PROFILE_ADMITTED";
  let proposedProgrammingProfile = null;
  let exit = 0;
  if (request === "light-programming-loop" && rank[requiredProgramming] > rank.light) {
    programming = "light";
    decision = "HUMAN_DECISION_REQUIRED";
    reasonCode = "LIGHT_PROFILE_CEILING";
    proposedProgrammingProfile = requiredProgramming;
    exit = 2;
  } else if (["full-programming-loop", "full-qa-until-pass"].includes(request)) {
    programming = "full";
  } else if (
    ["programming-loop", "light-programming-loop"].includes(request) &&
    rank[programming] < rank.light
  ) {
    programming = "light";
  }
  return {
    planning,
    programming,
    proof: scenario.proof_signal,
    decision,
    reason_code: reasonCode,
    proposed_programming_profile: proposedProgrammingProfile,
    exit,
  };
};

test("portable cases match all Adaptive Loop v3 profiles", () => {
  const policy = readJson(".ai-loop/gate-policy.json");
  const cases = readJson(".ai-loop/gate-cases.json");
  assert.equal(policy.version, 3);
  assert.equal(cases.policy_version, 3);
  for (const scenario of cases.cases) {
    assert.deepEqual(profiles(policy, scenario), scenario.expected, scenario.id);
  }
  assert.deepEqual(
    new Set(cases.cases.map((scenario) => scenario.expected.planning)),
    new Set(["lightweight", "light", "full"])
  );
  assert.deepEqual(
    new Set(cases.cases.map((scenario) => scenario.expected.programming)),
    new Set(["direct", "light", "guarded", "full"])
  );
  assert.deepEqual(
    new Set(cases.cases.map((scenario) => scenario.expected.proof)),
    new Set(["static", "focused", "contract", "release"])
  );
  for (const entry of cases.negative_cases) {
    assert.ok(["classification", "guard", "policy"].includes(entry.kind), entry.id);
    assert.equal(typeof entry.input, "object", entry.id);
    assert.equal(typeof entry.expected, "object", entry.id);
    assert.ok("decision" in entry.expected, entry.id);
    assert.ok("reason_code" in entry.expected, entry.id);
    assert.ok("exit" in entry.expected, entry.id);
    if (entry.kind === "classification") {
      assert.deepEqual(profiles(policy, entry.input), entry.expected, entry.id);
    }
  }
  assert.ok(
    cases.negative_cases.some((entry) => entry.id === "sql-orm-bounded-is-not-hard-by-name")
  );
  assert.ok(
    cases.negative_cases.some((entry) => entry.id === "unresolved-hard-effect-precedes-bounded-claim")
  );
  assert.ok(
    policy.constraints.some((constraint) => constraint.includes("exact-wording test for ordinary prose"))
  );
});

test("config wires portable policy, prompts, state v2, and guard", () => {
  const config = read(".ai-loop/config.yml");
  const paths = [
    ".ai-loop/gate-policy.json",
    ".ai-loop/gate-cases.json",
    ".ai-loop/schemas/decision.schema.json",
    ".ai-loop/schemas/loop-state.schema.json",
    ".ai-loop/bin/guard.mjs",
    ".ai-loop/bin/json-schema-validator.mjs",
    ".ai-loop/prompts/programming/compact-reviewer.md",
    ".ai-loop/prompts/shared/context-pack.md",
    ".ai-loop/prompts/planning/context-builder.md",
    ".ai-loop/prompts/planning/delta-review.md",
    ".ai-loop/prompts/planning/synthesis.md",
  ];
  for (const relativePath of paths) {
    assert.ok(fs.existsSync(path.join(root, relativePath)), relativePath);
  }
  assert.match(config, /^planning_gate_policy: 3$/m);
  assert.match(config, /admission_guard: \.ai-loop\/bin\/guard\.mjs/);
  assert.match(config, /compact_reviewer: \.ai-loop\/prompts\/programming\/compact-reviewer\.md/);

  const schema = readJson(".ai-loop/schemas/loop-state.schema.json");
  assert.equal(schema.properties.schema_version.const, 2);
  const decisionSchema = readJson(".ai-loop/schemas/decision.schema.json");
  assert.equal(decisionSchema.properties.policy_version.const, 3);
  for (const field of [
    "decision_hash",
    "profiles",
    "scope",
    "role_assignments",
    "budget",
    "extensions",
    "checks",
    "activity",
  ]) {
    assert.ok(schema.required.includes(field), field);
  }
  assert.equal(schema.properties.budget.properties.base_max_iterations.const, 5);
  assert.equal(schema.properties.budget.properties.light_review_passes.maximum, 2);
});

test("structured full QA policy is enforced by the guard matrix", () => {
  const policy = readJson(".ai-loop/gate-policy.json");
  const cases = readJson(".ai-loop/gate-cases.json");
  assert.match(policy.programming.rules.full, /fixer/);
  assert.match(policy.programming.rules.full, /fresh full-QA/);
  assert.deepEqual(
    cases.negative_cases.find((entry) => entry.id === "preserve-full-fixer-fresh-qa").expected,
    { decision: "HUMAN_DECISION_REQUIRED", reason_code: "LATEST_QA_NOT_PASSING", exit: 2 }
  );
});

test("native entrypoint and docs preserve OpenWhispr ownership and DoD", () => {
  assert.equal(fs.readlinkSync(path.join(root, "AGENTS.md")), "CLAUDE.md");
  const entrypoint = read("CLAUDE.md");
  const planning = read("docs/agent-planning-loop.md");
  const programming = read("docs/agent-programming-loop.md");
  assert.match(entrypoint, /Planning: lightweight\|light\|full/);
  assert.match(entrypoint, /Programming: direct\|light\|guarded\|full/);
  assert.match(entrypoint, /state v2/);
  assert.match(entrypoint, /\.ai-loop\/bin\/guard\.mjs/);
  assert.match(planning, /project-specific OpenWhispr DoD/);
  assert.match(planning, /Node 24/);
  assert.match(planning, /Electron main\/preload\/IPC contract/);
  assert.match(planning, /Native sidecar\/bundled binary/);
  assert.match(programming, /project-specific OpenWhispr entrypoints/);
});

test("full approval remains file-backed", () => {
  for (const source of [
    read("CLAUDE.md"),
    read("docs/agent-planning-loop.md"),
    read("docs/agent-programming-loop.md"),
    read(".ai-loop/prompts/planning/handoff.md"),
  ]) {
    assert.match(source, /PLEASE IMPLEMENT THIS PLAN:/);
  }
  assert.match(read("docs/agent-programming-loop.md"), /input\/approved-plan\.md/);
});
