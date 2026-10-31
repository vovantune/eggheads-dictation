# Context Pack Template

Build this file before each subagent run. Include facts only; do not rely on previous chat memory.

## Original Task

<task>

## Approved Plan

<plan>

## Acceptance Criteria

<acceptance>

## Mode Decision

The user's direct word that started full planning, effects from `docs/agent-loop.md`, reasons, and required checks. Risk or a repository rule is not authorization.

<decision>

## Scope Capsule

Owner, source of truth, in-scope, out-of-scope, direct consumers, and rollback.

<scope>

## Constraints And Non-Goals

<constraints>

## Existing Analogue And Complexity Budget

For every proposed parser, protocol, durable journal/state, recovery path, or control layer, record:

- nearest working analogue, with its exact source/runtime evidence and the behavior it already covers;
- proved incompatibility that makes the analogue insufficient for this task;
- observed failure evidence or frequency, rather than a hypothetical label alone;
- occurrence cost if the failure occurs, and prevention cost in code, durable state, operations, and proof;
- the smallest stable alternative, including a named failure such as `busy` plus user retry when that is cheaper than prevention.

If the incompatibility or cost comparison is absent, the new mechanism is not approved by this Context Pack. Keep a named `mechanism` label in the findings ledger so successive findings can be compared.

## Scope Events

Record any change copied from an unrelated MR, branch, or consumer as scope contamination; it requires removal or an explicit scope decision before implementation continues.

## Current Loop State

<state>

## Workspace Snapshot

<snapshot>

## Current Diff

<diff>

## Touched Files

<files>

## Check Map

For each risk or contract: stable check id, exact command/procedure, failure mode caught, input snapshot, invalidation triggers, and status.

<check-map>

## Important Findings Ledger

<ledger>

Only findings whose severity is listed by current `gate.fail_on_severity` are blocking. Preserve unresolved `minor`/`nit` as non-blocking findings without using them alone to request a rerun.

## Role Instruction

<role-instruction>
