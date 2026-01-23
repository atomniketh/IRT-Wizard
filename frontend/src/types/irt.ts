export interface TooltipContent {
  student: string
  educator: string
  researcher: string
}

export const tooltips: Record<string, TooltipContent> = {
  difficulty: {
    student: "How hard the question is. Higher = harder.",
    educator: "Item difficulty (b parameter). Range typically -3 to +3.",
    researcher: "Location parameter (b) on the ability scale. MLE estimate with SE."
  },
  discrimination: {
    student: "How well this question tells apart students.",
    educator: "Item discrimination (a parameter). Higher values = better differentiation.",
    researcher: "Slope parameter (a). Values < 0.5 indicate poor discrimination."
  },
  guessing: {
    student: "The chance of guessing correctly.",
    educator: "Guessing/pseudo-chance parameter (c). Typical range 0-0.35.",
    researcher: "Lower asymptote (c). Represents probability of correct response at very low ability."
  },
  theta: {
    student: "Your ability score.",
    educator: "Person ability estimate (theta). Mean = 0, SD = 1.",
    researcher: "Latent trait estimate. EAP/MAP estimate with posterior SE."
  },
  aic: {
    student: "How well the model fits (lower is better).",
    educator: "Akaike Information Criterion. Lower = better fit, penalizes complexity.",
    researcher: "AIC = 2k - 2ln(L). Use for model comparison; lower indicates better fit with parsimony."
  },
  bic: {
    student: "How well the model fits (lower is better).",
    educator: "Bayesian Information Criterion. Similar to AIC but stronger penalty for parameters.",
    researcher: "BIC = k*ln(n) - 2ln(L). More conservative than AIC for large samples."
  },
  log_likelihood: {
    student: "How well the model explains the data.",
    educator: "Log-Likelihood measures how probable the data is given the model. Higher (less negative) is better.",
    researcher: "ln(L) = Σ ln P(x_ij|θ_i, item params). Used to compute AIC/BIC. Higher values indicate better fit."
  },
  icc: {
    student: "Shows how likely you are to answer correctly at different ability levels.",
    educator: "Item Characteristic Curve showing P(correct) across the ability range.",
    researcher: "ICC: P(X=1|θ) = c + (1-c)/(1+exp(-a(θ-b))). Inflection at b, slope ∝ a."
  },
  iif: {
    student: "Shows where this question measures best.",
    educator: "Item Information Function. Peaks where item discriminates best.",
    researcher: "I(θ) = a²P(θ)Q(θ)/(P(θ)-c)². Maximum information near b."
  },
  tif: {
    student: "Shows where the test measures best overall.",
    educator: "Test Information Function. Sum of all IIFs. Higher = more precise measurement.",
    researcher: "TIF = Σ I_j(θ). SE(θ) = 1/√TIF. Use for test design and targeting."
  },
  se_difficulty: {
    student: "How certain we are about the difficulty value.",
    educator: "Standard error of the difficulty estimate. Smaller = more precise.",
    researcher: "SE(b): Standard error of difficulty parameter. Based on Fisher information matrix."
  },
  se_discrimination: {
    student: "How certain we are about the discrimination value.",
    educator: "Standard error of the discrimination estimate. Smaller = more precise.",
    researcher: "SE(a): Standard error of slope parameter. Large SE may indicate estimation issues."
  },
  estimation_method: {
    student: "The math used to find the best values for each question.",
    educator: "Algorithm for estimating item parameters. MML is most common.",
    researcher: "MML integrates over ability distribution. MAP adds prior for regularization."
  },
  ability_estimation: {
    student: "How we calculate each person's score.",
    educator: "Method for estimating person abilities after item calibration.",
    researcher: "EAP: posterior mean (Bayesian). MAP: posterior mode. MLE: maximum likelihood (can be undefined for extreme patterns)."
  },
  max_iterations: {
    student: "How many times to try finding the best answer.",
    educator: "Maximum EM iterations before stopping. Increase if not converging.",
    researcher: "Upper bound on EM cycles. Typical range 500-2000. Check convergence if max reached."
  },
  convergence_threshold: {
    student: "How close is 'close enough' to stop.",
    educator: "Algorithm stops when parameter changes fall below this value.",
    researcher: "Convergence criterion for relative change in log-likelihood or parameters. Smaller = more precise but slower."
  }
}

export const modelDescriptions: Record<string, TooltipContent> = {
  '1PL': {
    student: "Simple model - only looks at how hard each question is.",
    educator: "Rasch model. All items equally discriminating. Estimates difficulty only.",
    researcher: "1PL (Rasch): P(X=1|θ) = 1/(1+exp(-(θ-b))). Assumes equal discrimination (a=1) and no guessing (c=0)."
  },
  '2PL': {
    student: "Looks at how hard each question is AND how well it separates students.",
    educator: "Estimates difficulty and discrimination. Most common IRT model.",
    researcher: "2PL: P(X=1|θ) = 1/(1+exp(-a(θ-b))). Estimates a (discrimination) and b (difficulty). No guessing."
  },
  '3PL': {
    student: "Also accounts for lucky guessing on multiple choice questions.",
    educator: "Adds guessing parameter. Best for multiple choice with ~4 options.",
    researcher: "3PL: P(X=1|θ) = c + (1-c)/(1+exp(-a(θ-b))). Estimates a, b, and c. Requires large N."
  },
  'RSM': {
    student: "For rating scale questions (like agree-disagree scales).",
    educator: "Rating Scale Model. All items share the same category structure. Best for Likert-type scales.",
    researcher: "RSM: P(X=k|θ,β,τ) = exp(Σ(θ-β-τⱼ)) / Σ exp(...). Shared thresholds across items."
  },
  'PCM': {
    student: "For rating scale questions where each item can have different patterns.",
    educator: "Partial Credit Model. Each item has unique category boundaries. More flexible than RSM.",
    researcher: "PCM: Each item has unique thresholds. Generalizes RSM. P(X=k|θ,βᵢ,τᵢⱼ) with item-specific τ."
  }
}

// Additional tooltips for polytomous model parameters
export const polytomousTooltips: Record<string, TooltipContent> = {
  thresholds: {
    student: "Boundaries between response categories (like between 'disagree' and 'neutral').",
    educator: "Andrich thresholds (τ). Define where one response category becomes more likely than the previous.",
    researcher: "τⱼ: Threshold parameters for category j. Ordered thresholds indicate proper category functioning."
  },
  infit_mnsq: {
    student: "How well this item fits the model (1.0 is perfect).",
    educator: "Infit MNSQ. Expected value = 1.0. Range 0.5-1.5 is acceptable. Sensitive to unexpected responses near ability level.",
    researcher: "Information-weighted mean square residual. Σ(z²ᵢW ᵢ)/Σ(Wᵢ). Values >1.5 indicate underfit, <0.5 indicate overfit."
  },
  outfit_mnsq: {
    student: "Another measure of how well this item fits (1.0 is perfect).",
    educator: "Outfit MNSQ. Expected value = 1.0. More sensitive to unexpected outlier responses.",
    researcher: "Unweighted mean square residual. Sensitive to outliers. Values >2.0 often indicate problematic item."
  },
  infit_zstd: {
    student: "Standardized fit value (should be between -2 and 2).",
    educator: "Standardized infit. Should be between -2 and +2. Values outside suggest misfit.",
    researcher: "Wilson-Hilferty transformation of infit MNSQ. Approximate z-score with expected value 0."
  },
  outfit_zstd: {
    student: "Standardized fit value (should be between -2 and 2).",
    educator: "Standardized outfit. Should be between -2 and +2. Values outside suggest misfit.",
    researcher: "Wilson-Hilferty transformation of outfit MNSQ. Approximate z-score. Sensitive to outliers."
  },
  wright_map: {
    student: "Shows where people and items are located on the same scale.",
    educator: "Person-item map. Left shows person distribution, right shows item difficulties. Good targeting when distributions overlap.",
    researcher: "Wright map/variable map. Logit scale. Reveals person-item targeting, ceiling/floor effects, and gaps in measurement."
  },
  category_probability_curve: {
    student: "Shows how likely each response option is at different ability levels.",
    educator: "Category probability curves. Each curve shows probability of selecting that category. Peaks should be ordered.",
    researcher: "P(X=k|θ) for each category k. Andrich thresholds are where adjacent categories are equally likely."
  }
}
