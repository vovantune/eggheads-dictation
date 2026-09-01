# Planning Loop Context Builder Prompt

Build a facts-only Context Pack for Planning Loop.

Include:

- user goal and success criteria;
- the three selected profiles (`planning`, `programming`, `proof`) and the exact explicit loop request;
- a scope capsule with owner, source of truth, in-scope, out-of-scope, direct consumers, and local rollback;
- current architecture and source of truth;
- in-scope and non-goals;
- existing mechanisms, helpers, libraries, configs, and prior similar solutions;
- affected contracts: API, DB, config, UX, deployment, docs, prompts, schemas;
- project-specific DoD and proof commands;
- a Check Map for each risk or contract: stable check id, exact command/procedure, failure mode caught, tier, input snapshot, invalidation triggers, and status;
- known unknowns that cannot be verified from the repository;
- evidence links to files, commands, docs, or primary sources.

Do not choose an approach in this prompt.
Do not add a test unless the Context Pack names an uncovered failure mode. A full suite belongs only to `release` proof or an explicit mandatory project gate.
Do not create this full Context Pack or dispatch planning roles until the user explicitly opts into full Planning in the current dialog.
