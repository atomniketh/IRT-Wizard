from dataclasses import dataclass
from enum import Enum
from typing import Any

import numpy as np


class ModelType(str, Enum):
    ONE_PL = "1PL"
    TWO_PL = "2PL"
    THREE_PL = "3PL"
    RSM = "RSM"  # Rating Scale Model (polytomous)
    PCM = "PCM"  # Partial Credit Model (polytomous)


@dataclass
class ItemParameters:
    names: list[str]
    difficulty: np.ndarray
    discrimination: np.ndarray
    guessing: np.ndarray
    se_difficulty: np.ndarray | None = None
    se_discrimination: np.ndarray | None = None
    se_guessing: np.ndarray | None = None


@dataclass
class AbilityEstimates:
    person_ids: list[str]
    theta: np.ndarray
    se_theta: np.ndarray | None = None


@dataclass
class AnalysisResult:
    model_type: ModelType
    item_parameters: ItemParameters
    abilities: AbilityEstimates
    model_fit: dict[str, Any]
    converged: bool


def fit_model(
    data: np.ndarray,
    model_type: ModelType,
    item_names: list[str] | None = None,
) -> AnalysisResult:
    import girth
    from girth import standard_errors_bootstrap

    n_persons, n_items = data.shape

    if item_names is None:
        item_names = [f"Item_{i+1}" for i in range(n_items)]

    person_ids = [f"Person_{i+1}" for i in range(n_persons)]

    data_for_girth = data.T

    se_difficulty = None
    se_discrimination = None
    se_guessing = None

    if model_type == ModelType.ONE_PL:
        estimates = girth.rasch_mml(data_for_girth)
        difficulty = estimates["Difficulty"]
        discrimination = np.ones(n_items)
        guessing = np.zeros(n_items)
        try:
            bootstrap_result = standard_errors_bootstrap(
                data_for_girth, girth.rasch_mml,
                bootstrap_iterations=50, n_processors=1, seed=42
            )
            se_estimates = bootstrap_result.get("Standard Errors", {})
            se_difficulty = se_estimates.get("Difficulty")
        except Exception:
            pass
    elif model_type == ModelType.TWO_PL:
        estimates = girth.twopl_mml(data_for_girth)
        difficulty = estimates["Difficulty"]
        discrimination = estimates["Discrimination"]
        guessing = np.zeros(n_items)
        try:
            bootstrap_result = standard_errors_bootstrap(
                data_for_girth, girth.twopl_mml,
                bootstrap_iterations=50, n_processors=1, seed=42
            )
            se_estimates = bootstrap_result.get("Standard Errors", {})
            se_difficulty = se_estimates.get("Difficulty")
            se_discrimination = se_estimates.get("Discrimination")
        except Exception:
            pass
    elif model_type == ModelType.THREE_PL:
        estimates = girth.threepl_mml(data_for_girth)
        difficulty = estimates["Difficulty"]
        discrimination = estimates["Discrimination"]
        guessing = estimates.get("Guessing", np.zeros(n_items))
    else:
        raise ValueError(f"Unsupported model type: {model_type}")

    theta = girth.ability_eap(data_for_girth, difficulty, discrimination)

    log_likelihood = compute_log_likelihood(data, difficulty, discrimination, guessing, theta)

    n_params = n_items
    if model_type == ModelType.TWO_PL:
        n_params = 2 * n_items
    elif model_type == ModelType.THREE_PL:
        n_params = 3 * n_items

    aic = 2 * n_params - 2 * log_likelihood
    bic = n_params * np.log(n_persons) - 2 * log_likelihood

    item_parameters = ItemParameters(
        names=item_names,
        difficulty=difficulty,
        discrimination=discrimination,
        guessing=guessing,
        se_difficulty=se_difficulty,
        se_discrimination=se_discrimination,
        se_guessing=se_guessing,
    )

    abilities = AbilityEstimates(
        person_ids=person_ids,
        theta=theta,
        se_theta=None,
    )

    model_fit = {
        "log_likelihood": float(log_likelihood),
        "aic": float(aic),
        "bic": float(bic),
        "n_parameters": n_params,
        "n_items": n_items,
        "n_persons": n_persons,
    }

    return AnalysisResult(
        model_type=model_type,
        item_parameters=item_parameters,
        abilities=abilities,
        model_fit=model_fit,
        converged=True,
    )


def compute_log_likelihood(
    data: np.ndarray,
    difficulty: np.ndarray,
    discrimination: np.ndarray,
    guessing: np.ndarray,
    theta: np.ndarray,
) -> float:
    data = np.asarray(data, dtype=np.float64)
    n_persons, n_items = data.shape
    log_lik = 0.0

    for i in range(n_persons):
        for j in range(n_items):
            p = compute_probability(float(theta[i]), float(difficulty[j]), float(discrimination[j]), float(guessing[j]))
            p = np.clip(p, 1e-10, 1 - 1e-10)
            response = float(data[i, j])
            if response == 1.0:
                log_lik += np.log(p)
            else:
                log_lik += np.log(1 - p)

    return log_lik


def compute_probability(
    theta: float, difficulty: float, discrimination: float, guessing: float
) -> float:
    exponent = discrimination * (theta - difficulty)
    exponent = np.clip(exponent, -700, 700)
    return guessing + (1 - guessing) / (1 + np.exp(-exponent))


def compute_icc_data(
    item_parameters: dict[str, Any], model_type: ModelType
) -> list[dict[str, Any]]:
    items = item_parameters.get("items", [])
    theta_range = np.linspace(-4, 4, 81)

    icc_curves = []
    for item in items:
        a = item.get("discrimination", 1.0)
        b = item.get("difficulty", 0.0)
        c = item.get("guessing", 0.0)

        probabilities = [compute_probability(t, b, a, c) for t in theta_range]

        icc_curves.append({
            "item_name": item["name"],
            "data": [
                {"theta": float(t), "probability": float(p)}
                for t, p in zip(theta_range, probabilities)
            ],
        })

    return icc_curves


def compute_item_information(
    theta: float, difficulty: float, discrimination: float, guessing: float
) -> float:
    p = compute_probability(theta, difficulty, discrimination, guessing)
    q = 1 - p

    numerator = discrimination**2 * (p - guessing) ** 2 * q
    denominator = p * (1 - guessing) ** 2

    if denominator < 1e-10:
        return 0.0

    return numerator / denominator


def compute_information_functions(
    item_parameters: dict[str, Any], model_type: ModelType
) -> dict[str, Any]:
    items = item_parameters.get("items", [])
    theta_range = np.linspace(-4, 4, 81)

    item_info_functions = []
    test_information = np.zeros(len(theta_range))

    for item in items:
        a = item.get("discrimination", 1.0)
        b = item.get("difficulty", 0.0)
        c = item.get("guessing", 0.0)

        info_values = [compute_item_information(t, b, a, c) for t in theta_range]
        test_information += np.array(info_values)

        item_info_functions.append({
            "item_name": item["name"],
            "data": [
                {"theta": float(t), "information": float(info)}
                for t, info in zip(theta_range, info_values)
            ],
        })

    return {
        "item_information": item_info_functions,
        "test_information": {
            "data": [
                {"theta": float(t), "information": float(info)}
                for t, info in zip(theta_range, test_information)
            ]
        },
    }
