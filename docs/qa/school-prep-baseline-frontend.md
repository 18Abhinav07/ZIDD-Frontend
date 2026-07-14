---
created: 2026-07-13
project: zidd
ecosystem: full-stack
tags: [school-prep, baseline, recovery, frontend]
---

# School Prep Frontend Baseline

Backlinks: [[public/school-prep-visual-aid]] [[src/app/school/page]]

## Repository State

- Branch: `school-prep`
- HEAD: `186ceba71d19777eedbcdbf84aaafc132706e26d`
- Captured before canonical runtime implementation began.
- Live worktree was not reset, cleaned, or checked out.

## Recovery Artifacts

Directory: `/tmp/zidd-school-baseline-ee7a4b3-186ceba`

| Artifact | SHA-256 |
| --- | --- |
| `frontend-tracked.patch` | `975dab5079200f605bb5c80a4303ad2a61bfe940c259ba51d4159cae627152f0` |
| `frontend-status.txt` | `6b763fa73130b49c9cbc0b61e2c18bfea7de1cc955c5333f765e34d92accbf4f` |
| `frontend-untracked.tar` | `f720fa11f65cc6456d471a0332601eba689d05fef4a24a16c442c693e7f3481d` |

Restore verification:

- `git apply --check` passed against a clean archive of HEAD.
- The untracked archive contains 86 entries.
- The tracked patch and untracked archive were restored into a clean HEAD archive.
- Runtime School file hashes matched the live capture exactly; manifest SHA-256: `0e8eab246b6d11f0ad91c32e680af3654c32b049fde5d4ffd45b06b2c4bc6078`.

## Ownership Classification

School-owned:

- `src/app/school/**`, `src/app/api/school/**`;
- `src/components/school/**`, `src/components/learning/**`;
- `src/services/schoolRebuild.ts`, `src/lib/school*`;
- School Playwright configs/tests/scripts and `public/school-prep-visual-aid.html`;
- `/subjects/v2`, `/subjects/v3`, and School redirect hunks.

Shared, hunk review required:

- `package.json`, `package-lock.json`, `next.config.mjs`, `tsconfig.json`;
- `src/app/globals.css`, `src/app/profile/page.tsx`, `src/app/career/page.tsx`;
- `src/components/shared/AppHeader.tsx`, `src/lib/avatars.ts`;
- `src/middleware.ts`, `src/services/api.ts`, `src/services/me.ts`.

Career/unrelated, do not stage for School tasks:

- simulator, Career session, tutor, assessment, and paywall hunks without a School-owned dependency;
- Career/GD/Interview scripts and components.

No baseline commit is created until School-owned staging can be reviewed without capturing unrelated shared-file hunks.
