from typing import Any

import numpy as np
import pandas as pd


def is_id_column(col_name: str, series: pd.Series) -> bool:
    name_lower = col_name.lower()
    if any(id_term in name_lower for id_term in ["id", "index", "respondent", "person", "subject"]):
        return True

    if series.dtype in [np.int64, np.int32, np.float64]:
        unique_vals = series.dropna().unique()
        if len(unique_vals) == len(series.dropna()):
            return True

    return False


def is_binary_column(series: pd.Series) -> bool:
    unique_values = series.dropna().unique()
    return all(v in [0, 1, 0.0, 1.0] for v in unique_values)


def is_grouping_column(col_name: str, series: pd.Series) -> bool:
    """
    Check if column could be used as a grouping variable for DIF analysis.
    Grouping columns have 2-5 unique values and are not response items.
    """
    unique_values = series.dropna().unique()
    n_unique = len(unique_values)

    if n_unique < 2 or n_unique > 5:
        return False

    name_lower = col_name.lower()
    grouping_keywords = [
        "sex", "gender", "group", "condition", "treatment", "form",
        "version", "cohort", "class", "school", "site", "location",
        "age_group", "ethnicity", "race", "language", "grade"
    ]
    if any(keyword in name_lower for keyword in grouping_keywords):
        return True

    all_numeric = all(isinstance(v, (int, float, np.integer, np.floating)) for v in unique_values)
    if all_numeric:
        try:
            int_values = sorted([int(v) for v in unique_values])
            if set(int_values).issubset({0, 1, 2, 3, 4, 5}):
                if n_unique == 2:
                    return True
        except (ValueError, TypeError):
            pass

    all_strings = all(isinstance(v, str) for v in unique_values)
    if all_strings and n_unique <= 5:
        return True

    return False


def is_ordinal_column(series: pd.Series) -> bool:
    """Check if column contains ordinal (Likert-scale) data."""
    unique_values = series.dropna().unique()

    # Must be numeric
    if not all(isinstance(v, (int, float, np.integer, np.floating)) for v in unique_values):
        return False

    # Must have at least 2 unique values
    if len(unique_values) < 2:
        return False

    # Convert to integers if possible
    try:
        int_values = [int(v) for v in unique_values]
    except (ValueError, TypeError):
        return False

    # Check if values form a reasonable ordinal scale (e.g., 1-5, 1-7, 0-6)
    min_val = min(int_values)
    max_val = max(int_values)

    # Ordinal scale should have reasonable range (2-10 categories typically)
    n_categories = max_val - min_val + 1
    if n_categories < 2 or n_categories > 10:
        return False

    # Values should be integers in a contiguous or near-contiguous range
    # Allow some categories to be unused
    return True


def detect_response_scale(df: pd.DataFrame, item_columns: list[str]) -> dict[str, Any]:
    """
    Detect the response scale of the data.

    Returns:
        dict with keys:
        - response_scale: "binary" | "ordinal" | "mixed"
        - min_response: minimum response value
        - max_response: maximum response value
        - n_categories: number of unique response categories
    """
    if not item_columns:
        return {
            "response_scale": "unknown",
            "min_response": None,
            "max_response": None,
            "n_categories": 0,
        }

    item_df = df[item_columns]
    all_values = item_df.values.flatten()
    all_values = all_values[~np.isnan(all_values)]

    if len(all_values) == 0:
        return {
            "response_scale": "unknown",
            "min_response": None,
            "max_response": None,
            "n_categories": 0,
        }

    unique_values = np.unique(all_values)
    min_response = int(np.min(unique_values))
    max_response = int(np.max(unique_values))
    n_categories = len(unique_values)

    # Check if all values are binary (0/1)
    if set(unique_values).issubset({0, 1, 0.0, 1.0}):
        return {
            "response_scale": "binary",
            "min_response": 0,
            "max_response": 1,
            "n_categories": 2,
        }

    # Check if values form an ordinal scale
    # Typical Likert scales: 1-5, 1-7, 0-4, 0-6, etc.
    if n_categories >= 3 and n_categories <= 10:
        return {
            "response_scale": "ordinal",
            "min_response": min_response,
            "max_response": max_response,
            "n_categories": n_categories,
        }

    # Mixed or unknown
    return {
        "response_scale": "mixed",
        "min_response": min_response,
        "max_response": max_response,
        "n_categories": n_categories,
    }


def validate_response_matrix(df: pd.DataFrame) -> dict[str, Any]:
    errors = []
    warnings = []

    if df.empty:
        errors.append({"type": "empty_data", "message": "Dataset is empty"})
        return {"is_valid": False, "errors": errors}

    id_columns = []
    binary_columns = []
    ordinal_columns = []
    grouping_columns = []
    other_columns = []

    for col in df.columns:
        if is_id_column(col, df[col]):
            id_columns.append(col)
        elif is_grouping_column(col, df[col]):
            grouping_columns.append(col)
        elif is_binary_column(df[col]):
            binary_columns.append(col)
        elif is_ordinal_column(df[col]):
            ordinal_columns.append(col)
        else:
            other_columns.append(col)

    # Determine item columns based on what we found
    # Prefer ordinal if we have them, otherwise use binary
    if ordinal_columns:
        item_columns = ordinal_columns + binary_columns  # Include binary as ordinal is superset
    else:
        item_columns = binary_columns

    if id_columns:
        warnings.append({
            "type": "id_columns_detected",
            "message": f"ID column(s) detected and will be excluded: {', '.join(id_columns)}",
            "columns": id_columns,
        })

    if grouping_columns:
        warnings.append({
            "type": "grouping_columns_detected",
            "message": f"Grouping column(s) detected for DIF analysis: {', '.join(grouping_columns)}",
            "columns": grouping_columns,
        })

    if other_columns:
        warnings.append({
            "type": "non_response_columns",
            "message": f"Non-response column(s) will be excluded: {', '.join(other_columns)}",
            "columns": other_columns,
        })

    if len(item_columns) < 2:
        errors.append({
            "type": "insufficient_items",
            "message": f"Dataset must have at least 2 response item columns (found {len(item_columns)})",
        })

    if len(df) < 10:
        warnings.append({
            "type": "insufficient_respondents",
            "message": "Dataset has fewer than 10 respondents (rows)",
        })

    for col in item_columns:
        if df[col].isna().all():
            errors.append({
                "type": "all_missing",
                "message": f"Column '{col}' has all missing values",
                "column": col,
            })

        unique_values = df[col].dropna().unique()
        if len(unique_values) == 1:
            warnings.append({
                "type": "no_variance",
                "message": f"Column '{col}' has no variance (all values are {unique_values[0]})",
                "column": col,
            })

    item_df = df[item_columns] if item_columns else df
    if len(item_df.columns) > 0:
        missing_rate = item_df.isna().sum().sum() / (len(item_df) * len(item_df.columns))
        if missing_rate > 0.5:
            warnings.append({
                "type": "high_missing_rate",
                "message": f"Dataset has {missing_rate*100:.1f}% missing values in item columns",
            })

    # Detect response scale
    scale_info = detect_response_scale(df, item_columns)

    # Add informational message about detected scale
    if scale_info["response_scale"] == "ordinal":
        warnings.append({
            "type": "polytomous_data_detected",
            "message": f"Polytomous data detected ({scale_info['n_categories']} categories, range {scale_info['min_response']}-{scale_info['max_response']}). RSM or PCM models are recommended.",
        })
    elif scale_info["response_scale"] == "binary":
        warnings.append({
            "type": "binary_data_detected",
            "message": "Binary (0/1) data detected. 1PL, 2PL, or 3PL models are recommended.",
        })

    all_issues = errors + warnings
    is_valid = len(errors) == 0

    grouping_columns_info = []
    for col in grouping_columns:
        unique_vals = df[col].dropna().unique().tolist()
        grouping_columns_info.append({
            "column": col,
            "values": unique_vals,
            "n_groups": len(unique_vals),
        })

    return {
        "is_valid": is_valid,
        "errors": all_issues if all_issues else None,
        "item_columns": item_columns,
        "id_columns": id_columns,
        "grouping_columns": grouping_columns_info,
        "excluded_columns": other_columns,
        "response_scale": scale_info["response_scale"],
        "min_response": scale_info["min_response"],
        "max_response": scale_info["max_response"],
        "n_categories": scale_info["n_categories"],
    }
