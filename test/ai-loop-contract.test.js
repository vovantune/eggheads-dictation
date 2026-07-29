const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const readJson = (relativePath) => JSON.parse(read(relativePath));

const policy = readJson(".ai-loop/gate-policy.json");
const regression = readJson(".ai-loop/gate-cases.json");

function classifyGate(scenario) {
  if (scenario.hard_effects.length > 0 || scenario.unknown_hard_effects.length > 0) {
    return "full";
  }

  const bounded = policy.bounded_change.required_facts.every((fact) =>
    scenario.bounded_facts.includes(fact)
  );
  const riskCount = new Set(scenario.risk_groups).size;

  if (scenario.direct_work && riskCount === 0) {
    return "lightweight";
  }
  if (bounded) {
    return "light";
  }
  if (riskCount >= policy.thresholds.full_min_independent_risk_groups) {
    return "full";
  }
  return "light";
}

test("portable Gate v2 cases classify by effects", () => {
  assert.equal(regression.policy_version, policy.version);

  const knownHardEffects = new Set([
    ...Object.keys(policy.hard_effects.material),
    ...Object.keys(policy.hard_effects.boundary),
  ]);
  const knownRiskGroups = new Set(Object.keys(policy.risk_groups));

  for (const scenario of regression.cases) {
    for (const effect of [...scenario.hard_effects, ...scenario.unknown_hard_effects]) {
      assert.ok(knownHardEffects.has(effect), `${scenario.id}: unknown hard effect ${effect}`);
    }
    for (const group of scenario.risk_groups) {
      assert.ok(knownRiskGroups.has(group), `${scenario.id}: unknown risk group ${group}`);
    }
    assert.equal(classifyGate(scenario), scenario.expected_gate, scenario.id);
  }
});

test("Gate v2 keeps keyword-adjacent local work cheap and protected effects full", () => {
  const expected = new Map(
    regression.cases.map((scenario) => [scenario.id, scenario.expected_gate])
  );

  for (const id of ["auth-copy-only", "provider-label-only", "docs-typo"]) {
    assert.equal(expected.get(id), "lightweight", id);
  }
  for (const id of [
    "quota-window-label",
    "deployment-timeout-local-config",
    "internal-payload-normalization",
    "local-session-state-fix",
  ]) {
    assert.equal(expected.get(id), "light", id);
  }
  for (const id of [
    "database-migration",
    "auth-validation",
    "provider-routing",
    "public-payload",
    "deployment-topology",
    "unknown-auth-effect",
  ]) {
    assert.equal(expected.get(id), "full", id);
  }
});

test("config wires the portable policy and regression matrix", () => {
  const config = read(".ai-loop/config.yml");

  for (const relativePath of [
    ".ai-loop/gate-policy.json",
    ".ai-loop/gate-cases.json",
    "docs/agent-planning-loop.md",
    ".ai-loop/schemas/planning-final-result.schema.json",
    ".ai-loop/prompts/planning/synthesis.md",
  ]) {
    assert.match(config, new RegExp(relativePath.replace(/[.-]/g, "\\$&")));
    assert.ok(fs.existsSync(path.join(root, relativePath)), relativePath);
  }
  assert.match(config, /^planning_gate_policy: 2$/m);
});

test("light result is compact while full approval still requires handoff", () => {
  const schema = readJson(".ai-loop/schemas/planning-final-result.schema.json");
  const ruleForGate = (gate) =>
    schema.allOf.find((rule) => rule.if?.properties?.gate?.const === gate);
  const light = ruleForGate("light");
  const full = ruleForGate("full");
  const approvedFull = schema.allOf.find(
    (rule) =>
      rule.if?.properties?.gate?.const === "full" &&
      rule.if?.properties?.status?.const === "approved"
  );
  const exclusiveHandoff = schema.allOf.find(
    (rule) =>
      rule.if?.not?.properties?.status?.const === "approved" &&
      rule.if?.not?.properties?.gate?.const === "full"
  );
  const blockedNoSubagents = ruleForGate("blocked-no-subagents");

  assert.deepEqual(light.then.required, [
    "recommended_approach",
    "source_of_truth",
    "implementation_slices",
    "proof_plan",
  ]);
  assert.deepEqual(light.then.not.required, ["handoff"]);
  assert.equal(light.then.properties.implementation_slices.maxItems, 5);
  assert.equal(light.then.properties.proof_plan.maxItems, 3);
  assert.ok(full.then.required.includes("rejected_alternatives"));
  assert.ok(full.then.required.includes("project_dod"));
  assert.deepEqual(approvedFull.then.required, ["handoff"]);
  assert.deepEqual(exclusiveHandoff.then.not.required, ["handoff"]);
  assert.equal(blockedNoSubagents.then.properties.status.const, "blocked");
});

test("canonical entrypoint keeps light cheap and preserves OpenWhispr DoD", () => {
  assert.equal(fs.readlinkSync(path.join(root, "AGENTS.md")), "CLAUDE.md");

  const entrypoint = read("CLAUDE.md");
  const protocol = read("docs/agent-planning-loop.md");
  const synthesis = read(".ai-loop/prompts/planning/synthesis.md");
  const projectDod = read(".ai-loop/prompts/planning/reviewer-project-dod.md");

  assert.match(entrypoint, /\.ai-loop\/gate-policy\.json/);
  assert.match(entrypoint, /`light` means a compact single-agent plan/);
  assert.match(entrypoint, /Only `full` uses `docs\/agent-planning-loop\.md`/);
  assert.match(entrypoint, /For `light`, it is permission to implement in the current thread/);
  assert.doesNotMatch(entrypoint, /approved `light`\/`full` plans/);

  assert.match(protocol, /Имена файлов.*сами по себе не являются triggers/);
  assert.match(protocol, /single-agent plan на 1–5 шагов и 1–3 focused checks/);
  assert.match(protocol, /Для OpenWhispr учитывай Node 24/);
  assert.match(protocol, /Electron main\/preload\/IPC contract/);
  assert.match(protocol, /Native sidecar\/bundled binary/);

  assert.match(synthesis, /For `gate: "light"`/);
  assert.match(
    synthesis,
    /For `gate: "full"`, synthesize independent planner and reviewer outputs/
  );
  assert.match(synthesis, /do not run council synthesis/);
  assert.match(projectDod, /focused `node --test test\/\.\.\.`/);
  assert.match(projectDod, /platform-specific build\/download wiring/);
});
