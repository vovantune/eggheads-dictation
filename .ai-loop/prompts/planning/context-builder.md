# Planning Loop Context Builder Prompt

Build a facts-only Context Pack for Planning Loop.

Include:

- user goal and success criteria;
- the user's direct word that started full planning;
- a scope capsule with owner, source of truth, in-scope, out-of-scope, direct consumers, and local rollback;
- current architecture and source of truth;
- in-scope and non-goals;
- existing mechanisms, helpers, libraries, configs, and prior similar solutions;
- affected contracts: API, DB, config, UX, deployment, docs, prompts, schemas;
- project-specific DoD and proof commands;
- a Check Map for each risk or contract: stable check id, exact command/procedure, failure mode caught, input snapshot, invalidation triggers, and status;
- when a change has an effect from the `critical` table in `docs/agent-loop.md`, a mandatory Check Map entry for its named proof;
- known unknowns that cannot be verified from the repository;
- evidence links to files, commands, docs, or primary sources.

Do not choose an approach in this prompt.
Do not add a test unless the Context Pack names an uncovered failure mode. A full suite belongs to the finished candidate or an explicit mandatory project gate.
Do not create this Context Pack or dispatch planning roles until the user explicitly asks for full planning in the current dialog.
