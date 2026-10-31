const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const readJson = (relativePath) => JSON.parse(read(relativePath));
const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));

const walk = (relativePath) => {
  const absolute = path.join(root, relativePath);
  if (!fs.existsSync(absolute)) return [];
  if (fs.statSync(absolute).isFile()) return [relativePath];
  return fs
    .readdirSync(absolute)
    .filter((name) => !["runs", "node_modules"].includes(name))
    .flatMap((name) => walk(path.join(relativePath, name)));
};

test("agent loop defines modes, stop rules and critical proofs", () => {
  const loop = read("docs/agent-loop.md");

  for (const mode of ["direct", "light", "critical"]) {
    assert.match(loop, new RegExp(`^\\| \`${mode}\` \\|`, "m"));
  }
  for (const stopRule of [
    "Лимит — 5 проходов QA",
    "новый чат и сжатие контекста его не обнуляют",
    "Та же находка или тот же механизм вернулись",
    "После 10 проходов нужен другой подход",
    "Новый субагент для QA недоступен",
  ]) {
    assert.ok(loop.includes(stopRule), stopRule);
  }
  for (const proof of [
    "state-contract-proof",
    "external-contract-proof",
    "authz-isolation-proof",
    "accounting-proof",
    "destructive-operation-proof",
    "provider-routing-proof",
    "runtime-ownership-proof",
    "cross-service-contract-proof",
    "rollback-proof",
  ]) {
    assert.match(loop, new RegExp(`^\\| .+ \\| \`${proof}\` \\|$`, "m"));
  }
});

test("workflow documents are routed from the rules file", () => {
  const rules = read("CLAUDE.md");

  for (const document of ["docs/agent-loop.md", "docs/agent-planning-loop.md"]) {
    assert.ok(rules.includes(`\`${document}\``), document);
    assert.ok(exists(document), document);
  }
  assert.ok(read("docs/agent-loop.md").includes("`.ai-loop/prompts/qa-reviewer.md`"));
});

test("full planning runs only on the user's direct word", () => {
  const firstParagraph = read("docs/agent-planning-loop.md").split("\n\n")[1];

  assert.ok(firstParagraph.includes("прямому слову пользователя"));
  assert.ok(firstParagraph.includes("`docs/agent-loop.md`"));
});

test("plan button saves the plan before implementation", () => {
  for (const file of ["docs/agent-planning-loop.md", ".ai-loop/prompts/planning/handoff.md"]) {
    const text = read(file);
    assert.ok(text.includes("PLEASE IMPLEMENT THIS PLAN:"), file);
    assert.ok(text.includes("plans/<task-slug>.md"), file);
    assert.ok(text.includes("docs/agent-loop.md"), file);
  }
});

test("QA reviewer prompt is a full markdown review under this repository's rules", () => {
  const reviewer = read(".ai-loop/prompts/qa-reviewer.md");

  assert.ok(reviewer.includes("`docs/agent-loop.md`"));
  assert.ok(reviewer.includes("fresh independent review from the original task"));
  assert.ok(reviewer.includes("`CLAUDE.md`"));
  assert.ok(!reviewer.includes("schema"));
});

test("config references existing runtime files and wires every prompt and schema", () => {
  const config = read(".ai-loop/config.yml");
  const paths = [...config.matchAll(/^\s*\w+:\s+((?:\.ai-loop|docs)\/\S+\.\w+)\s*$/gm)].map(
    (match) => match[1]
  );

  for (const required of [
    "docs/agent-loop.md",
    "docs/agent-planning-loop.md",
    ".ai-loop/prompts/qa-reviewer.md",
  ]) {
    assert.ok(paths.includes(required), required);
  }
  assert.deepEqual(
    paths.filter((file) => !exists(file)),
    []
  );
  for (const file of [...walk(".ai-loop/prompts"), ...walk(".ai-loop/schemas")]) {
    assert.ok(config.includes(file), file);
  }
});

test("subagent results cover planning roles only", () => {
  const schema = readJson(".ai-loop/schemas/subagent-result.schema.json");
  const contract = read(".ai-loop/prompts/planning/subagent-contract.md");

  assert.deepEqual([...schema.properties.role.enum].sort(), ["planner", "planning_reviewer"]);
  for (const [role, key] of [
    ["planner", "planning"],
    ["planning_reviewer", "planning_review"],
  ]) {
    assert.ok(schema.properties[key], key);
    assert.ok(contract.includes(`role: "${role}"`), role);
  }
});

test("final result requires handoff only for an approved full plan", () => {
  const schema = readJson(".ai-loop/schemas/planning-final-result.schema.json");

  assert.deepEqual([...schema.properties.gate.enum].sort(), ["blocked-no-subagents", "full"]);
  assert.deepEqual(schema.properties.handoff.required, ["approved_plan_path"]);
  assert.ok(!schema.required.includes("handoff"));
  const approved = schema.allOf.filter((rule) => rule.if.properties?.status?.const === "approved");
  assert.deepEqual(
    approved.map((rule) => rule.then),
    [{ required: ["handoff"] }]
  );
  const exclusive = schema.allOf.filter((rule) => rule.if.not);
  assert.deepEqual(
    exclusive.map((rule) => rule.then),
    [{ not: { required: ["handoff"] } }]
  );
});

test("planning schemas require evidence and competition", () => {
  const planner = readJson(".ai-loop/schemas/planning-result.schema.json");
  const final = readJson(".ai-loop/schemas/planning-final-result.schema.json");

  assert.equal(planner.properties.evidence.minItems, 1);
  assert.equal(planner.properties.proof_needed.minItems, 1);
  assert.ok(JSON.stringify(planner.allOf ?? []).includes("reuse_lookup_log"));
  assert.equal(final.properties.rejected_alternatives.minItems, 1);
});

test("loop files name nothing from other repositories", () => {
  // docs/agent-loop.md одинаков во всех репозиториях и намеренно не сверяется здесь.
  const foreign = new RegExp(
    [
      "\\.codex/rules",
      "php-" + "eggheads",
      "open-code-" + "ai",
      "development-" + "invariants",
      "Open" + "Code",
      "\\bPHP\\b",
      "[Tt]enant UX",
    ].join("|")
  );
  const files = [...walk(".ai-loop"), "docs/agent-planning-loop.md"];

  assert.deepEqual(
    files.filter((file) => foreign.test(read(file))),
    []
  );
});

test("no tracked reference to removed loop paths", () => {
  // Строки собраны из частей, чтобы тест сам не был ссылкой. plans/ не входит в обход: это история.
  const removed = new RegExp(
    [
      "guard\\.mjs",
      "ai-loop-" + "guard",
      "ai_loop_" + "guard",
      "gate-" + "policy",
      "gate-" + "cases",
      "agent-" + "programming-loop",
      "prompts/" + "programming",
      "json-schema-" + "validator",
      "(?:decision|loop-state|qa-result)\\.schema\\.json",
    ].join("|")
  );
  const files = ["CLAUDE.md", "README.md", "package.json", ".ai-loop", ".github", "docs", "test"]
    .flatMap(walk)
    .filter((file) => /\.(?:json|md|mdc|mjs|js|yml)$/.test(file));

  assert.ok(files.length > 0);
  assert.deepEqual(
    files.filter((file) => removed.test(read(file))),
    []
  );
});
