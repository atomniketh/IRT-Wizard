import numpy as np
import pandas as pd
import pytest
from pathlib import Path

from app.core.polytomous_engine import (
    PolytomousModelType,
    fit_polytomous_model,
    compute_category_probabilities,
    compute_wright_map_data,
    compute_fit_statistics,
    compute_category_structure,
)


CSV_PATH = Path("/Users/chrisstone/Downloads/IRT Final Clean Data for Analysis.csv")


@pytest.fixture
def trust_data():
    if not CSV_PATH.exists():
        pytest.skip(f"CSV file not found: {CSV_PATH}")

    df = pd.read_csv(CSV_PATH)
    item_columns = [
        "Integrity1", "Integrity2", "Integrity3",
        "Benevolence1", "Benevolence2", "Benevolence3", "Benevolence4",
        "Ability1", "Ability2", "Ability3",
        "Predictability1", "Predictability2"
    ]
    data = df[item_columns].values
    return data, item_columns


@pytest.fixture
def trust_data_with_groups():
    if not CSV_PATH.exists():
        pytest.skip(f"CSV file not found: {CSV_PATH}")

    df = pd.read_csv(CSV_PATH)
    item_columns = [
        "Integrity1", "Integrity2", "Integrity3",
        "Benevolence1", "Benevolence2", "Benevolence3", "Benevolence4",
        "Ability1", "Ability2", "Ability3",
        "Predictability1", "Predictability2"
    ]
    data = df[item_columns].values
    sex = df["Sex"].values
    return data, item_columns, sex


class TestLoadCSVData:
    def test_data_shape(self, trust_data):
        data, item_names = trust_data
        assert data.shape == (378, 12), f"Expected (378, 12), got {data.shape}"
        assert len(item_names) == 12

    def test_data_range(self, trust_data):
        data, _ = trust_data
        assert data.min() >= 1, f"Min value should be >= 1, got {data.min()}"
        assert data.max() <= 7, f"Max value should be <= 7, got {data.max()}"

    def test_no_missing_values(self, trust_data):
        data, _ = trust_data
        assert not np.isnan(data).any(), "Data contains NaN values"


class TestPolytomousModelFit:
    def test_fit_rsm(self, trust_data):
        data, item_names = trust_data
        result = fit_polytomous_model(data, PolytomousModelType.RSM, item_names)

        assert result.model_type == PolytomousModelType.RSM
        assert len(result.item_parameters.names) == 12
        assert len(result.item_parameters.difficulty) == 12
        assert result.item_parameters.thresholds is not None
        assert len(result.abilities.theta) == 378
        print(f"\nRSM Results:")
        print(f"  Item difficulties: {result.item_parameters.difficulty}")
        print(f"  Thresholds shape: {result.item_parameters.thresholds.shape}")
        print(f"  Ability mean: {result.abilities.theta.mean():.3f}")
        print(f"  Ability std: {result.abilities.theta.std():.3f}")

    def test_fit_pcm(self, trust_data):
        data, item_names = trust_data
        result = fit_polytomous_model(data, PolytomousModelType.PCM, item_names)

        assert result.model_type == PolytomousModelType.PCM
        assert len(result.item_parameters.names) == 12
        print(f"\nPCM Results:")
        print(f"  Item difficulties: {result.item_parameters.difficulty}")


class TestCategoryProbabilities:
    def test_compute_category_probs(self, trust_data):
        data, item_names = trust_data
        result = fit_polytomous_model(data, PolytomousModelType.RSM, item_names)

        cat_probs = compute_category_probabilities(
            result.item_parameters.difficulty,
            result.item_parameters.thresholds
        )

        assert len(cat_probs) == 12
        print(f"\nCategory Probability Curves generated for {len(cat_probs)} items")
        print(f"  Theta range: {cat_probs[0]['data'][0]['theta']:.1f} to {cat_probs[0]['data'][-1]['theta']:.1f}")
        print(f"  Categories per item: {len(cat_probs[0]['data'][0]['probabilities'])}")


class TestWrightMap:
    def test_wright_map_data(self, trust_data):
        data, item_names = trust_data
        result = fit_polytomous_model(data, PolytomousModelType.RSM, item_names)

        wright_data = compute_wright_map_data(
            result.item_parameters,
            result.abilities
        )

        assert "persons" in wright_data
        assert "items" in wright_data
        print(f"\nWright Map Data:")
        print(f"  Person distribution bins: {len(wright_data['persons'])}")
        print(f"  Items: {len(wright_data['items'])}")

        person_thetas = [p["theta"] for p in wright_data["persons"]]
        person_counts = [p["count"] for p in wright_data["persons"]]
        print(f"  Person theta range: {min(person_thetas):.2f} to {max(person_thetas):.2f}")
        print(f"  Total persons: {sum(person_counts)}")


class TestFitStatistics:
    def test_fit_stats(self, trust_data):
        data, item_names = trust_data
        result = fit_polytomous_model(data, PolytomousModelType.RSM, item_names)

        fit_stats = compute_fit_statistics(
            data,
            result.item_parameters,
            result.abilities
        )

        assert len(fit_stats) == 12
        print(f"\nFit Statistics:")
        for stat in fit_stats[:3]:
            print(f"  {stat['item_name']}: infit={stat['infit_mnsq']:.3f}, outfit={stat['outfit_mnsq']:.3f}")


class TestCategoryStructure:
    def test_category_structure(self, trust_data):
        data, item_names = trust_data
        result = fit_polytomous_model(data, PolytomousModelType.RSM, item_names)

        cat_structure = compute_category_structure(
            data,
            result.item_parameters.thresholds
        )

        assert len(cat_structure) == 7
        print(f"\nCategory Structure (Andrich Thresholds):")
        for cat in cat_structure:
            threshold = cat.get("andrich_threshold", "N/A")
            if threshold != "N/A" and threshold is not None:
                print(f"  Category {cat['category']}: count={cat['count']}, threshold={threshold:.3f}")
            else:
                print(f"  Category {cat['category']}: count={cat['count']}, threshold=N/A (base category)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
