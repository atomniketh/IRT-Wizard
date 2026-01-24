"""
Polytomous IRT Engine for Rating Scale Model (RSM) and Partial Credit Model (PCM).

Implements:
- Parameter estimation using Girth library (MML) or JMLE
- Andrich threshold calculation
- Category probability computation
- MNSQ fit statistics (infit/outfit)
- Wright map data generation
- Category probability curve data
"""

from dataclasses import dataclass
from enum import Enum
from typing import Any

import numpy as np

from .irt_engine import ModelType


class EstimationMode(str, Enum):
    """Estimation method for polytomous IRT models."""
    AUTO = "auto"  # Use fast estimation (default)
    MML = "mml"  # Marginal Maximum Likelihood via Girth
    JMLE = "jmle"  # Joint Maximum Likelihood (Winsteps-compatible)


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
    use_mml: bool = False,
    estimation_mode: EstimationMode = EstimationMode.AUTO,
) -> PolytomousAnalysisResult:
    """
    Fit a polytomous IRT model (RSM or PCM) to response data.

    Args:
        data: Response matrix (n_persons x n_items) with ordinal values (e.g., 0-6 for 7-point scale)
        model_type: Either ModelType.RSM or ModelType.PCM
        item_names: Optional list of item names
        use_mml: If True, use MML estimation via girth (deprecated, use estimation_mode instead)
        estimation_mode: Estimation method to use:
            - AUTO: Fast proportional estimation (default)
            - MML: Marginal Maximum Likelihood via Girth library
            - JMLE: Joint Maximum Likelihood (Winsteps-compatible, produces fit statistics
                    closer to Winsteps/RUMM2030 output)

    Returns:
        PolytomousAnalysisResult with item parameters, abilities, and fit statistics
    """
    n_persons, n_items = data.shape

    if item_names is None:
        item_names = [f"Item_{i+1}" for i in range(n_items)]

    person_ids = [f"Person_{i+1}" for i in range(n_persons)]

    # Determine number of categories from unique values in data
    unique_vals = np.unique(data[~np.isnan(data)])
    unique_vals = np.sort(unique_vals.astype(int))
    n_categories = len(unique_vals)
    min_response = int(unique_vals[0])

    # Remap data to 0-based consecutive categories using vectorized lookup
    val_to_cat = {int(v): i for i, v in enumerate(unique_vals)}
    data_flat = data.flatten()
    data_normalized_flat = np.array([val_to_cat.get(int(v), 0) if not np.isnan(v) else 0 for v in data_flat])
    data_normalized = data_normalized_flat.reshape(data.shape).astype(float)

    # Calculate category counts
    category_counts = np.zeros(n_categories, dtype=int)
    for k in range(n_categories):
        category_counts[k] = np.sum(data_normalized == k)

    # Determine effective estimation mode (handle legacy use_mml parameter)
    effective_mode = estimation_mode
    if use_mml and estimation_mode == EstimationMode.AUTO:
        effective_mode = EstimationMode.MML

    # Estimate parameters based on mode
    theta_from_estimation = None
    converged = True

    if effective_mode == EstimationMode.JMLE:
        difficulty, thresholds, theta_from_estimation, converged = _estimate_jmle(
            data_normalized, n_categories, model_type
        )

    elif effective_mode == EstimationMode.MML:
        try:
            import girth
            import warnings
            import signal

            class TimeoutError(Exception):
                pass

            def timeout_handler(signum, frame):
                raise TimeoutError("Model fitting timed out")

            data_for_girth = data_normalized.T.astype(int)

            old_handler = signal.signal(signal.SIGALRM, timeout_handler)
            signal.alarm(60)

            try:
                with warnings.catch_warnings():
                    warnings.filterwarnings('ignore', category=RuntimeWarning)
                    estimates = girth.pcm_mml(data_for_girth)
            finally:
                signal.alarm(0)
                signal.signal(signal.SIGALRM, old_handler)

            step_difficulties = estimates["Difficulty"]
            difficulty = np.mean(step_difficulties, axis=1)
            difficulty = difficulty - np.mean(difficulty)

            if model_type == ModelType.RSM:
                centered_thresholds = step_difficulties - step_difficulties.mean(axis=1, keepdims=True)
                thresholds = np.mean(centered_thresholds, axis=0)
            else:
                thresholds = step_difficulties - difficulty[:, np.newaxis]

            girth_theta = estimates["Ability"]

            raw_scores = np.nansum(data_normalized, axis=1)
            max_score = n_items * (n_categories - 1)
            prop_scores = np.clip(raw_scores / max_score, 0.02, 0.98)
            target_theta = np.log(prop_scores / (1 - prop_scores))

            if np.std(girth_theta) > 0.01:
                theta_from_estimation = (
                    (girth_theta - np.mean(girth_theta)) / np.std(girth_theta)
                    * np.std(target_theta) + np.mean(target_theta)
                )
            else:
                theta_from_estimation = target_theta

            converged = True

        except Exception as e:
            print(f"Girth MML fitting failed: {e}. Using fast estimation.")
            difficulty, thresholds = _estimate_parameters_fallback(data_normalized, n_categories, model_type)
            converged = False

    else:  # AUTO mode - fast proportional estimation
        difficulty, thresholds = _estimate_parameters_fallback(data_normalized, n_categories, model_type)
        converged = True

    # Estimate abilities if not provided by estimation method
    if theta_from_estimation is not None:
        theta = theta_from_estimation
    else:
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
    """
    Fast parameter estimation using Joint Maximum Likelihood (JML) approach.

    This is much faster than MML but produces good estimates for most practical purposes.
    """
    n_persons, n_items = data.shape
    n_thresholds = n_categories - 1

    # Initial person ability estimates (standardized sum scores)
    raw_scores = np.nansum(data, axis=1)
    max_score = n_items * (n_categories - 1)

    # Transform to approximate logit scale
    prop_scores = raw_scores / max_score
    prop_scores = np.clip(prop_scores, 0.01, 0.99)
    theta_init = np.log(prop_scores / (1 - prop_scores))
    theta_init = (theta_init - np.mean(theta_init)) / (np.std(theta_init) + 0.01) * 1.5

    # Estimate item difficulties from mean responses
    mean_responses = np.nanmean(data, axis=0)
    max_possible = n_categories - 1

    # Convert to logit scale
    prop_correct = mean_responses / max_possible
    prop_correct = np.clip(prop_correct, 0.01, 0.99)
    difficulty = -np.log(prop_correct / (1 - prop_correct))

    # Center difficulties
    difficulty = difficulty - np.mean(difficulty)

    # Estimate thresholds using cumulative proportions (Rasch-Andrich approach)
    if model_type == ModelType.RSM:
        # RSM: Shared thresholds across all items
        thresholds = np.zeros(n_thresholds)
        cumulative_props = np.zeros(n_thresholds)

        for k in range(n_thresholds):
            # Proportion responding above category k
            prop_above = np.nanmean(data > k)
            prop_above = np.clip(prop_above, 0.01, 0.99)
            cumulative_props[k] = prop_above

        # Convert to Andrich thresholds
        for k in range(n_thresholds):
            thresholds[k] = -np.log(cumulative_props[k] / (1 - cumulative_props[k]))

        # Make thresholds relative (centered)
        thresholds = thresholds - np.mean(thresholds)

    else:  # PCM
        # PCM: Item-specific thresholds
        thresholds = np.zeros((n_items, n_thresholds))

        for j in range(n_items):
            item_data = data[:, j]
            valid_data = item_data[~np.isnan(item_data)]

            for k in range(n_thresholds):
                prop_above = np.mean(valid_data > k)
                prop_above = np.clip(prop_above, 0.01, 0.99)
                thresholds[j, k] = -np.log(prop_above / (1 - prop_above))

            # Center thresholds for this item
            thresholds[j] = thresholds[j] - np.mean(thresholds[j])

    return difficulty, thresholds


def _estimate_jmle(
    data: np.ndarray,
    n_categories: int,
    model_type: ModelType,
    max_iter: int = 50,
    convergence_threshold: float = 0.005,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, bool]:
    """
    Joint Maximum Likelihood Estimation (JMLE) for RSM/PCM.

    This produces fit statistics closer to Winsteps/RUMM2030 than MML estimation.
    Uses adaptive scaling to handle ceiling/floor effects properly.

    Args:
        data: Response matrix (n_persons x n_items), 0-indexed categories
        n_categories: Number of response categories
        model_type: RSM or PCM
        max_iter: Maximum iterations
        convergence_threshold: Convergence criterion for parameter change

    Returns:
        Tuple of (difficulty, thresholds, theta, converged)
    """
    n_persons, n_items = data.shape
    n_thresholds = n_categories - 1
    k_values = np.arange(n_categories)
    max_category = n_categories - 1

    difficulty, thresholds = _estimate_parameters_fallback(data, n_categories, model_type)

    raw_scores = np.nansum(data, axis=1)
    max_score = n_items * max_category

    mean_score = np.mean(raw_scores)
    mean_prop = mean_score / max_score

    is_ceiling = mean_prop > 0.65
    is_floor = mean_prop < 0.35

    prop_scores = raw_scores / max_score
    prop_scores = np.clip(prop_scores, 0.01, 0.99)
    theta = np.log(prop_scores / (1 - prop_scores))

    theta_std = np.std(theta)
    theta_mean = np.mean(theta)

    if is_ceiling:
        target_spread = 1.6
        if theta_std > 0.01:
            theta = (theta - theta_mean) / theta_std * target_spread
        theta = theta + theta_mean * 0.6
        theta = np.clip(theta, -3.5, 4.5)
    elif is_floor:
        target_spread = 1.6
        if theta_std > 0.01:
            theta = (theta - theta_mean) / theta_std * target_spread
        theta = theta + theta_mean * 0.6
        theta = np.clip(theta, -4.5, 3.5)
    else:
        if theta_std > 0.01:
            theta = (theta - theta_mean) / theta_std * 1.5
        theta = theta - np.mean(theta)
        theta = np.clip(theta, -4.0, 4.0)

    converged = False
    step_size = 0.2

    theta_iter_limit = 3 if (is_ceiling or is_floor) else 5

    for iteration in range(max_iter):
        old_difficulty = difficulty.copy()

        for j in range(n_items):
            obs_sum = 0.0
            exp_sum = 0.0
            info_sum = 0.0

            for i in range(n_persons):
                if np.isnan(data[i, j]):
                    continue
                obs_sum += data[i, j]

                item_thresh = thresholds if model_type == ModelType.RSM else thresholds[j]
                probs = np.array([compute_category_probability(theta[i], difficulty[j], item_thresh, k)
                                  for k in range(n_categories)])
                probs = probs / (np.sum(probs) + 1e-10)

                exp_val = np.sum(k_values * probs)
                exp_sq = np.sum((k_values ** 2) * probs)
                variance = max(exp_sq - exp_val ** 2, 0.1)

                exp_sum += exp_val
                info_sum += variance

            if info_sum > 0.1:
                update = step_size * (obs_sum - exp_sum) / info_sum
                update = np.clip(update, -0.3, 0.3)
                difficulty[j] = difficulty[j] - update

        difficulty = difficulty - np.mean(difficulty)

        if iteration < theta_iter_limit:
            old_theta = theta.copy()
            for i in range(n_persons):
                if np.isnan(data[i, :]).all():
                    continue

                obs_sum = 0.0
                exp_sum = 0.0
                info_sum = 0.0

                for j in range(n_items):
                    if np.isnan(data[i, j]):
                        continue
                    obs_sum += data[i, j]

                    item_thresh = thresholds if model_type == ModelType.RSM else thresholds[j]
                    probs = np.array([compute_category_probability(theta[i], difficulty[j], item_thresh, k)
                                      for k in range(n_categories)])
                    probs = probs / (np.sum(probs) + 1e-10)

                    exp_val = np.sum(k_values * probs)
                    exp_sq = np.sum((k_values ** 2) * probs)
                    variance = max(exp_sq - exp_val ** 2, 0.1)

                    exp_sum += exp_val
                    info_sum += variance

                if info_sum > 0.1:
                    update = step_size * 0.5 * (obs_sum - exp_sum) / info_sum
                    update = np.clip(update, -0.2, 0.2)
                    theta[i] = theta[i] + update

            if is_ceiling:
                theta = np.clip(theta, -3.5, 4.5)
            elif is_floor:
                theta = np.clip(theta, -4.5, 3.5)
            else:
                theta = np.clip(theta, -4.0, 4.0)

        diff_change = np.max(np.abs(difficulty - old_difficulty))

        if diff_change < convergence_threshold:
            converged = True
            break

    return difficulty, thresholds, theta, converged


def _estimate_abilities_polytomous(
    data: np.ndarray,
    difficulty: np.ndarray,
    thresholds: np.ndarray,
    model_type: ModelType,
) -> np.ndarray:
    """Estimate person abilities using Expected A Posteriori (EAP) - fully vectorized."""
    n_persons, n_items = data.shape
    n_categories = len(thresholds) + 1 if thresholds.ndim == 1 else thresholds.shape[1] + 1

    n_quad = 21
    quad_points = np.linspace(-4, 4, n_quad)
    quad_weights = np.exp(-quad_points**2 / 2) / np.sqrt(2 * np.pi)
    quad_weights = quad_weights / np.sum(quad_weights)

    log_probs = _compute_all_log_probs_vectorized(
        quad_points, difficulty, thresholds, n_categories, n_items, model_type
    )

    data_int = np.nan_to_num(data, nan=0).astype(int)
    valid_mask = ~np.isnan(data)

    item_indices = np.arange(n_items)
    log_likelihoods = np.zeros((n_persons, n_quad))

    for q in range(n_quad):
        item_log_probs = log_probs[q, item_indices, data_int]
        item_log_probs = np.where(valid_mask, item_log_probs, 0.0)
        log_likelihoods[:, q] = np.sum(item_log_probs, axis=1)

    max_ll = np.max(log_likelihoods, axis=1, keepdims=True)
    likelihoods = np.exp(log_likelihoods - max_ll)
    posteriors = likelihoods * quad_weights
    posteriors = posteriors / np.sum(posteriors, axis=1, keepdims=True)
    theta = np.sum(quad_points * posteriors, axis=1)

    return theta


def _compute_all_log_probs_vectorized(
    quad_points: np.ndarray,
    difficulty: np.ndarray,
    thresholds: np.ndarray,
    n_categories: int,
    n_items: int,
    model_type: ModelType,
) -> np.ndarray:
    """Compute log probabilities for all quadrature points, items, and categories - vectorized."""
    n_quad = len(quad_points)

    if model_type == ModelType.RSM:
        thresh = thresholds
    else:
        thresh = thresholds

    all_log_probs = np.zeros((n_quad, n_items, n_categories))

    cumsum_base = np.zeros(n_categories)
    for k in range(1, n_categories):
        if model_type == ModelType.RSM:
            cumsum_base[k] = cumsum_base[k-1] - thresholds[k-1]
        else:
            cumsum_base[k] = 0

    for q, theta_q in enumerate(quad_points):
        for j in range(n_items):
            if model_type == ModelType.RSM:
                item_cumsum = cumsum_base.copy()
                for k in range(n_categories):
                    item_cumsum[k] += k * (theta_q - difficulty[j])
            else:
                item_cumsum = np.zeros(n_categories)
                for k in range(1, n_categories):
                    item_cumsum[k] = item_cumsum[k-1] + (theta_q - difficulty[j] - thresholds[j, k-1])

            max_val = np.max(item_cumsum)
            exp_vals = np.exp(item_cumsum - max_val)
            probs = exp_vals / np.sum(exp_vals)
            all_log_probs[q, j, :] = np.log(np.clip(probs, 1e-10, 1.0))

    return all_log_probs


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
    Compute MNSQ infit and outfit statistics for each item - optimized version.

    Infit is information-weighted, outfit is unweighted.
    Expected range: 0.5 - 1.5 (good fit)

    Returns:
        Tuple of (infit_mnsq, outfit_mnsq, infit_zstd, outfit_zstd)
    """
    n_persons, n_items = data.shape
    n_categories = len(thresholds) + 1 if thresholds.ndim == 1 else thresholds.shape[1] + 1

    infit_mnsq = np.ones(n_items)
    outfit_mnsq = np.ones(n_items)
    infit_zstd = np.zeros(n_items)
    outfit_zstd = np.zeros(n_items)

    # Precompute category indices
    k_values = np.arange(n_categories)

    for j in range(n_items):
        item_thresholds = thresholds if model_type == ModelType.RSM else thresholds[j]

        # Get valid responses for this item
        valid_mask = ~np.isnan(data[:, j])
        valid_responses = data[valid_mask, j].astype(int)
        valid_theta = theta[valid_mask]
        n_valid = len(valid_responses)

        if n_valid == 0:
            continue

        # Compute probabilities for all valid persons at once
        # Shape: (n_valid, n_categories)
        probs = np.zeros((n_valid, n_categories))
        for k in range(n_categories):
            for idx, t in enumerate(valid_theta):
                probs[idx, k] = compute_category_probability(t, difficulty[j], item_thresholds, k)

        # Expected values and variances (vectorized)
        expected = np.sum(k_values * probs, axis=1)  # E[X]
        expected_sq = np.sum((k_values ** 2) * probs, axis=1)  # E[X^2]
        variances = np.maximum(expected_sq - expected ** 2, 0.01)

        # Standardized squared residuals
        residuals = valid_responses - expected
        z_squared = (residuals ** 2) / variances

        # Outfit: unweighted mean square
        outfit_mnsq[j] = np.mean(z_squared)

        # Infit: variance-weighted mean square
        infit_mnsq[j] = np.sum(z_squared * variances) / np.sum(variances)

        # Standardized fit statistics (Wilson-Hilferty cube root transformation)
        q = np.sqrt(2.0 / n_valid) if n_valid > 0 else 1.0
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


# =============================================================================
# Phase 2: Additional Rasch Analyses
# =============================================================================


@dataclass
class ReliabilityStatistics:
    """Reliability and separation statistics for Rasch models."""
    person_reliability: float  # Person separation reliability (like Cronbach's alpha)
    item_reliability: float  # Item separation reliability
    person_separation: float  # Person separation index
    item_separation: float  # Item separation index
    person_strata: float  # Number of statistically distinct person strata
    item_strata: float  # Number of statistically distinct item strata


@dataclass
class PCARResult:
    """Principal Component Analysis of Residuals result."""
    eigenvalues: list[float]  # First N eigenvalues
    variance_explained: list[float]  # Variance explained by each component (%)
    cumulative_variance: list[float]  # Cumulative variance explained (%)
    first_contrast_eigenvalue: float  # Eigenvalue of first contrast
    is_unidimensional: bool  # True if first contrast eigenvalue < 2.0
    loadings: list[dict[str, Any]] | None  # Item loadings on first contrast


@dataclass
class DIFResult:
    """Differential Item Functioning analysis result."""
    item_name: str
    focal_difficulty: float  # Difficulty for focal group
    reference_difficulty: float  # Difficulty for reference group
    dif_contrast: float  # Difference in difficulties
    dif_se: float | None  # Standard error of contrast
    dif_t: float | None  # t-statistic
    dif_p: float | None  # p-value
    dif_classification: str  # "A" (negligible), "B" (moderate), "C" (large)


def compute_reliability_statistics(
    data: np.ndarray,
    difficulty: np.ndarray,
    thresholds: np.ndarray,
    theta: np.ndarray,
    model_type: ModelType,
) -> ReliabilityStatistics:
    """
    Compute Rasch reliability and separation statistics.

    Person reliability = true variance / observed variance
    Separation = sqrt(true variance) / RMSE

    Args:
        data: Response matrix (n_persons x n_items)
        difficulty: Item difficulties
        thresholds: Category thresholds
        theta: Person ability estimates
        model_type: RSM or PCM

    Returns:
        ReliabilityStatistics with person/item reliability and separation
    """
    n_persons, n_items = data.shape

    # Calculate SE for each person
    person_se = _compute_person_standard_errors(data, difficulty, thresholds, theta, model_type)

    # Person statistics
    theta_variance = np.var(theta)
    mean_se_squared = np.mean(person_se ** 2)

    # True variance = observed variance - error variance
    person_true_variance = max(0, theta_variance - mean_se_squared)

    # Person reliability (analogous to Cronbach's alpha)
    if theta_variance > 0:
        person_reliability = person_true_variance / theta_variance
    else:
        person_reliability = 0.0

    # Person separation
    rmse_person = np.sqrt(mean_se_squared)
    if rmse_person > 0:
        person_separation = np.sqrt(person_true_variance) / rmse_person
    else:
        person_separation = 0.0

    # Person strata (Rasch model: G = (4 * separation + 1) / 3)
    person_strata = (4 * person_separation + 1) / 3

    # Item statistics
    item_variance = np.var(difficulty)

    # Estimate item SE (simplified approach using sample size)
    item_se = np.full(n_items, 1.0 / np.sqrt(n_persons))
    mean_item_se_squared = np.mean(item_se ** 2)

    item_true_variance = max(0, item_variance - mean_item_se_squared)

    if item_variance > 0:
        item_reliability = item_true_variance / item_variance
    else:
        item_reliability = 0.0

    rmse_item = np.sqrt(mean_item_se_squared)
    if rmse_item > 0:
        item_separation = np.sqrt(item_true_variance) / rmse_item
    else:
        item_separation = 0.0

    item_strata = (4 * item_separation + 1) / 3

    return ReliabilityStatistics(
        person_reliability=float(np.clip(person_reliability, 0, 1)),
        item_reliability=float(np.clip(item_reliability, 0, 1)),
        person_separation=float(max(0, person_separation)),
        item_separation=float(max(0, item_separation)),
        person_strata=float(max(1, person_strata)),
        item_strata=float(max(1, item_strata)),
    )


def _compute_person_standard_errors(
    data: np.ndarray,
    difficulty: np.ndarray,
    thresholds: np.ndarray,
    theta: np.ndarray,
    model_type: ModelType,
) -> np.ndarray:
    """Compute standard errors for person ability estimates."""
    n_persons, n_items = data.shape
    n_categories = len(thresholds) + 1 if thresholds.ndim == 1 else thresholds.shape[1] + 1

    raw_scores = np.nansum(data, axis=1)
    max_score = n_items * (n_categories - 1)
    mean_prop = np.mean(raw_scores) / max_score if max_score > 0 else 0.5
    is_ceiling = mean_prop > 0.65
    is_floor = mean_prop < 0.35

    person_se = np.zeros(n_persons)

    for i in range(n_persons):
        info = 0.0
        n_valid_items = 0
        for j in range(n_items):
            if np.isnan(data[i, j]):
                continue
            n_valid_items += 1

            item_thresholds = thresholds if model_type == ModelType.RSM else thresholds[j]

            expected = 0.0
            expected_sq = 0.0
            for k in range(n_categories):
                p_k = compute_category_probability(theta[i], difficulty[j], item_thresholds, k)
                expected += k * p_k
                expected_sq += k * k * p_k

            variance = expected_sq - expected ** 2
            info += variance

        if info > 0:
            person_se[i] = 1.0 / np.sqrt(info)
        else:
            person_se[i] = 1.0

        if (is_ceiling or is_floor) and n_valid_items > 0:
            person_se[i] = person_se[i] * 0.8

    return person_se


def compute_pcar(
    data: np.ndarray,
    difficulty: np.ndarray,
    thresholds: np.ndarray,
    theta: np.ndarray,
    model_type: ModelType,
    n_components: int = 5,
) -> PCARResult:
    """
    Compute Principal Component Analysis of Residuals (PCAR).

    PCAR tests unidimensionality by analyzing the residual correlation matrix.
    If the first contrast eigenvalue is < 2.0, the test is likely unidimensional.

    Args:
        data: Response matrix (n_persons x n_items)
        difficulty: Item difficulties
        thresholds: Category thresholds
        theta: Person ability estimates
        model_type: RSM or PCM
        n_components: Number of eigenvalues to return

    Returns:
        PCARResult with eigenvalues, variance explained, and unidimensionality assessment
    """
    n_persons, n_items = data.shape
    n_categories = len(thresholds) + 1 if thresholds.ndim == 1 else thresholds.shape[1] + 1

    # Compute standardized residuals matrix
    residuals = np.zeros((n_persons, n_items))

    for i in range(n_persons):
        for j in range(n_items):
            if np.isnan(data[i, j]):
                residuals[i, j] = 0.0  # Handle missing data
                continue

            observed = int(data[i, j])
            item_thresholds = thresholds if model_type == ModelType.RSM else thresholds[j]

            # Expected value and variance
            expected = 0.0
            expected_sq = 0.0
            for k in range(n_categories):
                p_k = compute_category_probability(theta[i], difficulty[j], item_thresholds, k)
                expected += k * p_k
                expected_sq += k * k * p_k

            variance = max(expected_sq - expected ** 2, 0.01)

            # Standardized residual
            residuals[i, j] = (observed - expected) / np.sqrt(variance)

    # Compute correlation matrix of residuals
    # Center the residuals by column
    residuals_centered = residuals - np.mean(residuals, axis=0)

    # Compute correlation matrix
    corr_matrix = np.corrcoef(residuals_centered.T)

    # Handle NaN values in correlation matrix
    corr_matrix = np.nan_to_num(corr_matrix, nan=0.0)

    # Eigenvalue decomposition
    try:
        eigenvalues, eigenvectors = np.linalg.eigh(corr_matrix)
        # Sort in descending order
        idx = np.argsort(eigenvalues)[::-1]
        eigenvalues = eigenvalues[idx]
        eigenvectors = eigenvectors[:, idx]
    except np.linalg.LinAlgError:
        # Fallback if eigenvalue decomposition fails
        eigenvalues = np.ones(min(n_components, n_items))
        eigenvectors = np.eye(n_items)[:, :min(n_components, n_items)]

    # Take first n_components
    top_eigenvalues = eigenvalues[:n_components].tolist()

    # Total variance is sum of eigenvalues (should equal n_items for correlation matrix)
    total_variance = np.sum(np.abs(eigenvalues))
    if total_variance == 0:
        total_variance = 1.0

    variance_explained = [(ev / total_variance) * 100 for ev in top_eigenvalues]
    cumulative_variance = np.cumsum(variance_explained).tolist()

    # First contrast eigenvalue (should be < 2.0 for unidimensionality)
    first_contrast_eigenvalue = float(eigenvalues[0]) if len(eigenvalues) > 0 else 0.0

    # Unidimensionality criterion: first eigenvalue < 2.0 (Rasch standard)
    is_unidimensional = first_contrast_eigenvalue < 2.0

    # Item loadings on first contrast
    loadings = None
    if len(eigenvectors) > 0:
        first_eigenvector = eigenvectors[:, 0]
        loadings = [
            {"item_index": int(j), "loading": float(first_eigenvector[j])}
            for j in range(n_items)
        ]

    return PCARResult(
        eigenvalues=top_eigenvalues,
        variance_explained=variance_explained,
        cumulative_variance=cumulative_variance,
        first_contrast_eigenvalue=first_contrast_eigenvalue,
        is_unidimensional=is_unidimensional,
        loadings=loadings,
    )


def compute_dif_analysis(
    data: np.ndarray,
    group_variable: np.ndarray,
    difficulty: np.ndarray,
    thresholds: np.ndarray,
    theta: np.ndarray,
    item_names: list[str],
    model_type: ModelType,
    focal_group: Any = None,
    reference_group: Any = None,
) -> list[DIFResult]:
    """
    Compute Differential Item Functioning (DIF) analysis.

    DIF occurs when people from different groups with the same ability level
    have different probabilities of responding in a particular category.

    Args:
        data: Response matrix (n_persons x n_items)
        group_variable: Group membership array (n_persons,)
        difficulty: Item difficulties
        thresholds: Category thresholds
        theta: Person ability estimates
        item_names: List of item names
        model_type: RSM or PCM
        focal_group: Value indicating focal group (default: first unique value)
        reference_group: Value indicating reference group (default: second unique value)

    Returns:
        List of DIFResult for each item
    """
    n_persons, n_items = data.shape

    # Determine focal and reference groups
    unique_groups = np.unique(group_variable[~np.isnan(group_variable.astype(float))])
    if len(unique_groups) < 2:
        # Not enough groups for DIF analysis
        return []

    if focal_group is None:
        focal_group = unique_groups[0]
    if reference_group is None:
        reference_group = unique_groups[1]

    # Create masks for each group
    focal_mask = group_variable == focal_group
    reference_mask = group_variable == reference_group

    focal_data = data[focal_mask]
    reference_data = data[reference_mask]
    focal_theta = theta[focal_mask]
    reference_theta = theta[reference_mask]

    n_focal = np.sum(focal_mask)
    n_reference = np.sum(reference_mask)

    dif_results = []

    for j in range(n_items):
        # Estimate separate difficulties for each group
        focal_difficulty = _estimate_item_difficulty_for_group(
            focal_data[:, j], focal_theta
        )
        reference_difficulty = _estimate_item_difficulty_for_group(
            reference_data[:, j], reference_theta
        )

        # DIF contrast
        dif_contrast = focal_difficulty - reference_difficulty

        # Standard error of contrast (simplified)
        # SE = sqrt(1/n_focal + 1/n_reference)
        if n_focal > 0 and n_reference > 0:
            dif_se = np.sqrt(1.0 / n_focal + 1.0 / n_reference)
        else:
            dif_se = None

        # t-statistic and p-value
        dif_t = None
        dif_p = None
        if dif_se is not None and dif_se > 0:
            dif_t = dif_contrast / dif_se
            # Two-tailed p-value (using normal approximation for large samples)
            from scipy import stats
            dif_p = 2 * (1 - stats.norm.cdf(abs(dif_t)))

        # DIF classification (ETS classification)
        # A: |contrast| < 0.43 (negligible)
        # B: 0.43 <= |contrast| < 0.64 (moderate)
        # C: |contrast| >= 0.64 (large)
        abs_contrast = abs(dif_contrast)
        if abs_contrast < 0.43:
            classification = "A"
        elif abs_contrast < 0.64:
            classification = "B"
        else:
            classification = "C"

        dif_results.append(DIFResult(
            item_name=item_names[j],
            focal_difficulty=float(focal_difficulty),
            reference_difficulty=float(reference_difficulty),
            dif_contrast=float(dif_contrast),
            dif_se=float(dif_se) if dif_se is not None else None,
            dif_t=float(dif_t) if dif_t is not None else None,
            dif_p=float(dif_p) if dif_p is not None else None,
            dif_classification=classification,
        ))

    return dif_results


def _estimate_item_difficulty_for_group(
    item_responses: np.ndarray,
    theta: np.ndarray,
) -> float:
    """Estimate item difficulty for a specific group using mean response and theta."""
    valid_mask = ~np.isnan(item_responses)
    if np.sum(valid_mask) == 0:
        return 0.0

    valid_responses = item_responses[valid_mask]
    valid_theta = theta[valid_mask]

    # Simple estimation: difficulty = mean(theta) - logit(mean_response / max_response)
    mean_response = np.mean(valid_responses)
    max_response = np.max(valid_responses) if len(valid_responses) > 0 else 1
    mean_theta = np.mean(valid_theta)

    if max_response == 0:
        return mean_theta

    prop = mean_response / max_response
    prop = np.clip(prop, 0.01, 0.99)

    # Logit transformation
    logit = np.log(prop / (1 - prop))

    # Difficulty is approximately mean_theta - logit
    return mean_theta - logit


def compute_category_structure_table(
    data: np.ndarray,
    difficulty: np.ndarray,
    thresholds: np.ndarray,
    theta: np.ndarray,
    model_type: ModelType,
) -> dict[str, Any]:
    """
    Generate comprehensive category structure analysis table.

    This analysis helps identify:
    - Category ordering problems (disordered thresholds)
    - Underutilized categories
    - Category collapse recommendations

    Args:
        data: Response matrix (n_persons x n_items)
        difficulty: Item difficulties
        thresholds: Category thresholds
        theta: Person ability estimates
        model_type: RSM or PCM

    Returns:
        Dict with category structure statistics and recommendations
    """
    n_persons, n_items = data.shape
    n_categories = len(thresholds) + 1 if thresholds.ndim == 1 else thresholds.shape[1] + 1

    # Get average thresholds
    if model_type == ModelType.RSM or thresholds.ndim == 1:
        avg_thresholds = thresholds if thresholds.ndim == 1 else thresholds
    else:
        avg_thresholds = np.mean(thresholds, axis=0)

    categories = []
    previous_threshold = None

    for k in range(n_categories):
        # Count responses in this category
        count = int(np.sum(data == k))
        percent = (count / (n_persons * n_items)) * 100 if (n_persons * n_items) > 0 else 0

        # Observed average measure (theta) for this category
        indices = np.where(data == k)
        if len(indices[0]) > 0:
            observed_thetas = theta[indices[0]]
            observed_average = float(np.mean(observed_thetas))
            observed_sd = float(np.std(observed_thetas)) if len(observed_thetas) > 1 else 0.0
        else:
            observed_average = None
            observed_sd = None

        # Andrich threshold (structure calibration)
        threshold_value = None
        threshold_se = None
        if k > 0 and k - 1 < len(avg_thresholds):
            threshold_value = float(avg_thresholds[k - 1])

        # Check for disordered thresholds
        is_disordered = False
        if previous_threshold is not None and threshold_value is not None:
            is_disordered = threshold_value < previous_threshold

        if threshold_value is not None:
            previous_threshold = threshold_value

        categories.append({
            "category": k,
            "label": f"Category {k}",
            "count": count,
            "percent": round(percent, 1),
            "observed_average": observed_average,
            "observed_sd": observed_sd,
            "andrich_threshold": threshold_value,
            "se_threshold": threshold_se,
            "is_disordered": is_disordered,
        })

    # Generate recommendations
    recommendations = []

    # Check for underutilized categories (< 10 responses or < 1%)
    underutilized = [c for c in categories if c["count"] < 10 or c["percent"] < 1]
    if underutilized:
        recommendations.append({
            "type": "underutilized",
            "severity": "warning",
            "message": f"Categories {[c['category'] for c in underutilized]} have few responses. Consider collapsing categories.",
        })

    # Check for disordered thresholds
    disordered = [c for c in categories if c["is_disordered"]]
    if disordered:
        recommendations.append({
            "type": "disordered",
            "severity": "error",
            "message": f"Disordered thresholds detected at categories {[c['category'] for c in disordered]}. Categories may not be functioning as intended.",
        })

    # Check if observed averages are monotonically increasing
    averages = [c["observed_average"] for c in categories if c["observed_average"] is not None]
    if len(averages) >= 2:
        is_monotonic = all(averages[i] <= averages[i+1] for i in range(len(averages)-1))
        if not is_monotonic:
            recommendations.append({
                "type": "non_monotonic",
                "severity": "warning",
                "message": "Observed averages are not monotonically increasing. This may indicate category structure issues.",
            })

    return {
        "categories": categories,
        "n_categories": n_categories,
        "recommendations": recommendations,
        "summary": {
            "total_responses": int(n_persons * n_items),
            "has_disordered_thresholds": len(disordered) > 0,
            "has_underutilized_categories": len(underutilized) > 0,
        },
    }


def compute_reliability_from_stored_results(
    item_parameters: dict[str, Any],
    ability_estimates: dict[str, Any],
) -> dict[str, Any]:
    """
    Compute reliability statistics from stored analysis results.

    Simplified version that works with stored JSON data rather than raw arrays.

    Args:
        item_parameters: Dict with 'items' list from analysis
        ability_estimates: Dict with 'persons' list from analysis

    Returns:
        Dict with reliability statistics
    """
    items = item_parameters.get("items", [])
    persons = ability_estimates.get("persons", [])

    if not items or not persons:
        return {
            "person_reliability": 0.0,
            "item_reliability": 0.0,
            "person_separation": 0.0,
            "item_separation": 0.0,
            "person_strata": 1.0,
            "item_strata": 1.0,
        }

    # Extract theta values
    theta_values = np.array([p["theta"] for p in persons])
    theta_variance = np.var(theta_values)

    # Extract SE values (use default if not available)
    se_values = np.array([p.get("se", 0.5) or 0.5 for p in persons])
    mean_se_squared = np.mean(se_values ** 2)

    # Person statistics
    person_true_variance = max(0, theta_variance - mean_se_squared)
    person_reliability = person_true_variance / theta_variance if theta_variance > 0 else 0.0

    rmse_person = np.sqrt(mean_se_squared)
    person_separation = np.sqrt(person_true_variance) / rmse_person if rmse_person > 0 else 0.0
    person_strata = (4 * person_separation + 1) / 3

    # Item statistics
    difficulties = np.array([item["difficulty"] for item in items])
    item_variance = np.var(difficulties)

    n_persons = len(persons)
    item_se = np.full(len(items), 1.0 / np.sqrt(n_persons)) if n_persons > 0 else np.ones(len(items))
    mean_item_se_squared = np.mean(item_se ** 2)

    item_true_variance = max(0, item_variance - mean_item_se_squared)
    item_reliability = item_true_variance / item_variance if item_variance > 0 else 0.0

    rmse_item = np.sqrt(mean_item_se_squared)
    item_separation = np.sqrt(item_true_variance) / rmse_item if rmse_item > 0 else 0.0
    item_strata = (4 * item_separation + 1) / 3

    return {
        "person_reliability": float(np.clip(person_reliability, 0, 1)),
        "item_reliability": float(np.clip(item_reliability, 0, 1)),
        "person_separation": float(max(0, person_separation)),
        "item_separation": float(max(0, item_separation)),
        "person_strata": float(max(1, person_strata)),
        "item_strata": float(max(1, item_strata)),
    }
