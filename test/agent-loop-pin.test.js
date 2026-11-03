const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
// docs/agent-loop.md is byte-identical across repositories: change it everywhere and update this hash.
const AGENT_LOOP_SHA256 = "c4a63969e4fd50981b44d5ad06f0f8bc80bc565c8b24121af855e92f436c68e5";

test("agent loop keeps the shared version", () => {
  const digest = crypto.createHash("sha256").update(fs.readFileSync(path.join(root, "docs/agent-loop.md"))).digest("hex");
  assert.equal(digest, AGENT_LOOP_SHA256);
});

test("reviewer prompt keeps the gate", () => {
  const prompt = fs.readFileSync(path.join(root, ".ai-loop/prompts/qa-reviewer.md"), "utf8");
  for (const phrase of ["fresh independent review from the original task", "Re-derive the mode and effects", "at least `major`", "reviewed SHA", "finding means `fail`"]) {
    assert.ok(prompt.includes(phrase), phrase);
  }
});
