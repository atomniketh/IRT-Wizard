import numpy as np
import pytest

from app.core.irt_engine import (
    ModelType,
    compute_icc_data,
    compute_information_functions,
    compute_probability,
    fit_model,
)


class TestComputeProbability:
    def test_probability_at_difficulty(self):
        prob = compute_probability(theta=0.0, difficulty=0.0, discrimination=1.0, guessing=0.0)
        assert abs(prob - 0.5) < 0.001

    def test_probability_higher_theta(self):
        prob = compute_probability(theta=2.0, difficulty=0.0, discrimination=1.0, guessing=0.0)
        assert prob > 0.5

    def test_probability_lower_theta(self):
        prob = compute_probability(theta=-2.0, difficulty=0.0, discrimination=1.0, guessing=0.0)
        assert prob < 0.5

    def test_probability_with_guessing(self):
        prob = compute_probability(theta=-10.0, difficulty=0.0, discrimination=1.0, guessing=0.25)
        assert abs(prob - 0.25) < 0.01

    def test_probability_bounds(self):
        for theta in [-4, -2, 0, 2, 4]:
            prob = compute_probability(theta, 0.0, 1.0, 0.0)
            assert 0 <= prob <= 1


class TestFitModel:
    def test_fit_1pl(self, sample_response_data, item_names):
        result = fit_model(sample_response_data, ModelType.ONE_PL, item_names)

        assert result.model_type == ModelType.ONE_PL
        assert len(result.item_parameters.names) == 10
        assert len(result.item_parameters.difficulty) == 10
        assert all(result.item_parameters.discrimination == 1.0)
        assert all(result.item_parameters.guessing == 0.0)
        assert len(result.abilities.theta) == 100

    def test_fit_2pl(self, sample_response_data, item_names):
        result = fit_model(sample_response_data, ModelType.TWO_PL, item_names)

        assert result.model_type == ModelType.TWO_PL
        assert len(result.item_parameters.discrimination) == 10
        assert all(result.item_parameters.discrimination > 0)

    def test_model_fit_statistics(self, sample_response_data, item_names):
        result = fit_model(sample_response_data, ModelType.ONE_PL, item_names)

        assert "log_likelihood" in result.model_fit
        assert "aic" in result.model_fit
        assert "bic" in result.model_fit
        assert result.model_fit["n_items"] == 10
        assert result.model_fit["n_persons"] == 100


class TestICCData:
    def test_compute_icc_data(self):
        item_params = {
            "items": [
                {"name": "Item_1", "difficulty": 0.0, "discrimination": 1.0, "guessing": 0.0},
                {"name": "Item_2", "difficulty": 1.0, "discrimination": 1.5, "guessing": 0.2},
            ]
        }

        icc_data = compute_icc_data(item_params, ModelType.TWO_PL)

        assert len(icc_data) == 2
        assert icc_data[0]["item_name"] == "Item_1"
        assert len(icc_data[0]["data"]) == 81

        for curve in icc_data:
            for point in curve["data"]:
                assert 0 <= point["probability"] <= 1


class TestInformationFunctions:
    def test_compute_information_functions(self):
        item_params = {
            "items": [
                {"name": "Item_1", "difficulty": 0.0, "discrimination": 1.0, "guessing": 0.0},
                {"name": "Item_2", "difficulty": 1.0, "discrimination": 1.5, "guessing": 0.0},
            ]
        }

        info = compute_information_functions(item_params, ModelType.TWO_PL)

        assert "item_information" in info
        assert "test_information" in info
        assert len(info["item_information"]) == 2

        for item_info in info["item_information"]:
            for point in item_info["data"]:
                assert point["information"] >= 0
