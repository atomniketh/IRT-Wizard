# Test Fixtures for IRT Wizard

This directory contains sample datasets for testing the IRT Wizard application.

## Available Datasets

### 1. `lsat_sample.csv`
- **Description**: LSAT-style dichotomous response data
- **Respondents**: 500
- **Items**: 5
- **Format**: Binary (0/1) responses
- **Use Case**: Small dataset for quick testing, similar to classic LSAT Section 6 data
- **Expected Results**: Items should show varying difficulty levels with item5 being easiest and item1 being hardest

### 2. `medium_test_data.csv`
- **Description**: Medium-sized test dataset with 15 items
- **Respondents**: 250
- **Items**: 15 (Q1-Q15)
- **Format**: Binary (0/1) responses
- **Use Case**: Testing medium dataset handling, item ordering by difficulty
- **Expected Results**: Clear Guttman-like pattern with items ordered from easy (Q1) to hard (Q15)

## Data Format

All CSV files follow this structure:
- First column: `respondent_id` (unique identifier)
- Subsequent columns: Item responses (1 = correct, 0 = incorrect)
- Header row with item names

## Using Test Data

1. Start the IRT Wizard application
2. Upload one of these CSV files in the Data Upload step
3. Select all item columns (exclude respondent_id)
4. Run IRT analysis with 1PL, 2PL, or 3PL model
5. Verify results match expected difficulty ordering

## External Data Sources

For additional test datasets, consider:

- **Item Response Warehouse**: https://itemresponsewarehouse.org/
- **Rdatasets Collection**: https://vincentarelbundock.github.io/Rdatasets/
- **Stata IRT Datasets**: https://www.stata-press.com/data/r14/irt.html
- **ShinyItemAnalysis**: https://shiny.cs.cas.cz/ShinyItemAnalysis/ (built-in datasets)

## References

- Bock, R.D. & Lieberman, M. (1970). Fitting a response model for dichotomously scored items. Psychometrika, 35(2), 179-197.
- McDonald, R.P. (1999). Test theory: A unified treatment. Mahwah, NJ: Lawrence Erlbaum.
