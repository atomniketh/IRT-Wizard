"""
Polytomous IRT Engine for Rating Scale Model (RSM) and Partial Credit Model (PCM).

Implements:
- Parameter estimation using Girth library
- Andrich threshold calculation
- Category probability computation
- MNSQ fit statistics (infit/outfit)
- Wright map data generation
- Category probability curve data
"""

from dataclasses import dataclass
from typing import Any

import numpy as np

from .irt_engine import ModelType


@dataclass
class PolytomousItemParameters:
    """Item parameters for polytomous IRT models."""
    names: list[str]
    difficulty: np.ndarray  # Item location/difficulty (n_items,)
    thresholds: np.ndarray  # Andrich thresholds (n_items, n_categories-1) for PCM, (n_categories-1,) for RSM
    se_difficulty: np.ndarray | None = None
    se_thresholds: np.ndarray | None = None
    infit_mnsq: np.ndarray | None = None
    outfit_mnsq: np.ndarray | None = None
    infit_zstd: np.ndarray | None = None
    outfit_zstd: np.ndarray | None = None


@dataclass
class PolytomousAbilityEstimates:
    """Person ability estimates from polytomous models."""
    person_ids: list[str]
    theta: np.ndarray
    se_theta: np.ndarray | None = None


@dataclass
class PolytomousAnalysisResult:
    """Complete results from polytomous model analysis."""
    model_type: ModelType
    item_parameters: PolytomousItemParameters
    abilities: PolytomousAbilityEstimates
    model_fit: dict[str, Any]
    converged: bool
    n_categories: int
    category_counts: np.ndarray  # Count of responses per category


def fit_polytomous_model(
    data: np.ndarray,
    model_type: ModelType,
    item_names: list[str] | None = None,
) -> PolytomousAnalysisResult:
    """
    Fit a polytomous IRT model (RSM or PCM) to response data.

    Args:
        data: Response matrix (n_persons x n_items) with ordinal values (e.g., 0-6 for 7-point scale)
        model_type: Either ModelType.RSM or ModelType.PCM
        item_names: Optional list of item names

    Returns:
        PolytomousAnalysisResult with item parameters, abilities, and fit statistics
    """
    import girth

    n_persons, n_items = data.shape

    if item_names is None:
        item_names = [f"Item_{i+1}" for i in range(n_items)]

    person_ids = [f"Person_{i+1}" for i in range(n_persons)]

    # Determine number of categories from data
    min_response = int(np.nanmin(data))
    max_response = int(np.nanmax(data))
    n_categories = max_response - min_response + 1

    # Normalize data to start from 0 if needed
    if min_response != 0:
        data_normalized = data - min_response
    else:
        data_normalized = data.copy()

    # Calculate category counts
    category_counts = np.zeros(n_categories, dtype=int)
    for k in range(n_categories):
        category_counts[k] = np.sum(data_normalized == k)

    # Transpose for Girth (expects items x persons)
    data_for_girth = data_normalized.T.astype(float)

    # Fit model using Girth's PCM implementation
    # Note: Girth uses pcm_mml for Partial Credit Model
    # For RSM, we use PCM and then average thresholds across items
    try:
        estimates = girth.pcm_mml(data_for_girth)

        # Extract difficulty parameters
        difficulty = estimates["Difficulty"]  # Shape: (n_items,)

        # Extract threshold parameters
        # Girth returns "Threshold" or similar key for category boundaries
        if "Threshold" in estimates:
            raw_thresholds = estimates["Threshold"]
        elif "Thresholds" in estimates:
            raw_thresholds = estimates["Thresholds"]
        else:
            # Calculate thresholds from difficulty structure
            # For PCM, each item has its own thresholds
            raw_thresholds = _estimate_thresholds_from_data(data_normalized, difficulty, n_categories)

        # Ensure thresholds are properly shaped
        if model_type == ModelType.RSM:
            # RSM: All items share same threshold structure
            # Average thresholds across items if we have item-specific ones
            if raw_thresholds.ndim == 2:
                thresholds = np.mean(raw_thresholds, axis=0)
            else:
                thresholds = raw_thresholds
        else:  # PCM
            # PCM: Each item has unique thresholds
            if raw_thresholds.ndim == 1:
                # Replicate for all items
                thresholds = np.tile(raw_thresholds, (n_items, 1))
            else:
                thresholds = raw_thresholds

        converged = True

    except Exception as e:
        # Fallback: estimate parameters using simpler method
        difficulty, thresholds = _estimate_parameters_fallback(data_normalized, n_categories, model_type)
        converged = False

    # Estimate person abilities using polytomous EAP
    theta = _estimate_abilities_polytomous(data_normalized, difficulty, thresholds, model_type)

    # Calculate fit statistics
    infit_mnsq, outfit_mnsq, infit_zstd, outfit_zstd = compute_fit_statistics(
        data_normalized, difficulty, thresholds, theta, model_type
    )

    # Calculate model fit indices
    log_likelihood = compute_polytomous_log_likelihood(
        data_normalized, difficulty, thresholds, theta, model_type
    )

    # Number of parameters
    if model_type == ModelType.RSM:
        n_params = n_items + (n_categories - 1)  # difficulties + shared thresholds
    else:  # PCM
        n_params = n_items * n_categories  # each item has difficulty + thresholds

    aic = 2 * n_params - 2 * log_likelihood
    bic = n_params * np.log(n_persons) - 2 * log_likelihood

    # Build result objects
    item_parameters = PolytomousItemParameters(
        names=item_names,
        difficulty=difficulty,
        thresholds=thresholds,
        se_difficulty=None,  # Would need bootstrap for SEs
        se_thresholds=None,
        infit_mnsq=infit_mnsq,
        outfit_mnsq=outfit_mnsq,
        infit_zstd=infit_zstd,
        outfit_zstd=outfit_zstd,
    )

    abilities = PolytomousAbilityEstimates(
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
        "n_categories": n_categories,
    }

    return PolytomousAnalysisResult(
        model_type=model_type,
        item_parameters=item_parameters,
        abilities=abilities,
        model_fit=model_fit,
        converged=converged,
        n_categories=n_categories,
        category_counts=category_counts,
    )


def _estimate_thresholds_from_data(
    data: np.ndarray,
    difficulty: np.ndarray,
    n_categories: int,
) -> np.ndarray:
    """Estimate Andrich thresholds from data when not provided by Girth."""
    n_items = data.shape[1]
    n_thresholds = n_categories - 1
    thresholds = np.zeros((n_items, n_thresholds))

    for j in range(n_items):
        item_responses = data[:, j]
        valid_responses = item_responses[~np.isnan(item_responses)]

        for k in range(n_thresholds):
            # Threshold is where P(X >= k+1) = 0.5
            prop_above = np.mean(valid_responses > k)
            # Convert proportion to logit scale
            prop_above = np.clip(prop_above, 0.01, 0.99)
            thresholds[j, k] = -np.log(prop_above / (1 - prop_above))

    # Center thresholds around item difficulty
    for j in range(n_items):
        thresholds[j] = thresholds[j] - np.mean(thresholds[j])

    return thresholds


def _estimate_parameters_fallback(
    data: np.ndarray,
    n_categories: int,
    model_type: ModelType,
) -> tuple[np.ndarray, np.ndarray]:
    """Fallback parameter estimation using classical methods."""
    n_persons, n_items = data.shape
    n_thresholds = n_categories - 1

    # Estimate difficulty as average response (transformed)
    mean_responses = np.nanmean(data, axis=0)
    max_possible = n_categories - 1
    difficulty = np.log((max_possible - mean_responses + 0.5) / (mean_responses + 0.5))

    # Estimate thresholds based on category proportions
    if model_type == ModelType.RSM:
        # Shared thresholds for all items
        thresholds = np.zeros(n_thresholds)
        for k in range(n_thresholds):
            prop_above = np.nanmean(data > k)
            prop_above = np.clip(prop_above, 0.01, 0.99)
            thresholds[k] = -np.log(prop_above / (1 - prop_above))
        thresholds = thresholds - np.mean(thresholds)  # Center
    else:  # PCM
        thresholds = np.zeros((n_items, n_thresholds))
        for j in range(n_items):
            for k in range(n_thresholds):
                prop_above = np.nanmean(data[:, j] > k)
                prop_above = np.clip(prop_above, 0.01, 0.99)
                thresholds[j, k] = -np.log(prop_above / (1 - prop_above))
            thresholds[j] = thresholds[j] - np.mean(thresholds[j])

    return difficulty, thresholds


def _estimate_abilities_polytomous(
    data: np.ndarray,
    difficulty: np.ndarray,
    thresholds: np.ndarray,
    model_type: ModelType,
) -> np.ndarray:
    """Estimate person abilities using Expected A Posteriori (EAP)."""
    n_persons, n_items = data.shape

    # Quadrature points for numerical integration
    quad_points = np.linspace(-4, 4, 41)
    quad_weights = np.exp(-quad_points**2 / 2) / np.sqrt(2 * np.pi)
    quad_weights = quad_weights / np.sum(quad_weights)

    theta = np.zeros(n_persons)

    for i in range(n_persons):
        response_pattern = data[i, :]

        # Calculate likelihood at each quadrature point
        log_likelihoods = np.zeros(len(quad_points))

        for q, theta_q in enumerate(quad_points):
            log_lik = 0.0
            for j in range(n_items):
                if not np.isnan(response_pattern[j]):
                    k = int(response_pattern[j])
                    p_k = compute_category_probability(
                        theta_q, difficulty[j],
                        thresholds if model_type == ModelType.RSM else thresholds[j],
                        k
                    )
                    p_k = max(p_k, 1e-10)
                    log_lik += np.log(p_k)
            log_likelihoods[q] = log_lik

        # Convert to proper likelihoods and compute EAP
        max_ll = np.max(log_likelihoods)
        likelihoods = np.exp(log_likelihoods - max_ll)
        posteriors = likelihoods * quad_weights
        posteriors = posteriors / np.sum(posteriors)

        theta[i] = np.sum(quad_points * posteriors)

    return theta


def compute_category_probability(
    theta: float,
    difficulty: float,
    thresholds: np.ndarray,
    category: int,
) -> float:
    """
    Compute probability of responding in a given category.

    Uses the Rating Scale Model formula:
    P(X=k|theta,beta,tau) = exp(sum_{j=0}^{k}(theta-beta-tau_j)) / sum_{m=0}^{K} exp(sum_{j=0}^{m}(theta-beta-tau_j))

    Args:
        theta: Person ability
        difficulty: Item difficulty (beta)
        thresholds: Andrich thresholds (tau), shape (n_categories-1,)
        category: Category to compute probability for (0 to K)

    Returns:
        Probability of responding in the given category
    """
    n_categories = len(thresholds) + 1

    # Compute cumulative sums for numerator and denominator
    numerators = np.zeros(n_categories)

    for k in range(n_categories):
        cumsum = 0.0
        for j in range(k):
            if j < len(thresholds):
                cumsum += theta - difficulty - thresholds[j]
            else:
                cumsum += theta - difficulty
        numerators[k] = np.exp(np.clip(cumsum, -700, 700))

    denominator = np.sum(numerators)

    if denominator < 1e-10:
        return 1.0 / n_categories

    return numerators[category] / denominator


def compute_fit_statistics(
    data: np.ndarray,
    difficulty: np.ndarray,
    thresholds: np.ndarray,
    theta: np.ndarray,
    model_type: ModelType,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """
    Compute MNSQ infit and outfit statistics for each item.

    Infit is information-weighted, outfit is unweighted.
    Expected range: 0.5 - 1.5 (good fit)

    Returns:
        Tuple of (infit_mnsq, outfit_mnsq, infit_zstd, outfit_zstd)
    """
    n_persons, n_items = data.shape
    n_categories = len(thresholds) + 1 if thresholds.ndim == 1 else thresholds.shape[1] + 1

    infit_mnsq = np.zeros(n_items)
    outfit_mnsq = np.zeros(n_items)
    infit_zstd = np.zeros(n_items)
    outfit_zstd = np.zeros(n_items)

    for j in range(n_items):
        item_thresholds = thresholds if model_type == ModelType.RSM else thresholds[j]

        squared_residuals = []
        variances = []

        for i in range(n_persons):
            if np.isnan(data[i, j]):
                continue

            observed = int(data[i, j])

            # Calculate expected value and variance
            expected = 0.0
            expected_sq = 0.0

            for k in range(n_categories):
                p_k = compute_category_probability(theta[i], difficulty[j], item_thresholds, k)
                expected += k * p_k
                expected_sq += k * k * p_k

            variance = expected_sq - expected ** 2
            variance = max(variance, 0.01)  # Prevent division by zero

            # Standardized residual
            residual = observed - expected
            z_squared = (residual ** 2) / variance

            squared_residuals.append(z_squared)
            variances.append(variance)

        if len(squared_residuals) == 0:
            infit_mnsq[j] = 1.0
            outfit_mnsq[j] = 1.0
            continue

        squared_residuals = np.array(squared_residuals)
        variances = np.array(variances)

        # Outfit: unweighted mean square
        outfit_mnsq[j] = np.mean(squared_residuals)

        # Infit: variance-weighted mean square
        infit_mnsq[j] = np.sum(squared_residuals * variances) / np.sum(variances)

        # Standardized fit statistics (Wilson-Hilferty cube root transformation)
        n_obs = len(squared_residuals)

        # Approximate standard error of MNSQ
        q = np.sqrt(2.0 / n_obs) if n_obs > 0 else 1.0

        # ZSTD transformation
        infit_zstd[j] = (np.cbrt(infit_mnsq[j]) - 1) * (3 / q) + (q / 3)
        outfit_zstd[j] = (np.cbrt(outfit_mnsq[j]) - 1) * (3 / q) + (q / 3)

    return infit_mnsq, outfit_mnsq, infit_zstd, outfit_zstd


def compute_polytomous_log_likelihood(
    data: np.ndarray,
    difficulty: np.ndarray,
    thresholds: np.ndarray,
    theta: np.ndarray,
    model_type: ModelType,
) -> float:
    """Compute log-likelihood for polytomous model."""
    n_persons, n_items = data.shape
    log_lik = 0.0

    for i in range(n_persons):
        for j in range(n_items):
            if not np.isnan(data[i, j]):
                k = int(data[i, j])
                item_thresholds = thresholds if model_type == ModelType.RSM else thresholds[j]
                p_k = compute_category_probability(theta[i], difficulty[j], item_thresholds, k)
                p_k = max(p_k, 1e-10)
                log_lik += np.log(p_k)

    return log_lik


def compute_category_probability_curves(
    item_parameters: dict[str, Any],
    model_type: ModelType,
    selected_item: str | None = None,
) -> list[dict[str, Any]]:
    """
    Generate category probability curve data for visualization.

    Args:
        item_parameters: Dict with 'items' list containing item parameter data
        model_type: RSM or PCM
        selected_item: Optional item name to generate curves for (all items if None)

    Returns:
        List of curve data dicts with item_name, category, and data points
    """
    items = item_parameters.get("items", [])
    theta_range = np.linspace(-4, 4, 81)

    curves = []

    for item in items:
        if selected_item is not None and item["name"] != selected_item:
            continue

        item_thresholds = np.array(item.get("thresholds", []))
        difficulty = item.get("difficulty", 0.0)
        n_categories = len(item_thresholds) + 1

        for k in range(n_categories):
            probabilities = [
                compute_category_probability(t, difficulty, item_thresholds, k)
                for t in theta_range
            ]

            curves.append({
                "item_name": item["name"],
                "category": k,
                "data": [
                    {"theta": float(t), "probability": float(p)}
                    for t, p in zip(theta_range, probabilities)
                ],
            })

    return curves


def compute_wright_map_data(
    item_parameters: dict[str, Any],
    ability_estimates: dict[str, Any],
    model_type: ModelType,
) -> dict[str, Any]:
    """
    Generate Wright map data for person-item targeting visualization.

    Args:
        item_parameters: Dict with 'items' list
        ability_estimates: Dict with 'persons' list
        model_type: RSM or PCM

    Returns:
        Dict with persons distribution, items locations, and logit scale bounds
    """
    items = item_parameters.get("items", [])
    persons = ability_estimates.get("persons", [])

    # Extract theta values and create histogram
    theta_values = [p["theta"] for p in persons]

    # Create binned distribution of persons
    bins = np.linspace(-4, 4, 33)  # 32 bins
    hist, bin_edges = np.histogram(theta_values, bins=bins)

    person_distribution = [
        {"theta": float((bin_edges[i] + bin_edges[i+1]) / 2), "count": int(hist[i])}
        for i in range(len(hist))
        if hist[i] > 0
    ]

    # Extract item locations with thresholds
    item_locations = []
    for item in items:
        thresholds = item.get("thresholds", [])
        item_locations.append({
            "name": item["name"],
            "difficulty": item.get("difficulty", 0.0),
            "thresholds": thresholds,
        })

    # Determine logit scale bounds
    all_values = theta_values.copy()
    for item in items:
        all_values.append(item.get("difficulty", 0.0))
        all_values.extend(item.get("thresholds", []))

    min_logit = min(-4.0, min(all_values) - 0.5) if all_values else -4.0
    max_logit = max(4.0, max(all_values) + 0.5) if all_values else 4.0

    return {
        "persons": person_distribution,
        "items": item_locations,
        "min_logit": float(min_logit),
        "max_logit": float(max_logit),
    }


def compute_category_structure_analysis(
    data: np.ndarray,
    difficulty: np.ndarray,
    thresholds: np.ndarray,
    theta: np.ndarray,
    model_type: ModelType,
) -> list[dict[str, Any]]:
    """
    Compute category structure analysis with observed averages and thresholds.

    Returns:
        List of category statistics dicts
    """
    n_categories = len(thresholds) + 1 if thresholds.ndim == 1 else thresholds.shape[1] + 1

    # Average thresholds for RSM (or across items for summary)
    if model_type == ModelType.RSM or thresholds.ndim == 1:
        avg_thresholds = thresholds if thresholds.ndim == 1 else np.mean(thresholds, axis=0)
    else:
        avg_thresholds = np.mean(thresholds, axis=0)

    category_stats = []

    for k in range(n_categories):
        # Count responses in this category
        count = int(np.sum(data == k))

        # Calculate observed average ability for this category
        indices = np.where(data == k)
        if len(indices[0]) > 0:
            observed_thetas = theta[indices[0]]
            observed_average = float(np.mean(observed_thetas))
        else:
            observed_average = 0.0

        # Andrich threshold (between k-1 and k)
        andrich_threshold = None
        if k > 0 and k - 1 < len(avg_thresholds):
            andrich_threshold = float(avg_thresholds[k - 1])

        category_stats.append({
            "category": k,
            "count": count,
            "observed_average": observed_average,
            "andrich_threshold": andrich_threshold,
            "se_threshold": None,  # Would need bootstrap
        })

    return category_stats


def is_polytomous_model(model_type: ModelType) -> bool:
    """Check if model type is a polytomous model."""
    return model_type in (ModelType.RSM, ModelType.PCM)
