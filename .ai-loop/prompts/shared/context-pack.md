# Context Pack Template

Build this file before each subagent run. Include facts only; do not rely on previous chat memory.

## Original Task

<task>

## Approved Plan

<plan>

## Acceptance Criteria

<acceptance>

## Profile Decision

Planning, Programming, Proof, exact explicit loop request, effects, unresolved effects, reasons, and required checks. For either full profile, include the current-dialog user opt-in; risk or a repository rule is not authorization.

<decision>

## Scope Capsule

Owner, source of truth, in-scope, out-of-scope, direct consumers, rollback, and approved scope hash.

<scope>

## Constraints And Non-Goals

<constraints>

## Current Loop State

<state>

## Workspace Snapshot

<snapshot>

## Current Diff

<diff>

## Touched Files

<files>

## Check Map

For each risk or contract: stable check id, exact command/procedure, failure mode caught, tier, input snapshot, invalidation triggers, and status.

<check-map>

## Important Findings Ledger

<ledger>

Only findings whose severity is listed by current `gate.fail_on_severity` are blocking. Preserve unresolved `minor`/`nit` as non-blocking findings without using them alone to request a fixer.

## Role Instruction

<role-instruction>
