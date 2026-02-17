import numpy as np
import pandas as pd
import pytest
from pathlib import Path

from app.core.irt_engine import ModelType
from app.core.polytomous_engine import (
    fit_polytomous_model,
    compute_category_probability_curves,
    compute_wright_map_data,
    compute_fit_statistics,
    compute_category_structure_analysis,
    compute_reliability_statistics,
    compute_dif_analysis,
)


CSV_PATH = Path("/Users/chrisstone/Downloads/IRTFinalCleanDataforAnalysis.csv")


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
    df = df.dropna(subset=item_columns)
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
    df = df.dropna(subset=item_columns)
    data = df[item_columns].values
    sex = df["Sex"].values
    return data, item_columns, sex


class TestLoadCSVData:
    def test_data_shape(self, trust_data):
        data, item_names = trust_data
        print(f"\nData shape: {data.shape}")
        assert data.shape[1] == 12
        assert data.shape[0] > 300

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
        result = fit_polytomous_model(data, ModelType.RSM, item_names)

        assert result.model_type == ModelType.RSM
        assert len(result.item_parameters.names) == 12
        assert len(result.item_parameters.difficulty) == 12
        assert result.item_parameters.thresholds is not None
        assert len(result.abilities.theta) == data.shape[0]
        print(f"\n{'='*60}")
        print("RSM Model Results (Rating Scale Model)")
        print(f"{'='*60}")
        print(f"Number of persons: {len(result.abilities.theta)}")
        print(f"Number of items: {len(result.item_parameters.names)}")
        print(f"Number of categories: {result.n_categories}")
        print(f"\nItem Difficulties (logits):")
        for name, diff in zip(result.item_parameters.names, result.item_parameters.difficulty):
            print(f"  {name}: {diff:.3f}")
        print(f"\nThresholds: {result.item_parameters.thresholds}")
        print(f"\nAbility distribution:")
        print(f"  Mean: {result.abilities.theta.mean():.3f}")
        print(f"  Std:  {result.abilities.theta.std():.3f}")
        print(f"  Min:  {result.abilities.theta.min():.3f}")
        print(f"  Max:  {result.abilities.theta.max():.3f}")

    def test_fit_pcm(self, trust_data):
        data, item_names = trust_data
        result = fit_polytomous_model(data, ModelType.PCM, item_names)

        assert result.model_type == ModelType.PCM
        assert len(result.item_parameters.names) == 12
        print(f"\n{'='*60}")
        print("PCM Model Results (Partial Credit Model)")
        print(f"{'='*60}")
        print(f"Item Difficulties (logits):")
        for name, diff in zip(result.item_parameters.names, result.item_parameters.difficulty):
            print(f"  {name}: {diff:.3f}")


class TestCategoryProbabilityCurves:
    def test_compute_category_probs(self, trust_data):
        data, item_names = trust_data
        result = fit_polytomous_model(data, ModelType.RSM, item_names)

        item_params_dict = {
            "items": [
                {
                    "name": name,
                    "difficulty": float(result.item_parameters.difficulty[i]),
                    "thresholds": result.item_parameters.thresholds.tolist() if result.item_parameters.thresholds.ndim == 1
                                  else result.item_parameters.thresholds[i].tolist()
                }
                for i, name in enumerate(result.item_parameters.names)
            ]
        }

        cat_probs = compute_category_probability_curves(item_params_dict, ModelType.RSM)

        assert len(cat_probs) > 0
        print(f"\n{'='*60}")
        print("Category Probability Curves (Figure 1 equivalent)")
        print(f"{'='*60}")
        n_items = len(set(c['item_name'] for c in cat_probs))
        n_cats = len([c for c in cat_probs if c['item_name'] == cat_probs[0]['item_name']])
        print(f"Generated curves for {n_items} items")
        print(f"Categories per item: {n_cats}")
        print(f"Theta range: {cat_probs[0]['data'][0]['theta']:.1f} to {cat_probs[0]['data'][-1]['theta']:.1f}")


class TestWrightMap:
    def test_wright_map_data(self, trust_data):
        data, item_names = trust_data
        result = fit_polytomous_model(data, ModelType.RSM, item_names)

        item_params_dict = {
            "items": [
                {
                    "name": name,
                    "difficulty": float(result.item_parameters.difficulty[i]),
                    "thresholds": result.item_parameters.thresholds.tolist() if result.item_parameters.thresholds.ndim == 1
                                  else result.item_parameters.thresholds[i].tolist()
                }
                for i, name in enumerate(result.item_parameters.names)
            ]
        }

        ability_dict = {
            "persons": [
                {"person_id": pid, "theta": float(theta)}
                for pid, theta in zip(result.abilities.person_ids, result.abilities.theta)
            ]
        }

        wright_data = compute_wright_map_data(item_params_dict, ability_dict, ModelType.RSM)

        assert "persons" in wright_data
        assert "items" in wright_data
        print(f"\n{'='*60}")
        print("Wright Map Data (Figure 6 equivalent)")
        print(f"{'='*60}")
        print(f"Person distribution bins: {len(wright_data['persons'])}")
        print(f"Items: {len(wright_data['items'])}")

        person_thetas = [p["theta"] for p in wright_data["persons"]]
        person_counts = [p["count"] for p in wright_data["persons"]]
        item_diffs = [i["difficulty"] for i in wright_data["items"]]
        print(f"\nPerson theta range: {min(person_thetas):.2f} to {max(person_thetas):.2f}")
        print(f"Item difficulty range: {min(item_diffs):.2f} to {max(item_diffs):.2f}")
        print(f"Total persons: {sum(person_counts)}")

        targeting_gap = np.mean(result.abilities.theta) - np.mean(result.item_parameters.difficulty)
        print(f"\nPerson-Item Targeting:")
        print(f"  Mean person ability: {np.mean(result.abilities.theta):.2f}")
        print(f"  Mean item difficulty: {np.mean(result.item_parameters.difficulty):.2f}")
        print(f"  Targeting gap: {targeting_gap:.2f} logits")
        if targeting_gap > 1:
            print(f"  WARNING: Items may be too easy (ceiling effect)")


class TestFitStatistics:
    def test_fit_stats(self, trust_data):
        data, item_names = trust_data
        result = fit_polytomous_model(data, ModelType.RSM, item_names)

        infit, outfit, infit_z, outfit_z = compute_fit_statistics(
            data,
            result.item_parameters.difficulty,
            result.item_parameters.thresholds,
            result.abilities.theta,
            ModelType.RSM
        )

        assert len(infit) == 12
        print(f"\n{'='*60}")
        print("Fit Statistics (Table 2 equivalent)")
        print(f"{'='*60}")
        print(f"{'Item':<20} {'Infit MNSQ':>12} {'Outfit MNSQ':>12} {'Status':>10}")
        print("-" * 56)
        for i, name in enumerate(item_names):
            status = "OK" if 0.5 <= infit[i] <= 1.5 and 0.5 <= outfit[i] <= 1.5 else "Check"
            print(f"{name:<20} {infit[i]:>12.3f} {outfit[i]:>12.3f} {status:>10}")


class TestCategoryStructure:
    def test_category_structure(self, trust_data):
        data, item_names = trust_data
        result = fit_polytomous_model(data, ModelType.RSM, item_names)

        cat_structure = compute_category_structure_analysis(
            data,
            result.item_parameters.difficulty,
            result.item_parameters.thresholds,
            result.abilities.theta,
            ModelType.RSM
        )

        print(f"\n{'='*60}")
        print("Category Structure Analysis (Table 3 equivalent)")
        print(f"{'='*60}")
        print(f"{'Category':<10} {'Count':>10} {'Obs Avg':>12} {'Threshold':>15}")
        print("-" * 52)
        for cat in cat_structure:
            threshold = cat.get("andrich_threshold")
            obs_avg = cat.get("observed_average", 0)
            if threshold is not None:
                print(f"{cat['category']:<10} {cat['count']:>10} {obs_avg:>12.3f} {threshold:>15.3f}")
            else:
                print(f"{cat['category']:<10} {cat['count']:>10} {obs_avg:>12.3f} {'N/A (base)':>15}")

        thresholds = [c.get("andrich_threshold") for c in cat_structure if c.get("andrich_threshold") is not None]
        if len(thresholds) > 1:
            ordered = all(thresholds[i] <= thresholds[i+1] for i in range(len(thresholds)-1))
            print(f"\nAndrich thresholds ordered: {'Yes' if ordered else 'No (DISORDERED - problematic)'}")


class TestReliability:
    def test_reliability_stats(self, trust_data):
        data, item_names = trust_data
        result = fit_polytomous_model(data, ModelType.RSM, item_names)

        rel_stats = compute_reliability_statistics(
            data,
            result.item_parameters.difficulty,
            result.item_parameters.thresholds,
            result.abilities.theta,
            ModelType.RSM
        )

        print(f"\n{'='*60}")
        print("Reliability Statistics")
        print(f"{'='*60}")
        print(f"Person Reliability: {rel_stats.person_reliability:.3f}")
        print(f"Person Separation: {rel_stats.person_separation:.3f}")
        print(f"Person Strata: {rel_stats.person_strata:.1f}")
        print(f"Item Reliability: {rel_stats.item_reliability:.3f}")
        print(f"Item Separation: {rel_stats.item_separation:.3f}")
        print(f"Item Strata: {rel_stats.item_strata:.1f}")


class TestDIFAnalysis:
    def test_dif_by_sex(self, trust_data_with_groups):
        data, item_names, sex = trust_data_with_groups
        result = fit_polytomous_model(data, ModelType.RSM, item_names)

        sex_array = np.array(sex)

        dif_results = compute_dif_analysis(
            data,
            sex_array,
            result.item_parameters.difficulty,
            result.item_parameters.thresholds,
            result.abilities.theta,
            item_names,
            ModelType.RSM,
            focal_group=1,
            reference_group=2
        )

        print(f"\n{'='*60}")
        print("DIF Analysis by Sex (1=Male, 2=Female)")
        print(f"{'='*60}")
        print(f"{'Item':<20} {'DIF Contrast':>15} {'Classification':>15}")
        print("-" * 55)
        for dif in dif_results:
            print(f"{dif.item_name:<20} {dif.dif_contrast:>15.3f} {dif.dif_classification:>15}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
