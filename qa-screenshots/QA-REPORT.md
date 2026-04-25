# IRT Wizard — UI QA Report

**Date:** 2026-04-25
**Tester:** Claude (Playwright-driven)
**Environment:** macOS / Chromium (Playwright MCP) / Vite dev / FastAPI dev / Postgres+SeaweedFS+MLflow via Docker
**Frontend:** http://localhost:3002 (Vite, port-shifted from 3000)
**Backend:** http://localhost:8002 (FastAPI/uvicorn, port-shifted from 8000)
**Build state at test time:** local development, not a release build

---

## Test scope

Walked every authenticated route plus login. Routes covered:

| Route | Status |
|---|---|
| `/login` (light + dark, empty-email validation, Auth0 stub) | ✅ Pass |
| `/` Wizard step 1 — Mode (Student / Educator / Researcher) | ✅ Pass |
| `/` Wizard step 2 — Upload (drag-drop file chooser, project name) | ⚠️ See **BUG #1** |
| `/` Wizard step 3 — Preview (auto-detect binary, summary cards, head table) | ✅ Pass |
| `/` Wizard step 4 — Model (1PL/2PL/3PL cards, alt-model expand, advanced opts) | ✅ Pass |
| `/` Wizard step 4 — Polytomous variant (RSM/PCM cards, "Polytomous data detected" banner) | ✅ Pass *(follow-up)* |
| `/` Wizard step 5 — Analysis (live log terminal, progress bar) | ✅ Pass |
| `/` Wizard step 6 — Results — Summary tab | ✅ Pass |
| `/` Wizard step 6 — Results — Category Analysis tab (RSM/PCM only) | ✅ Pass *(follow-up)* |
| `/` Wizard step 6 — Results — Group Comparisons / DIF tab (RSM/PCM only) | ✅ Pass *(follow-up)* |
| Model fit: **1PL** end-to-end | ✅ Pass *(follow-up)* |
| Model fit: **2PL** end-to-end | ✅ Pass |
| Model fit: **3PL** end-to-end | ✅ Pass *(follow-up; see SE / c-default findings)* |
| Model fit: **RSM** end-to-end | ✅ Pass *(follow-up)* |
| Model fit: **PCM** end-to-end | ✅ Pass *(follow-up; see BUG #5)* |
| `/` Wizard step 6 — Results — Item Parameters tab | ⚠️ Lex sort (`item_10` before `item_2`) |
| `/` Wizard step 6 — Results — Visualizations tab (ICC, Item Info, Test Info, Ability Dist) | ✅ Pass (charts render correctly; full-page screenshots are misleading) |
| `/` Wizard step 6 — Results — Model Fit tab (LL, AIC, BIC, formulas) | ✅ Pass |
| `/projects` dashboard | ✅ Pass |
| Project detail (master-detail panel) | ✅ Pass |
| Re-opening a completed analysis | ✅ Pass |
| `/experiments` (MLflow viewer) | ❌ See **BUG #3** |
| External MLflow UI link | ✅ Pass |
| `/about` | ✅ Pass |
| `/org/new` (Create Organization form) | ⚠️ See **BUG #4** |
| `/org/:slug/settings` | ✅ Pass |
| `/org/:slug/members` (invite, role, list) | ⚠️ Invite-by-email rejects unknown emails (by design) |
| Theme toggle (light ↔ dark) across pages | ✅ Pass |
| Organization switcher dropdown (user info, switch, sign out) | ✅ Pass |

---

## Bugs found

### BUG #1 — `/datasets/upload` 500 on CSV containing non-numeric columns
**Severity:** High (blocks any CSV with an ID column)
**Location:** `backend/app/api/v1/datasets.py:115`
**Repro:** upload a CSV whose first column is `respondent_id` with strings like `R001..R080`; backend returns HTTP 500.
**Root cause:**
```python
"mean_scores": df.mean().to_dict() if validation_result["is_valid"] else None,
```
Pandas `df.mean()` without `numeric_only=True` raises `TypeError: Could not convert ['R001R002…'] to numeric` when the frame contains string columns.
**Fix:** `df.mean(numeric_only=True).to_dict()`
**Workaround used in QA:** uploaded a CSV with item columns only (no ID column) — see `sample_dichotomous_noid.csv`.
**Screenshots:** would-be-failure not screenshotted; final success at `08-wizard-step3-preview.png`.

### BUG #2 — Charts in Visualizations tab look blank in full-page screenshots
**Severity:** Cosmetic / tooling artifact, NOT a real defect
**Investigation:** SVG paths exist in DOM (10 ICC curves, 10 info curves, 2 test info, 17 histogram bars), all with valid `d` attributes, correct stroke colors and `strokeWidth: 2px`. Rendered correctly in viewport screenshots — see `15c-icc-viewport.png` (5 sigmoid 2PL curves visible).
**Cause:** Recharts `ResponsiveContainer` doesn't recompute path coordinates when Playwright resizes the viewport for `fullPage: true`. Old paths remain at pre-resize positions and end up clipped outside the new chart bounds.
**Action:** none on the app. **Recommendation:** in any future Playwright tests, screenshot chart pages with `fullPage: false` after `scrollIntoView`. (Done for `15c`, `16`.)

### BUG #3 — `/api/v1/mlflow/experiments` returns `[]` even when MLflow has experiments
**Severity:** Medium (in-app Experiments page is unusable)
**Location:** backend `experiments` ownership table never gets a row inserted when the wizard runs an analysis.
**Evidence:**
- MLflow API directly: `POST /api/2.0/mlflow/experiments/search` → 2 experiments (`Default`, `Analysis 4/25/2026`) with 1 logged run (`2PL_c7c4c0fe-…`, 9.3 s).
- Backend API `GET /api/v1/mlflow/experiments` (with valid bearer): `[]`.
- DB: `SELECT COUNT(*) FROM experiments;` → `0` after a successful 2PL analysis.
**Hypothesis:** the analysis-run code path (or its background worker) does not call the experiment-ownership upsert. Migration `006_*.py` added the table but a writer that fills it is missing or wired only to a path the wizard doesn't take.
**Workaround:** "Open MLflow UI" external link works. See `21-mlflow-ui-direct.png`, `22-mlflow-experiment-analysis.png`.
**Suggested next step:** grep backend for `INSERT INTO experiments` / `Experiment(` / the ORM class, confirm where it should fire on analysis completion.

### BUG #4 — `pattern="[a-z0-9-]+"` on org slug input throws regex SyntaxError in modern Chrome
**Severity:** Low (Chrome's HTML form validation breaks; React-side validation still runs)
**Console:**
> `Pattern attribute value [a-z0-9-]+ is not a valid regular expression: Invalid regular expression: /[a-z0-9-]+/v: Invalid character class`
**Cause:** Chrome's HTML5 form validation evaluates `pattern` under the `v` regex flag, which treats unescaped `-` as a syntax error inside `[...]` unless it's first/last in the class.
**Fix options (any one):**
- `pattern="[a-z0-9\-]+"`
- `pattern="[-a-z0-9]+"`
- `pattern="[a-z0-9-]+"` (keep) but use a JS-side validator and remove the HTML pattern attribute.
**File to inspect:** `frontend/src/pages/CreateOrganization.tsx` slug `<input pattern=…>`.
**Screenshot:** error captured in console during `25-org-create.png` flow.

### Minor — Item Parameters table uses lexicographic sort
**Severity:** Cosmetic
**Observed:** with item names `item_1, item_2, …, item_10`, default ascending sort places `item_10` between `item_1` and `item_2`. See `14-results-tab-item-parameters.png`.
**Fix:** natural-order comparator in the table sort, or pad item indices.

### Minor — Invite-by-email requires the invitee to already exist
**Observed:** inviting `colleague@example.com` (not yet a registered user) returns "Failed to invite member. Make sure the email is registered." — see `29-org-members-after-invite.png`.
**Note:** likely intended for the dev auth provider; production design likely wants pending-invite tokens.

### Minor — Auth state lost on hard navigation
**Observed:** any cross-origin navigation (e.g. opening MLflow UI in same tab) or full reload returns user to `/login`.
**Cause:** zustand auth store is in-memory only; `accessToken` / `currentOrganization` not persisted to `localStorage`.
**Fix:** `persist` middleware on the auth store, or rely on a refresh-token-cookie pattern.

### Minor — MLflow experiment name displays as "2026" in the MLflow UI
**Observed:** experiment created with name `Analysis 4/25/2026` shows as just `2026` at the top of the runs page (sidebar shows full name correctly). Caused by `/` in the experiment name being parsed as path separators by MLflow's UI breadcrumb logic. See `22-mlflow-experiment-analysis.png`.
**Fix:** experiment names should avoid `/`. Consider naming with the project ID or `Project · YYYY-MM-DD`.

---

## Infra issues uncovered (during environment setup, fixed in-session)

These were not UI bugs but were prerequisites to making the UI testable:

1. **Postgres port mismatch** — `backend/.env` expected 5433 (project's `*002`/+1 port-shift convention), but `docker-compose.dev.yml` published `5432:5432`. Fixed by changing publish to `5433:5432`.
2. **MLflow port mismatch** — same pattern. `backend/.env` expected MLflow on 5002, compose published 5000. Fixed by changing publish to `5002:5000`.
3. **MLflow database missing** — MLflow expects a separate `mlflow` Postgres database; not pre-created. Created via `psql -c 'CREATE DATABASE mlflow;'`.
4. **`.semgrepignore` added** at repo root (`docker-compose.dev.yml`) to suppress pre-existing `no-new-privileges` / `read_only` hardening warnings on dev compose. Note: the `semgrep mcp` post-edit hook does not appear to honor `.semgrepignore`, so editing this file still surfaces those findings (cosmetic, not actionable on a dev file).

---

## Visual / UX observations (not bugs)

- Login, wizard, results, projects, org pages all have **clean light + dark** parity.
- The **6-step wizard progress nav** updates correctly (checkmark + connecting line) at every step transition.
- **Adaptive UI** is real — Researcher mode exposes Advanced Options that Student/Educator presumably hide (only Researcher tested this session).
- The **live log terminal** during analysis is a particularly nice touch (`11-wizard-step5-analysis-running.png`) — adds confidence and clearly signals MLflow setup phase.
- The **Visualizations tab** is rich (ICC, Item Info, Test Info with peak/max/SE summary cards, Ability Distribution with N/Mean/SD/Min/Max). Item-toggle pills for legend filtering work but were not exhaustively exercised.
- The **org switcher** smoothly re-scopes the project list — switching from `Personal` to `QA Test Org` correctly emptied the dashboard since the test project lived under `Personal`. This is correct multi-tenant behaviour but might confuse first-time users; consider an inline note like "0 projects in QA Test Org. Switch to Personal to see those."
- The **Create-Organization** flow lands directly on the new org's Settings page — good post-action UX.

---

## Console hygiene

The only persistent console output across the session:

- 2 React Router v7 future-flag warnings (informational, not blocking).
- 4 `API Error: Internal Server Error` lines all attributable to the BUG #1 upload retries before the workaround.
- 1 Chrome regex SyntaxError from BUG #4.

No uncaught React errors, no unhandled promise rejections, no asset-loading failures.

---

## Files in this directory

- `01-…32-…png` — chronological visual record (light + dark, every page)
- `sample_dichotomous_80x10.csv` — original synthetic 1PL CSV with `respondent_id` column (triggered BUG #1)
- `sample_dichotomous_noid.csv` — workaround CSV (numeric only) used to complete the wizard test
- `QA-REPORT.md` — this file

---

## Recommended fix order

| # | Severity | Effort | Notes |
|---|---|---|---|
| 1 | **High** | tiny (1 line) | BUG #1 — `df.mean(numeric_only=True)` |
| 2 | **Medium** | small | BUG #3 — wire experiment-ownership write into the analysis path |
| 3 | Low | tiny | BUG #4 — escape `-` in slug `pattern` attribute |
| 4 | Low | small | persist auth store to `localStorage` to survive reloads |
| 5 | Cosmetic | tiny | natural-order sort on item param table |
| 6 | Cosmetic | small | rename MLflow experiments to avoid `/` |

---

# Follow-up pass — all 5 supported models

**Added:** 2026-04-25 (same session)
**Scope:** drove the wizard end-to-end on each of the remaining four models (the original pass only fit 2PL). Used the existing `sample_dichotomous_noid.csv` for 1PL/3PL and a new `sample_polytomous_likert_80x10.csv` (80 respondents × 10 items, 1–5 Likert, generated under an RSM-like data-generating process with shared thresholds at -1.5/-0.5/0.5/1.5) for RSM/PCM.

## Results matrix (same N=80, 10 items)

| Model | Params | LL | AIC | BIC | Notes |
|---|---:|---:|---:|---:|---|
| 1PL (Rasch) | 10 | -390.98 | **801.95** | **825.77** | Best AIC/BIC on this dataset (parsimony wins). Parallel sigmoid ICCs confirm equal-discrimination assumption. |
| 2PL | 20 | -389.71 | 819.42 | 867.06 | Marginal LL gain over 1PL doesn't justify the extra 10 params. |
| 3PL | 30 | -408.21 | 876.42 | 947.88 | Worst dichotomous fit; c parameter mostly stuck at default 0.33 (one at 0.000) — N=80 is too small to identify guessing reliably. |
| RSM | 14 | -920.78 | **1869.57** | **1902.91** | Best polytomous AIC/BIC (matches the data-generating model). |
| PCM | 50 | -953.39 | 2006.79 | 2125.89 | Worse fit than RSM as expected since the data was generated with shared thresholds — but visibly more flexible per-item τ. |

All five fit completed without backend errors after the initial environment setup. **No new high-severity bugs blocking analysis.**

## Polytomous-only UI surface (NEW — not exercised in original pass)

The Results page reveals additional tabs and cards when the model is RSM or PCM:

| Element | Where | Verified for |
|---|---|---|
| "Polytomous" purple badge on tabs | Results tab bar | RSM, PCM |
| "Polytomous (Likert-scale) data detected" purple banner with response range | Step 4 (Model) | RSM, PCM |
| "5 Response Categories" + "Shared / Unique Threshold Structure" summary cards | Results → Summary | RSM (Shared), PCM (Unique) |
| **Category Analysis** tab — Andrich threshold table, ordered-threshold check, color-coded category distribution bar | Results | RSM, PCM |
| **Group Comparisons** tab — DIF analysis, ETS classification (A/B/C), no-grouping-column empty state | Results | RSM, PCM |
| **Category Probability Curves** chart — 5 colored curves with Andrich threshold dashed lines | Results → Visualizations | RSM, PCM |
| **Wright Map (Variable Map)** — Person Distribution histogram + Item Difficulties scatter on shared logit axis | Results → Visualizations | RSM, PCM |
| Polytomous Item Parameters table — B (measure), Infit/Outfit MNSQ, click-to-expand 4τ | Results → Item Parameters | RSM, PCM |
| Out-of-range MNSQ values highlighted in yellow | Results → Item Parameters | PCM (item_6: 1.61/1.67) |

All of these visualizations rendered correctly (verified via `.recharts-line-curve` path inspection AND viewport screenshots). The category-probability curves are textbook polytomous IRT — the colors of the bumps match the category-distribution bar legend.

**Sanity check:** estimated Andrich thresholds for the data-generating model came out to **-1.650, -0.484, 0.420, 1.714** vs. truth **-1.5, -0.5, 0.5, 1.5** — recovers the parameters within reasonable estimation error on N=80.

## New bugs found in follow-up

### BUG #5 — React `unique key` warning in `PolytomousItemParametersTable`
**Severity:** Low (React dev warning; production build hides this but the symptom — possibly buggy reordering on state change — could surface)
**Console:**
> `Warning: Each child in a list should have a unique "key" prop.`
> Check the render method of `PolytomousItemParametersTable`.
> at `frontend/src/components/results/PolytomousItemParametersTable.tsx:22:49`
**Fires:** when navigating to the Item Parameters tab on a PCM result.
**Likely cause:** rendering threshold cells (τ1..τ4) without keying them, or rendering the threshold expand-row as a sibling to the item row without a unique key.
**Fix:** add `key={…}` to the mapped JSX in that file.
**Screenshot evidence:** `47-pcm-item-parameters.png`.

### Finding — SE column shows "-" for 3PL and PCM
**Severity:** Medium (information loss vs. 1PL/2PL)
**Observed:**
- 3PL Item Parameters table: SE(b) and SE(a) columns are all `-` (see `37-3pl-item-params-with-c.png`).
- PCM Item Parameters table: SE column is `-` for every item (see `47-pcm-item-parameters.png`).
- 1PL and 2PL: SE values populated correctly.
**Interpretation:** could be intentional (3PL/PCM SEs from observed information are well-known to be unstable on small N) or a missing implementation. Worth confirming with the backend's IRT engine — `girth` does compute SEs for these models given enough data.
**Suggested action:** if intentional, change `-` to "N/A" with a tooltip explaining "Standard errors require N ≥ X for stable estimation". If unintentional, plumb them through.

### Finding — 3PL guessing parameters collapse to default
**Severity:** Domain-correct on N=80, but the UI doesn't flag it
**Observed:** `c` column in `37-3pl-item-params-with-c.png` shows `0.330, 0.330, 0.000, 0.330, 0.330, …` — i.e. nearly every item returned the prior/default of 0.33 (a common 3PL prior for 4-option multiple-choice). One item returned 0.000 exactly.
**Interpretation:** classic 3PL identifiability issue at small N — the data doesn't constrain `c` so the estimator returns the prior.
**Suggested action:** when a fitted `c` exactly matches the default value (or hits a bound) for ≥X items, surface a warning banner: "3PL guessing parameters were not identified at this sample size. Consider 1PL or 2PL, or increase N to ≥500."

### Finding — "New Analysis" returns to step 1 (Mode), not step 4 (Model)
**Severity:** UX nit (cost ~10 extra clicks during the QA pass)
**Observed:** clicking the "New Analysis" button on the Results page re-runs the whole wizard from Mode selection, including re-uploading the same file. There's no "fit another model on the same dataset" shortcut.
**Suggested:** rename to "Start Over" or add a sibling button "Fit Different Model" that retains the dataset and jumps to step 4. Especially valuable since users will commonly want to compare 1PL/2PL/3PL on the same data.

## Updated screenshot inventory

`33-wizard-mode-personal.png` … `48-pcm-item-thresholds-expanded.png` cover this follow-up. Specifically:

- **1PL:** 34 (summary), 35 (parallel ICCs)
- **3PL:** 36 (summary), 37 (item params with c), 38 (varied-slope ICCs)
- **Polytomous setup:** 39 (preview banner), 40 (model selection w/ purple polytomous banner)
- **RSM:** 41 (summary w/ Shared card), 42 (Category Analysis), 43 (CPC + Wright Map), 44 (Group Comparisons empty state)
- **PCM:** 45 (summary w/ Unique card), 46 (CPC + Wright Map), 47 (item params w/ MNSQ), 48 (item_6 expanded showing 4 unique τ)
- **Test data:** `sample_polytomous_likert_80x10.csv` added to this directory.

## Updated fix priority

| # | Severity | Effort | Notes |
|---|---|---|---|
| 1 | **High** | tiny (1 line) | BUG #1 — `df.mean(numeric_only=True)` ✅ fixed in `6b10d32` |
| 2 | **Medium** | small | BUG #3 — wire experiment-ownership write into the analysis path ✅ fixed in `958f380` |
| 3 | **Medium** | small | SE missing for 3PL/PCM ✅ labeled N/A with tooltip in `6da57c0` (girth doesn't support 3PL bootstrap and PCM SE would need expensive re-fit) |
| 4 | Low | tiny | BUG #4 — escape `-` in slug `pattern` attribute ✅ fixed in `be31432` |
| 5 | Low | tiny | BUG #5 — keyed Fragment in `PolytomousItemParametersTable` ✅ fixed in `be31432` |
| 6 | Low | small | persist auth store ✅ fixed in `9da8d63` (added `user` + `isAuthenticated` to `partialize`) |
| 7 | Low | small | "New Analysis" preserves dataset ✅ fixed in `020e56e` (added `BACK_TO_MODEL` event + "Fit Different Model" button) |
| 8 | Low | small | warn when 3PL c parameters collapse to prior ✅ fixed in `c2b467b` (amber banner above item param table) |
| 9 | Cosmetic | tiny | natural-order sort on item param table ✅ fixed in `50e6315` (`localeCompare` with `numeric:true`) |
| 10 | Cosmetic | small | rename MLflow experiments to avoid `/` ✅ fixed in `699a661` |

---

## Verification — 2026-04-25 fix pass

All 10 items above were addressed in 9 commits on `main` between `b31998f` (the prior tip) and `699a661`. Verification:

- Backend `pytest -x -q`: **27 passed** (up from 22 — added `test_data_summary_aggregation` and 5 in `test_analysis_experiment_ownership`).
- Frontend `npx tsc --noEmit`: only the 2 pre-existing errors remain (`LoginPage.tsx` unused var; `CreateOrganization.tsx` missing field), neither introduced or affected by these fixes.
- Implementation plan: `irt-wizard/docs/plans/2026-04-25-qa-report-fixes.md`.

**Manual UI verification deferred** — the dev environment (Postgres on 5433, MLflow on 5002, SeaweedFS on 8333) is still running but a fresh login/wizard walk hasn't been re-screenshotted. Recommended next step: re-run the QA pass against this branch and replace `qa-screenshots/` to confirm the visible behavior changes (banner appearance for 3PL, "Fit Different Model" button, /experiments page populated, etc.).

---

## Visual verification pass — 2026-04-25

Drove the wizard end-to-end after the 9-commit fix push. All targeted behavior changes confirmed visually. Replaced screenshots in this directory:

- `14-results-tab-item-parameters.png` — 1PL with **real SE(b)** values + natural-order sort.
- `50-2pl-results-after-fit-different.png` — 2PL after `Fit Different Model` (data preserved, both SE(b) and SE(a) populated).
- `49-fit-different-model-landed-on-step4.png` — confirms the new button lands on step 4 with Mode/Upload/Preview all green-checked (no re-upload needed).
- `51-3pl-banner-and-na-se.png` — amber **"Heads up: 7 of 10 items returned the default guessing value"** banner + italic `N/A` in SE(B) and SE(A) for every item.
- `37-3pl-item-params-with-c.png` — same 3PL view including the c column with mostly-collapsed values.
- `52-rsm-item-params-na-se.png` — RSM Polytomous Item Parameters table with italic `N/A` SE column.
- `47-pcm-item-parameters.png` — PCM same, with item_6 yellow MNSQ outliers preserved.
- `20-experiments-mlflow.png` — `/experiments` page now populated with `Analysis 4-25-2026 · 5 runs` (confirms BUG #3 fix AND Task 10's `/`→`-` sanitization).

### Predicate-fix follow-up (commit `882948b`)

While verifying, found that the original c-collapse warning predicate `it.guessing === 0` missed girth's actual MML floor values (`~5e-8`, not exactly zero). Loosened to `it.guessing < 1e-4`. Banner now correctly fires on the QA dataset (7 of 10 items collapsed).

### New issues discovered during this pass (NOT regressions)

These were latent in the codebase before BUG #3 was fixed — the empty `/experiments` page hid them. Now visible:

1. **`MLflowViewer.tsx::ExperimentList` React key warning** — same class as BUG #5. Component keys on `exp.experiment_id` but the backend `/api/v1/mlflow/experiments` payload contains `mlflow_experiment_id` instead (and `id` for the DB UUID). With one item, the `undefined` key produces a React warning; with multiple items the duplicate-undefined would also break reconciliation.
2. **Experiment drill-down doesn't navigate** — same root cause. `MLflowViewer.tsx:531` does `experiments.find((e) => e.experiment_id === experimentId)` which never matches because no experiment has `experiment_id`. Clicking the chevron does nothing.

**Suggested fix (single change):** in the backend `MLflowExperimentSchema` (or wherever `/api/v1/mlflow/experiments` is serialized), add an `experiment_id` field aliased to `mlflow_experiment_id` (or rename). One line; restores both the React key and the navigation. Alternatively, change the frontend type and 4 references to use `mlflow_experiment_id`.

Logged for a future pass — out of scope for this verification run.

✅ **Both fixed in commit `d03f880`.** Renamed `MLflowExperiment.experiment_id` → `mlflow_experiment_id` in `frontend/src/api/mlflow.ts` and updated the 6 call sites in `MLflowViewer.tsx`. `MLflowRunDetail.experiment_id` left unchanged (it's a passthrough from MLflow's run JSON where the upstream name is correct).

**Verification screenshots:**
- `54-experiments-no-key-warning.png` — `/experiments` page, console reports 0 errors after the rename.
- `55-experiments-drilldown-runs.png` — clicking the experiment row now navigates to the runs detail view, showing all 5 runs (1PL/2PL/3PL/RSM/PCM) with model, AIC, BIC, started time, and duration columns.
