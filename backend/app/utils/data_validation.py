from typing import Any

import pandas as pd


def validate_response_matrix(df: pd.DataFrame) -> dict[str, Any]:
    errors = []

    if df.empty:
        errors.append({"type": "empty_data", "message": "Dataset is empty"})
        return {"is_valid": False, "errors": errors}

    if len(df.columns) < 2:
        errors.append({
            "type": "insufficient_items",
            "message": "Dataset must have at least 2 items (columns)",
        })

    if len(df) < 10:
        errors.append({
            "type": "insufficient_respondents",
            "message": "Dataset should have at least 10 respondents (rows)",
        })

    for col in df.columns:
        unique_values = df[col].dropna().unique()

        non_binary = [v for v in unique_values if v not in [0, 1, 0.0, 1.0]]
        if len(non_binary) > 0:
            errors.append({
                "type": "non_binary_values",
                "message": f"Column '{col}' contains non-binary values: {non_binary[:5]}",
                "column": col,
            })

        if df[col].isna().all():
            errors.append({
                "type": "all_missing",
                "message": f"Column '{col}' has all missing values",
                "column": col,
            })

        if len(unique_values) == 1 and len(unique_values) > 0:
            errors.append({
                "type": "no_variance",
                "message": f"Column '{col}' has no variance (all values are {unique_values[0]})",
                "column": col,
            })

    missing_rate = df.isna().sum().sum() / (len(df) * len(df.columns))
    if missing_rate > 0.5:
        errors.append({
            "type": "high_missing_rate",
            "message": f"Dataset has {missing_rate*100:.1f}% missing values (threshold: 50%)",
        })

    for idx in df.index:
        row = df.loc[idx]
        if row.isna().all():
            errors.append({
                "type": "empty_row",
                "message": f"Row {idx} has all missing values",
                "row": idx,
            })

    is_valid = len(errors) == 0 or all(
        e["type"] in ["high_missing_rate", "no_variance"] for e in errors
    )

    return {"is_valid": is_valid, "errors": errors if errors else None}
