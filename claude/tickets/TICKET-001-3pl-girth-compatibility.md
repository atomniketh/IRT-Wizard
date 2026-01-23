# TICKET-001: Fix 3PL Model Support (girth library compatibility)

## Description
The Three-Parameter Logistic (3PL) IRT model is currently disabled because the girth library's `threepl_mml()` function fails with newer versions of scipy/numpy.

The error occurs inside girth's optimizer code:
```
ValueError: setting an array element with a sequence.
```

This happens in `girth/unidimensional/dichotomous/threepl_mml.py` during the scipy optimization step.

## Current Workaround
- 3PL model option is disabled in the UI (`ModelSelection.tsx`)
- Shows message: "Coming soon - requires library update"
- 1PL and 2PL models work correctly

## Environment
- girth: latest
- scipy: 1.17.0
- numpy: 2.4.1

## Acceptance Criteria
- [ ] 3PL model runs successfully without errors
- [ ] 3PL model option is re-enabled in the UI
- [ ] 3PL analysis produces valid item parameters (a, b, c) and ability estimates

## Potential Solutions
1. **Pin scipy to older version** - Find a compatible scipy version and pin it in pyproject.toml
2. **Use py-irt library** - Switch to py-irt for 3PL support (also adds GPU acceleration option)
3. **Wait for girth fix** - Monitor girth repository for bug fixes
4. **Implement custom 3PL** - Write own 3PL estimation (not recommended)

## Priority
Medium

## Status
Todo

## Notes
- girth GitHub: https://github.com/eribean/girth
- This may be a known issue with scipy 1.x compatibility
- py-irt was already planned for v2 (GPU acceleration for large datasets)
