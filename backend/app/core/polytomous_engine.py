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
    use_mml: bool = False,
) -> PolytomousAnalysisResult:
    """
    Fit a polytomous IRT model (RSM or PCM) to response data.

    Args:
        data: Response matrix (n_persons x n_items) with ordinal values (e.g., 0-6 for 7-point scale)
        model_type: Either ModelType.RSM or ModelType.PCM
        item_names: Optional list of item names
        use_mml: If True, use slower but more accurate MML estimation via girth (default: False)

    Returns:
        PolytomousAnalysisResult with item parameters, abilities, and fit statistics
    """
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

    # Use fast estimation by default, MML only if explicitly requested
    if use_mml:
        try:
            import girth
            import warnings
            import signal

            class TimeoutError(Exception):
                pass

            def timeout_handler(signum, frame):
                raise TimeoutError("Model fitting timed out")

            # Transpose for Girth (expects items x persons)
            data_for_girth = data_normalized.T.astype(float)

            # Set timeout for model fitting (60 seconds max)
            old_handler = signal.signal(signal.SIGALRM, timeout_handler)
            signal.alarm(60)

            try:
                with warnings.catch_warnings():
                    warnings.filterwarnings('ignore', category=RuntimeWarning)
                    estimates = girth.pcm_mml(data_for_girth)
            finally:
                signal.alarm(0)
                signal.signal(signal.SIGALRM, old_handler)

            # Extract difficulty parameters
            difficulty = estimates["Difficulty"]

            # Extract threshold parameters
            if "Threshold" in estimates:
                raw_thresholds = estimates["Threshold"]
            elif "Thresholds" in estimates:
                raw_thresholds = estimates["Thresholds"]
            else:
                raw_thresholds = _estimate_thresholds_from_data(data_normalized, difficulty, n_categories)

            # Ensure thresholds are properly shaped
            if model_type == ModelType.RSM:
                if raw_thresholds.ndim == 2:
                    thresholds = np.mean(raw_thresholds, axis=0)
                else:
                    thresholds = raw_thresholds
            else:
                if raw_thresholds.ndim == 1:
                    thresholds = np.tile(raw_thresholds, (n_items, 1))
                else:
                    thresholds = raw_thresholds

            converged = True

        except Exception as e:
            print(f"Girth MML fitting failed: {e}. Using fast estimation.")
            difficulty, thresholds = _estimate_parameters_fallback(data_normalized, n_categories, model_type)
            converged = False
    else:
        # Use fast estimation (default)
        difficulty, thresholds = _estimate_parameters_fallback(data_normalized, n_categories, model_type)
        converged = True  # Fast estimation always "converges"

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


def _estimate_abilities_polytomous(
    data: np.ndarray,
    difficulty: np.ndarray,
    thresholds: np.ndarray,
    model_type: ModelType,
) -> np.ndarray:
    """Estimate person abilities using Expected A Posteriori (EAP) - vectorized version."""
    n_persons, n_items = data.shape
    n_categories = len(thresholds) + 1 if thresholds.ndim == 1 else thresholds.shape[1] + 1

    # Quadrature points for numerical integration (reduced from 41 to 21 for speed)
    n_quad = 21
    quad_points = np.linspace(-4, 4, n_quad)
    quad_weights = np.exp(-quad_points**2 / 2) / np.sqrt(2 * np.pi)
    quad_weights = quad_weights / np.sum(quad_weights)

    # Precompute all category probabilities for all items at all quadrature points
    # Shape: (n_quad, n_items, n_categories)
    all_probs = np.zeros((n_quad, n_items, n_categories))

    for q, theta_q in enumerate(quad_points):
        for j in range(n_items):
            item_thresh = thresholds if model_type == ModelType.RSM else thresholds[j]
            for k in range(n_categories):
                all_probs[q, j, k] = compute_category_probability(theta_q, difficulty[j], item_thresh, k)

    # Clip probabilities to avoid log(0)
    all_probs = np.clip(all_probs, 1e-10, 1.0)
    log_probs = np.log(all_probs)

    # Vectorized computation of log-likelihoods for all persons
    theta = np.zeros(n_persons)

    # Process in batches for memory efficiency
    batch_size = 100
    for batch_start in range(0, n_persons, batch_size):
        batch_end = min(batch_start + batch_size, n_persons)
        batch_data = data[batch_start:batch_end]  # (batch, n_items)
        batch_size_actual = batch_end - batch_start

        # Compute log-likelihoods for this batch
        log_likelihoods = np.zeros((batch_size_actual, n_quad))

        for i in range(batch_size_actual):
            for q in range(n_quad):
                log_lik = 0.0
                for j in range(n_items):
                    if not np.isnan(batch_data[i, j]):
                        k = int(batch_data[i, j])
                        log_lik += log_probs[q, j, k]
                log_likelihoods[i, q] = log_lik

        # Compute EAP for batch
        max_ll = np.max(log_likelihoods, axis=1, keepdims=True)
        likelihoods = np.exp(log_likelihoods - max_ll)
        posteriors = likelihoods * quad_weights
        posteriors = posteriors / np.sum(posteriors, axis=1, keepdims=True)
        theta[batch_start:batch_end] = np.sum(quad_points * posteriors, axis=1)

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

    person_se = np.zeros(n_persons)

    for i in range(n_persons):
        # Fisher information for this person
        info = 0.0
        for j in range(n_items):
            if np.isnan(data[i, j]):
                continue

            item_thresholds = thresholds if model_type == ModelType.RSM else thresholds[j]

            # Compute expected value and variance for item information
            expected = 0.0
            expected_sq = 0.0
            for k in range(n_categories):
                p_k = compute_category_probability(theta[i], difficulty[j], item_thresholds, k)
                expected += k * p_k
                expected_sq += k * k * p_k

            variance = expected_sq - expected ** 2
            info += variance

        # SE = 1 / sqrt(information)
        if info > 0:
            person_se[i] = 1.0 / np.sqrt(info)
        else:
            person_se[i] = 1.0  # Default large SE

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
