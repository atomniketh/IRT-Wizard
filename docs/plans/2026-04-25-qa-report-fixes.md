# QA-Report Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Resolve every bug, finding, and recommendation in `qa-screenshots/QA-REPORT.md` from the 2026-04-25 QA pass.

**Architecture:** Fixes split across the FastAPI backend (`backend/app/...`) and the Vite/React frontend (`frontend/src/...`). No new abstractions; each fix is local to one or two files. Where fixes are user-visible and small, they are bundled into a single commit; where they require non-trivial backend logic (experiment ownership, SE plumbing) they get their own commit.

**Tech Stack:** Python 3.14 / FastAPI / SQLAlchemy / pandas / pytest (backend); React 18 / TypeScript / Zustand / Recharts / Vite (frontend).

**Fix order rationale:** quick wins (BUGs #1, #4, #5) first to clear console/upload regressions, then state/UX (auth persist, sort, "New Analysis"), then the deeper backend changes (experiment ownership, SE plumbing, 3PL c warning).

**Servers:** assume backend on 8002 and frontend on 3002 are already running per the original session. Each task includes its own verify step against those servers.

---

## Task 1: Fix `df.mean()` crash on non-numeric columns (BUG #1)

**Files:**
- Modify: `backend/app/api/v1/datasets.py:115` and `backend/app/api/v1/datasets.py:203`
- Test: `backend/tests/test_datasets_upload.py` (create)

**Step 1: Write the failing test**

```python
# backend/tests/test_datasets_upload.py
import pandas as pd
import pytest

def test_mean_scores_skips_non_numeric_columns():
    """Repro for QA BUG #1: df.mean() must not crash on string ID columns."""
    df = pd.DataFrame({
        "respondent_id": ["R001", "R002", "R003"],
        "item_1": [1, 0, 1],
        "item_2": [0, 1, 1],
    })
    means = df.mean(numeric_only=True).to_dict()
    assert "respondent_id" not in means
    assert means["item_1"] == pytest.approx(2/3)
    assert means["item_2"] == pytest.approx(2/3)
```

**Step 2: Run the test to verify it passes** (it's a regression check on pandas behaviour)

```
cd backend && source venv/bin/activate && pytest tests/test_datasets_upload.py -v
```

Expected: PASS (proves the workaround). The actual app code change is what we test next.

**Step 3: Apply the production fix**

In `backend/app/api/v1/datasets.py` change both occurrences:
- Line 115: `"mean_scores": df.mean().to_dict() if validation_result["is_valid"] else None,` → `"mean_scores": df.mean(numeric_only=True).to_dict() if validation_result["is_valid"] else None,`
- Line 203: same substitution.

**Step 4: Manual verify against running backend**

Re-upload `qa-screenshots/sample_dichotomous_80x10.csv` (the one *with* `respondent_id`) via the UI. Should reach Preview without HTTP 500.

**Step 5: Commit**

```bash
git add backend/app/api/v1/datasets.py backend/tests/test_datasets_upload.py
git commit -m "fix(datasets): skip non-numeric columns in mean_scores (QA BUG #1)"
```

---

## Task 2: Fix slug `pattern` regex SyntaxError (BUG #4)

**Files:**
- Modify: `frontend/src/pages/CreateOrganization.tsx:96`

**Step 1: Apply the fix**

Change `pattern="[a-z0-9-]+"` to `pattern="[a-z0-9\-]+"` (escape the hyphen so Chrome's `/v` regex parser accepts it).

**Step 2: Verify in running browser**

Open `/org/new`, fill the form, submit. The Chrome console should no longer show:
> `Pattern attribute value [a-z0-9-]+ is not a valid regular expression`

**Step 3: Commit** (will be bundled with Task 3 below.)

---

## Task 3: Fix React `unique key` warning in `PolytomousItemParametersTable` (BUG #5)

**Files:**
- Modify: `frontend/src/components/results/PolytomousItemParametersTable.tsx:153-196`

**Root cause:** the `.map()` returns a `<>...</>` Fragment containing two `<tr>` siblings. The Fragment is the list child, not the inner `<tr>`s — so `key` on the `<tr>`s doesn't satisfy React. Use a keyed `React.Fragment` instead.

**Step 1: Apply the fix**

Replace:
```tsx
{sortedItems.map((item, index) => {
  …
  return (
    <>
      <tr key={item.name || index} …>
```
with:
```tsx
{sortedItems.map((item, index) => {
  …
  return (
    <React.Fragment key={item.name || index}>
      <tr …>
```
and the closing `</>` with `</React.Fragment>`. Ensure `React` is imported (`import React, { useState } from 'react'`).

**Step 2: Verify in running browser**

Run a PCM analysis (or use the project from QA), open Item Parameters tab. Console error should disappear:
> `Warning: Each child in a list should have a unique "key" prop. Check the render method of PolytomousItemParametersTable.`

**Step 3: Commit (bundles Tasks 2 + 3 — both are tiny frontend hygiene fixes):**

```bash
git add frontend/src/pages/CreateOrganization.tsx frontend/src/components/results/PolytomousItemParametersTable.tsx
git commit -m "fix(frontend): slug pattern regex + Fragment key warning (QA BUGs #4, #5)"
```

---

## Task 4: Persist auth so reload/cross-origin nav doesn't log user out

**Files:**
- Modify: `frontend/src/store/authStore.ts:85-88` (extend `partialize`)

**Root cause:** `persist` middleware is already configured but only persists `accessToken` + `currentOrganization`. `user` and `isAuthenticated` are *not* in `partialize`, so on page reload the store hydrates with `accessToken` set but `isAuthenticated: false`. The `ProtectedRoute` then redirects to `/login`.

**Step 1: Apply the fix**

In `partialize`:
```ts
partialize: (state) => ({
  accessToken: state.accessToken,
  user: state.user,
  isAuthenticated: state.isAuthenticated,
  currentOrganization: state.currentOrganization,
}),
```

**Step 2: Verify in running browser**

1. Sign in → wizard appears.
2. Open `http://localhost:5002/` in same tab → MLflow loads.
3. Click browser back. App should still be authenticated (no redirect to `/login`).

**Step 3: Commit**

```bash
git add frontend/src/store/authStore.ts
git commit -m "fix(auth): persist user + isAuthenticated to survive page reload"
```

---

## Task 5: Natural-order sort for item parameters table

**Files:**
- Modify: `frontend/src/components/results/ItemParametersTable.tsx:30-44`
- Modify: `frontend/src/components/results/PolytomousItemParametersTable.tsx` (analogous block — confirm same approach)

**Step 1: Apply the fix**

Replace the string-comparison branch in the sort:
```ts
if (typeof aValue === 'string' && typeof bValue === 'string') {
  return sortDirection === 'asc'
    ? aValue.localeCompare(bValue)
    : bValue.localeCompare(aValue)
}
```
with `localeCompare(..., undefined, { numeric: true })`:
```ts
if (typeof aValue === 'string' && typeof bValue === 'string') {
  const cmp = aValue.localeCompare(bValue, undefined, { numeric: true })
  return sortDirection === 'asc' ? cmp : -cmp
}
```
Apply identical change in `PolytomousItemParametersTable.tsx` if it has a sibling sort.

**Step 2: Verify in running browser**

After running any analysis with 10+ items, Item Parameters tab should show `item_1, item_2, …, item_10` instead of `item_1, item_10, item_2`.

**Step 3: Commit**

```bash
git add frontend/src/components/results/ItemParametersTable.tsx frontend/src/components/results/PolytomousItemParametersTable.tsx
git commit -m "fix(results): natural-order sort for item names (item_2 before item_10)"
```

---

## Task 6: "New Analysis" preserves dataset and jumps to Model step

**Files:**
- Modify: `frontend/src/components/wizard/steps/Results.tsx:225-228`
- Inspect: the wizard XState machine (the `send({ type: 'RESET' })` event) to find or add a sibling event like `BACK_TO_MODEL`.

**Step 1: Inspect the state machine**

```
grep -rn "RESET\|BACK_TO_MODEL\|NEW_ANALYSIS" frontend/src/components/wizard/ frontend/src/state/ frontend/src/machines/ 2>/dev/null
```

Confirm where `RESET` is handled. Likely a transition that returns to `mode` from `results`. We want a new transition that returns to `model` and preserves `dataset`/`projectId` context.

**Step 2: Add `BACK_TO_MODEL` transition**

In the XState config (path discovered in Step 1), add an event like:
```ts
on: {
  RESET: { target: '#wizard.mode', actions: 'clearAll' },
  BACK_TO_MODEL: { target: '#wizard.model' },  // preserves dataset + project context
}
```

**Step 3: Wire the button**

In `Results.tsx:225-228` replace the single button with a button group:
```tsx
<Button variant="outline" onClick={() => send({ type: 'BACK_TO_MODEL' })}>
  <RefreshCw className="w-4 h-4 mr-2" />
  Fit Different Model
</Button>
<Button variant="outline" onClick={() => send({ type: 'RESET' })}>
  <RefreshCw className="w-4 h-4 mr-2" />
  Start Over
</Button>
```

**Step 4: Verify in running browser**

After a 1PL run, click "Fit Different Model" → lands on step 4 with the same dataset preserved (no re-upload). Click 2PL → run → results.

**Step 5: Commit**

```bash
git add frontend/src/components/wizard/steps/Results.tsx <wizard machine file>
git commit -m "feat(wizard): 'Fit Different Model' button preserves dataset"
```

---

## Task 7: Wire experiment-ownership write into the analysis path (BUG #3)

**Files:**
- Inspect: `backend/app/api/v1/analysis.py:198-208` and `backend/app/api/v1/mlflow_api.py:140-160` (existing writer at `:146`)
- Modify: `backend/app/api/v1/analysis.py` (add ownership write where the experiment is created)
- Test: `backend/tests/test_analysis_experiment_ownership.py` (create)

**Step 1: Read both call sites**

```
sed -n '180,220p' backend/app/api/v1/analysis.py
sed -n '130,170p' backend/app/api/v1/mlflow_api.py
```

Confirm what `Experiment(...)` model fields are required (mlflow_experiment_id, project_id, organization_id, created_by_user_id likely).

**Step 2: Write the failing test**

```python
# backend/tests/test_analysis_experiment_ownership.py
"""When an analysis runs, an Experiment ownership row must be created."""
import pytest
# Assumes existing test fixtures: db_session, test_user, test_project
# Or use the same fixtures that test_datasets_upload.py uses.

@pytest.mark.asyncio
async def test_analysis_creates_experiment_ownership_row(client, test_user, test_project, sample_dataset):
    response = await client.post(
        f"/api/v1/analysis/run?project_id={test_project.id}",
        json={"dataset_id": sample_dataset.id, "model_type": "1PL"},
        headers={"Authorization": f"Bearer {test_user.dev_token}"},
    )
    assert response.status_code == 200

    # The experiments table must now have a row for this project's MLflow experiment.
    rows = await db.execute("SELECT COUNT(*) FROM experiments WHERE project_id = :pid", {"pid": test_project.id})
    assert rows.scalar() == 1
```

(If the project has no async test client fixture yet, scope this down to a unit test on the helper function instead.)

**Step 3: Run the test to verify it fails**

```
cd backend && source venv/bin/activate && pytest tests/test_analysis_experiment_ownership.py -v
```

Expected: FAIL — count is 0 because the writer isn't called.

**Step 4: Apply the production fix**

In `backend/app/api/v1/analysis.py` around line 200 (where `mlflow.create_experiment(...)` is called), wrap it so an `Experiment` ORM row is also inserted/upserted, mirroring the pattern at `mlflow_api.py:146`. Pseudocode:
```python
mlflow_exp = mlflow.create_experiment(project_name, …)
existing = await session.execute(
    select(Experiment).where(Experiment.mlflow_experiment_id == mlflow_exp)
)
if existing.scalar_one_or_none() is None:
    session.add(Experiment(
        mlflow_experiment_id=mlflow_exp,
        project_id=project.id,
        organization_id=project.organization_id,
        created_by_user_id=current_user.id,
    ))
    await session.commit()
```

**Step 5: Run the test again to verify it passes**

```
cd backend && source venv/bin/activate && pytest tests/test_analysis_experiment_ownership.py -v
```

Expected: PASS.

**Step 6: Manual verify**

Run a fresh analysis through the UI → visit `/experiments` page in app. The experiment should now appear (no longer empty list).

**Step 7: Commit**

```bash
git add backend/app/api/v1/analysis.py backend/tests/test_analysis_experiment_ownership.py
git commit -m "fix(analysis): write experiments ownership row on run (QA BUG #3)"
```

---

## Task 8: Surface SE values for 3PL/PCM, or label "N/A" with explanation

**Files:**
- Inspect: `backend/app/core/` (IRT engine — `girth` integration). Find where item parameter SEs are computed for 1PL/2PL.
- Decision point: SEs may genuinely not be available from `girth` for 3PL/PCM. Two paths:
  - **(a)** if `girth` exposes them via Hessian/observed-information, plumb them through.
  - **(b)** if not, change the frontend to render "N/A" with a tooltip explaining why.

**Step 1: Investigate**

```
grep -rn "se_difficulty\|se_discrimination\|standard_error\|hessian" backend/app/core/ backend/app/api/ 2>/dev/null
```

If 3PL/PCM endpoints currently return `null` for SE → path (b). If they could compute SE but don't → path (a).

**Step 2 (path a): Plumb SE through 3PL/PCM** — add observed-information SE computation following the 2PL pattern; write a regression test that the API returns non-null SEs for 3PL on a synthetic dataset.

**Step 2 (path b): Label N/A in the UI**
- Modify: `frontend/src/components/results/ItemParametersTable.tsx` and `PolytomousItemParametersTable.tsx` SE cells.
- Replace the formatter:
```tsx
{item.se_difficulty != null ? formatValue(item.se_difficulty) : (
  <Tooltip content="Standard errors aren't reported for 3PL/PCM at this sample size — observed-information SEs are unstable below ~500 respondents.">
    <span className="text-gray-400">N/A</span>
  </Tooltip>
)}
```

**Step 3: Verify**

Run 3PL and PCM analyses. SE column shows either real numbers (path a) or `N/A` with hover explanation (path b) instead of a lone `-`.

**Step 4: Commit**

```bash
git add <files>
git commit -m "fix(results): surface SE for 3PL/PCM (or label N/A with rationale)"
```

---

## Task 9: Warn when 3PL guessing parameters collapse to prior

**Files:**
- Inspect: `frontend/src/components/results/ItemParametersTable.tsx` — find where `c` column is rendered for 3PL.
- Modify: same file, add a banner above the table when ≥50% of items have `c` exactly equal to the default (0.33 or 0.0).

**Step 1: Apply the fix**

```tsx
const defaultC = 0.33
const collapsedItems = items.filter(it =>
  it.guessing != null && (Math.abs(it.guessing - defaultC) < 0.001 || it.guessing === 0)
).length
const collapseFraction = items.length > 0 ? collapsedItems / items.length : 0

{modelType === '3PL' && collapseFraction >= 0.5 && (
  <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-300 p-3 mb-4">
    <p className="text-sm text-amber-800 dark:text-amber-200">
      <strong>Heads up:</strong> {collapsedItems} of {items.length} items returned the default
      guessing value ({defaultC}). 3PL needs ~500+ respondents to identify <code>c</code> reliably.
      Consider 1PL/2PL on this dataset.
    </p>
  </div>
)}
```

**Step 2: Verify**

Re-run 3PL on the QA dichotomous dataset (N=80). Banner should appear.

**Step 3: Commit**

```bash
git add frontend/src/components/results/ItemParametersTable.tsx
git commit -m "feat(results): warn when 3PL c parameters collapse to prior"
```

---

## Task 10: Avoid `/` in MLflow experiment names

**Files:**
- Modify: `backend/app/api/v1/analysis.py` — wherever `project_name` is constructed/passed to `mlflow.create_experiment` (around line 200 per Task 7's investigation).

**Step 1: Apply the fix**

Replace any `/` in the experiment name with `-` before calling `mlflow.create_experiment`. For example:
```python
safe_name = project.name.replace("/", "-")
mlflow.create_experiment(safe_name, …)
```
(Or namespace by ID: `f"project-{project.id}"`.)

**Step 2: Verify**

Run a fresh analysis with a project named `"Foo / Bar"`. Open MLflow UI → top-of-page heading should now read `"Foo - Bar"` (or similar) instead of just `"Bar"`.

**Step 3: Commit**

```bash
git add backend/app/api/v1/analysis.py
git commit -m "fix(mlflow): sanitize experiment names to avoid path-separator parsing"
```

---

## Final verify

After every task:

1. `cd backend && source venv/bin/activate && pytest -x`
2. `cd frontend && npm run lint && npm run typecheck` (whichever scripts exist)
3. Walk the same QA flow: login → wizard → 1PL → check Experiments page → 3PL (look for warning banner) → upload Likert → RSM → PCM → Item Parameters tab (no console errors).

Open `qa-screenshots/QA-REPORT.md` → mark each finding ✅ as it's verified, leaving the report as the regression checklist for the next QA pass.
