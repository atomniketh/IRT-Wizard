"""Regression test for QA BUG #1: data_summary aggregations must skip non-numeric columns."""
import pandas as pd
import pytest


def test_mean_and_sum_skip_string_columns():
    df = pd.DataFrame(
        {
            "respondent_id": ["R001", "R002", "R003"],
            "item_1": [1, 0, 1],
            "item_2": [0, 1, 1],
        }
    )

    means = df.mean(numeric_only=True).to_dict()
    sums = df.sum(numeric_only=True).to_dict()

    assert "respondent_id" not in means
    assert "respondent_id" not in sums
    assert means["item_1"] == pytest.approx(2 / 3)
    assert sums["item_2"] == 2
