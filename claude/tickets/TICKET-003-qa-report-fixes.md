# TICKET-003: QA-Report Fixes Pass (2026-04-25)

## Description
Resolve every bug, finding, and recommendation surfaced in `qa-screenshots/QA-REPORT.md` from the 2026-04-25 UI QA pass. The QA pass walked the wizard end-to-end across 1PL/2PL/3PL/RSM/PCM, exercised the projects/experiments/orgs/about pages, and captured screenshots in both light and dark modes. 17 distinct issues were addressed in 13 commits on `main`.

## Acceptance Criteria
- [x] BUG #1 — `df.mean()` no longer crashes on CSVs with non-numeric ID columns
- [x] BUG #3 — `/experiments` page populated after analysis runs (experiment-ownership row written)
- [x] BUG #4 — slug `pattern` regex no longer throws SyntaxError in Chrome
- [x] BUG #5 — `PolytomousItemParametersTable` no longer logs React key warning
- [x] SE column for 3PL/PCM/RSM labeled `N/A` with explanatory tooltip
- [x] Auth state persists across reloads / cross-origin nav
- [x] "Fit Different Model" button preserves dataset, lands on Model step
- [x] Item param table sorts in natural order (`item_2` before `item_10`)
- [x] 3PL `c`-parameter collapse warning banner fires correctly
- [x] MLflow experiment names sanitize `/` → `-`
- [x] Two latent bugs in `MLflowViewer` (key warning + drill-down) fixed
- [x] Two pre-existing TS errors cleared (`npx tsc --noEmit` clean)
- [x] All 27 backend tests pass

## Implementation Plan
See `docs/plans/2026-04-25-qa-report-fixes.md` for the task-by-task breakdown that drove this work.

## Commits (in order)
| SHA | Subject |
|---|---|
| `6b10d32` | fix(datasets): skip non-numeric columns in data_summary aggregations |
| `be31432` | fix(frontend): slug pattern regex + Fragment key warning |
| `9da8d63` | fix(auth): persist user + isAuthenticated to survive page reload |
| `50e6315` | fix(results): natural-order sort for item names |
| `020e56e` | feat(wizard): add 'Fit Different Model' button preserving dataset |
| `958f380` | fix(analysis): write Experiment ownership row on run (QA BUG #3) |
| `6da57c0` | fix(results): label SE as N/A with explanation for 3PL/PCM/RSM |
| `c2b467b` | feat(results): warn when 3PL guessing parameters collapse to prior |
| `699a661` | fix(mlflow): replace / with - in experiment names |
| `882948b` | fix(results): catch near-zero c values in 3PL collapse-warning predicate |
| `d03f880` | fix(experiments): align MLflowExperiment type with backend payload |
| `9e0d74b` | fix(types): clear two pre-existing TypeScript errors |
| `550c1d6` | chore(dev): align infra ports with backend/.env and add fix plan |

Range: `b31998f..550c1d6` (13 commits, all on `main`, all pushed to `origin/main`).

## Tests Added
- `backend/tests/test_data_summary_aggregation.py` — pandas numeric-only regression
- `backend/tests/test_api/test_analysis_experiment_ownership.py` — 5 unit tests covering ownership write idempotency and ownership semantics (user-owned vs org-owned)

## Verification
Two QA passes were performed:
1. **Initial pass** — discovered the issues listed in the QA report (`qa-screenshots/01-…48-…png` plus the original report).
2. **Verification pass** — drove the wizard end-to-end after fixes, replaced screenshots where UI changed, and uncovered the two latent bugs in `MLflowViewer.tsx` (which were then also fixed). Screenshots `49-…55-…png` document the verified post-fix behavior.

## Out of Scope (Logged for Future)
- Implementing real SE values for 3PL/PCM via girth bootstrap (path (a)) — would require either new Hessian math or expensive re-fit cycles. Path (b) "label N/A" was chosen instead.
- Tightening hardening on `docker-compose.dev.yml` (`no-new-privileges`, `read_only` + tmpfs). Currently suppressed via `.semgrepignore` for the dev compose only; revisit when production `docker-compose.yml` is touched.

## Priority
Medium

## Status
Done

## Notes
- Original QA-REPORT.md and all screenshots live in the **parent** `qa-screenshots/` directory (outside this repo's git tracking) since they predate the QA work landing in this repo. The implementation plan that codifies the work is committed at `docs/plans/2026-04-25-qa-report-fixes.md`.
- Working tree clean as of `550c1d6`.
- Backend port-shift convention now consistent: backend 8002, frontend 3002, MLflow 5002, Postgres 5433. Backend `.env` was the source of truth; the dev-compose file was brought into alignment.
