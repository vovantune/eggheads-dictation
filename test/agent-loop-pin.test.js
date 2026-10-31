const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
// docs/agent-loop.md is byte-identical across repositories: change it everywhere and update this hash.
const AGENT_LOOP_SHA256 = "e4060dbdcac01dca440e2efcf96b80d99db51ae2f30f490545c6615d2771a4a7";

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
