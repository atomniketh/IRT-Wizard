# TICKET-002: Implement Rasch Polytomous Model Support and Paper-Aligned Visualizations

## Description
Adapt the IRT Wizard application to support polytomous (Likert-scale) item response data using the Rasch Rating Scale Model (RSM) and Partial Credit Model (PCM), and implement visualizations aligned with the Rasch validation paper "Examining Validity Evidence for Gefen's Trust in Technology Framework Using a Rasch Measurement Model."

The paper provides guidance on:
- Category structure analysis with Andrich thresholds
- Person-item targeting via Wright maps
- Fit statistics (MNSQ infit/outfit)
- Category probability curves
- DIF (Differential Item Functioning) analysis

## Background

### Current State
- IRT Wizard supports only **dichotomous (binary 0/1) models**: 1PL (Rasch), 2PL, 3PL
- Uses Girth library for IRT computations
- Current visualizations: ICC curves, IIF charts, TIF charts, Ability Distribution
- Data model assumes binary responses

### Paper Requirements
The paper analyzed 12 trust-in-AI items using a 7-point Likert scale (1-7) with:
- **378 participants**
- **4 constructs**: Integrity (3 items), Benevolence (4 items), Ability (3 items), Predictability (2 items)
- **Rasch Rating Scale Model** for polytomous data analysis

### Key Findings from Paper to Address
1. **Category Functioning Issues**: 7-point Likert scale showed problematic Andrich thresholds (disordered categories)
2. **Poor Person-Item Targeting**: Ceiling effects with most participants above item difficulty range
3. **Recommendation**: Use fewer response categories and add items to cover broader trait levels

## Acceptance Criteria

### Phase 1: Backend - Polytomous Model Support
- [ ] Add Rating Scale Model (RSM) to ModelType enum
- [ ] Add Partial Credit Model (PCM) to ModelType enum
- [ ] Implement polytomous item parameter estimation
- [ ] Calculate Andrich threshold parameters for category boundaries
- [ ] Compute person ability estimates using polytomous data
- [ ] Calculate MNSQ infit/outfit statistics per item
- [ ] Generate category probability curve data
- [ ] Generate Wright map data (person-item distribution)
- [ ] Support data with response values 1-7 (or any ordinal range)

### Phase 2: Backend - Additional Rasch Analyses
- [ ] Implement PCAR (Principal Component Analysis of Residuals) for unidimensionality
- [ ] Implement DIF analysis by demographic groups (e.g., Sex)
- [ ] Calculate reliability coefficients (person/item separation)
- [ ] Generate category structure analysis tables

### Phase 3: Frontend - New Visualizations
- [ ] Category Probability Curves chart (like Figure 1 in paper)
- [ ] Wright Map visualization (like Figure 6 in paper)
- [ ] Category structure analysis table
- [ ] Fit statistics table with MNSQ values
- [ ] DIF analysis visualization

### Phase 4: Frontend - Data Input Enhancement
- [ ] Support CSV upload with polytomous data (1-7 scale)
- [ ] Auto-detect response scale (binary vs. polytomous)
- [ ] Model selection UI to choose RSM/PCM for polytomous data

## Technical Implementation

### 1. Backend Changes

#### 1.1 New Model Types (`backend/app/schemas/irt.py`)
```python
class ModelType(str, Enum):
    ONE_PL = "1PL"
    TWO_PL = "2PL"
    THREE_PL = "3PL"
    RSM = "RSM"      # Rating Scale Model (polytomous)
    PCM = "PCM"      # Partial Credit Model (polytomous)
```

#### 1.2 New Data Classes (`backend/app/core/irt_engine.py`)

**Polytomous Item Parameters:**
```python
@dataclass
class PolytomousItemParameters:
    names: list[str]
    difficulty: np.ndarray           # Item location/difficulty
    thresholds: np.ndarray           # Andrich thresholds (k-1 for k categories)
    se_difficulty: np.ndarray | None = None
    se_thresholds: np.ndarray | None = None
    infit_mnsq: np.ndarray | None = None
    outfit_mnsq: np.ndarray | None = None
```

**Category Structure:**
```python
@dataclass
class CategoryStructure:
    category: int
    count: int
    observed_average: float
    andrich_threshold: float | None
    se_threshold: float | None
```

#### 1.3 New IRT Engine Functions

**Rating Scale Model Estimation:**
- Use `girth.pcm_mml()` for Partial Credit Model (Girth supports this)
- For RSM, implement custom estimation or use external library

**Category Probability Calculation:**
```python
def compute_category_probability(theta: float, difficulty: float,
                                  thresholds: np.ndarray, category: int) -> float:
    """
    Compute P(X=k) for Rasch Rating Scale Model
    P(X=k|θ,β,τ) = exp(Σ(θ-β-τ_j)) / Σ exp(Σ(θ-β-τ_j))
    """
```

**Wright Map Data Generation:**
```python
def compute_wright_map_data(item_params: PolytomousItemParameters,
                            abilities: AbilityEstimates) -> dict:
    """Generate person and item distributions for Wright map"""
    return {
        "persons": [{"theta": t, "count": c} for t, c in person_dist],
        "items": [{"name": n, "difficulty": d, "thresholds": th} for ...]
    }
```

**Fit Statistics:**
```python
def compute_fit_statistics(data: np.ndarray, params: PolytomousItemParameters,
                           abilities: AbilityEstimates) -> dict:
    """Calculate MNSQ infit/outfit for each item"""
```

### 2. Frontend Changes

#### 2.1 New Chart Components

**CategoryProbabilityCurves.tsx** (Figure 1 in paper)
- X-axis: Person Measure (logits)
- Y-axis: Probability (0-1)
- Multiple curves per category (1-7)
- Show Andrich thresholds as vertical markers

**WrightMap.tsx** (Figure 6 in paper)
- Left side: Person distribution histogram
- Right side: Item difficulty locations with threshold markers
- Shared Y-axis: Logit scale (-4 to +4)

**FitStatisticsTable.tsx**
- Item name, Count, Measure, SE, MNSQ Infit, MNSQ Outfit, ZSTD
- Color coding for problematic fit values

**CategoryStructureTable.tsx**
- Category, Count, Observed Average, Andrich Threshold, SE

#### 2.2 UI Updates

**Model Selection (ModelSelection.tsx)**
- Add RSM and PCM options
- Show polytomous options only when data has values > 1
- Tooltips explaining when to use each model

**Results Panel**
- New tab: "Category Analysis" for polytomous results
- Conditional rendering based on model type

### 3. API Endpoints

#### New Endpoints Needed
```
GET /api/analysis/{id}/category-probability-curves
GET /api/analysis/{id}/wright-map
GET /api/analysis/{id}/category-structure
GET /api/analysis/{id}/fit-statistics
GET /api/analysis/{id}/dif-analysis?group_var=Sex
```

### 4. Data Model Updates

#### Dataset Schema Enhancement
- Add `response_scale` field: "binary" | "ordinal"
- Add `min_response` and `max_response` fields
- Add optional `group_variables` for DIF analysis

## File Changes Summary

### Backend Files to Modify
| File | Changes |
|------|---------|
| `backend/app/schemas/irt.py` | Add RSM, PCM to ModelType; add polytomous schemas |
| `backend/app/core/irt_engine.py` | Add polytomous model estimation functions |
| `backend/app/api/analysis.py` | Add new endpoints for visualizations |
| `backend/app/schemas/analysis.py` | Add polytomous result schemas |

### Backend Files to Create
| File | Purpose |
|------|---------|
| `backend/app/core/polytomous_engine.py` | Polytomous IRT computations |
| `backend/app/core/fit_statistics.py` | MNSQ calculations |
| `backend/app/core/dif_analysis.py` | DIF analysis functions |

### Frontend Files to Modify
| File | Changes |
|------|---------|
| `frontend/src/types/index.ts` | Add polytomous types |
| `frontend/src/api/analysis.ts` | Add new API methods |
| `frontend/src/components/wizard/steps/ModelSelection.tsx` | Add RSM/PCM options |

### Frontend Files to Create
| File | Purpose |
|------|---------|
| `frontend/src/components/charts/CategoryProbabilityCurves.tsx` | Category probability visualization |
| `frontend/src/components/charts/WrightMap.tsx` | Person-item targeting map |
| `frontend/src/components/charts/FitStatisticsTable.tsx` | Item fit statistics |
| `frontend/src/components/charts/CategoryStructureTable.tsx` | Category analysis |

## Dependencies

### Python Libraries
- `girth` - Already installed, has PCM support via `pcm_mml()`
- Consider: `py-irt` or custom implementation for RSM if needed

### Verification
Need to verify Girth's polytomous capabilities:
```python
import girth
# Check if these functions exist:
girth.pcm_mml()  # Partial Credit Model
girth.grm_mml()  # Graded Response Model (alternative)
```

## Priority
High

## Status
Todo

## Estimated Effort
- Phase 1 (Backend Core): Large
- Phase 2 (Backend Advanced): Medium
- Phase 3 (Frontend Visualizations): Large
- Phase 4 (Data Input): Small

## Related Tickets
- TICKET-001: Fix 3PL Model Support (girth library compatibility)

## Notes

### Paper References for Implementation
1. **Category Probability Curves** - Figure 1 shows how each response category (1-7) has probability curves that should show ordered thresholds
2. **Wright Map** - Figure 6 shows person distribution on left, item thresholds on right, revealing poor targeting
3. **Fit Statistics** - Table 2 shows MNSQ values; acceptable range typically 0.5-1.5

### Key Rasch Formulas

**Rating Scale Model (RSM):**
```
P(X_ni = k | θ_n, β_i, τ_j) = exp(Σ[j=0 to k](θ_n - β_i - τ_j)) / Σ[m=0 to K] exp(Σ[j=0 to m](θ_n - β_i - τ_j))
```

Where:
- θ_n = person ability
- β_i = item difficulty
- τ_j = Andrich threshold (category boundary)
- K = number of categories

**MNSQ Infit:**
```
MNSQ_infit = Σ(z²_ni × W_ni) / Σ(W_ni)
```

Where z_ni is standardized residual and W_ni is variance weight.

### Testing Strategy
1. Use the provided CSV data (378 participants, 12 items, 7-point scale)
2. Compare results with paper's reported values
3. Verify visualization output matches paper figures
