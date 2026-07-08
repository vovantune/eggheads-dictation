# Contributing to EGGHEADS Dictation

This repository is an EGGHEADS-maintained fork of OpenWhispr. Keep changes
small, reviewable, and easy to rebase or merge with upstream OpenWhispr.

## Fork workflow

- `origin` is this fork: `vovantune/eggheads-dictation`.
- `upstream` is the source project: `OpenWhispr/openwhispr`.
- Open EGGHEADS pull requests against `vovantune/eggheads-dictation` `main`.
- Do not open EGGHEADS product or CI pull requests against
  `OpenWhispr/openwhispr`.

When GitHub shows a pull request form for a branch in this fork, verify:

```text
base repository: vovantune/eggheads-dictation
base branch: main
head repository: vovantune/eggheads-dictation
compare branch: <your branch>
```

Use this compare URL shape for fork-internal PRs:

```text
https://github.com/vovantune/eggheads-dictation/compare/main...<branch>?expand=1
```

## Updating from upstream

```bash
git fetch upstream
git checkout main
git merge upstream/main
git push origin main
```

Keep upstream-related changes separate from EGGHEADS product changes when
possible. This keeps conflicts measurable instead of exciting.

### Local setup

| Requirement | Notes                                                                             |
| ----------- | --------------------------------------------------------------------------------- |
| Node.js     | Version pinned in [`.nvmrc`](../.nvmrc) (currently `24`). Use `nvm use` to match. |
| Install     | `npm install`                                                                     |
| Run dev     | `npm run dev`                                                                     |
| Lint        | `npm run lint`                                                                    |
| Format      | `npm run format`                                                                  |
| Build       | `npm run build` (or `build:mac` / `build:win` / `build:linux`)                    |

Platform-specific setup, local Whisper notes, and packaging details are
in [`README.md`](../README.md) and
[`LOCAL_WHISPER_SETUP.md`](../LOCAL_WHISPER_SETUP.md).

## Thanks

Thanks for taking the time to improve the EGGHEADS dictation client.
