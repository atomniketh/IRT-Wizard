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
  }
}
