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


def validate_response_matrix(df: pd.DataFrame) -> dict[str, Any]:
    errors = []
    warnings = []

    if df.empty:
        errors.append({"type": "empty_data", "message": "Dataset is empty"})
        return {"is_valid": False, "errors": errors}

    id_columns = []
    item_columns = []
    non_binary_columns = []

    for col in df.columns:
        if is_id_column(col, df[col]):
            id_columns.append(col)
        elif is_binary_column(df[col]):
            item_columns.append(col)
        else:
            non_binary_columns.append(col)

    if id_columns:
        warnings.append({
            "type": "id_columns_detected",
            "message": f"ID column(s) detected and will be excluded: {', '.join(id_columns)}",
            "columns": id_columns,
        })

    if non_binary_columns:
        warnings.append({
            "type": "non_binary_columns",
            "message": f"Non-binary column(s) will be excluded: {', '.join(non_binary_columns)}",
            "columns": non_binary_columns,
        })

    if len(item_columns) < 2:
        errors.append({
            "type": "insufficient_items",
            "message": f"Dataset must have at least 2 binary item columns (found {len(item_columns)})",
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

    all_issues = errors + warnings
    is_valid = len(errors) == 0

    return {
        "is_valid": is_valid,
        "errors": all_issues if all_issues else None,
        "item_columns": item_columns,
        "id_columns": id_columns,
        "excluded_columns": non_binary_columns,
    }
