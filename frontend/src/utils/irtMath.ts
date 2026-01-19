export function computeProbability(
  theta: number,
  difficulty: number,
  discrimination: number = 1,
  guessing: number = 0
): number {
  const exponent = Math.max(-700, Math.min(700, discrimination * (theta - difficulty)))
  return guessing + (1 - guessing) / (1 + Math.exp(-exponent))
}

export function computeItemInformation(
  theta: number,
  difficulty: number,
  discrimination: number = 1,
  guessing: number = 0
): number {
  const p = computeProbability(theta, difficulty, discrimination, guessing)
  const q = 1 - p

  const numerator = discrimination ** 2 * (p - guessing) ** 2 * q
  const denominator = p * (1 - guessing) ** 2

  if (denominator < 1e-10) return 0
  return numerator / denominator
}

export function computeTestInformation(
  theta: number,
  items: Array<{ difficulty: number; discrimination: number; guessing: number }>
): number {
  return items.reduce(
    (sum, item) =>
      sum + computeItemInformation(theta, item.difficulty, item.discrimination, item.guessing),
    0
  )
}

export function computeStandardError(information: number): number {
  if (information <= 0) return Infinity
  return 1 / Math.sqrt(information)
}

export function generateThetaRange(min: number = -4, max: number = 4, steps: number = 81): number[] {
  const range: number[] = []
  const step = (max - min) / (steps - 1)

  for (let i = 0; i < steps; i++) {
    range.push(min + i * step)
  }

  return range
}

export function computeICCPoints(
  difficulty: number,
  discrimination: number = 1,
  guessing: number = 0,
  thetaRange: number[] = generateThetaRange()
): Array<{ theta: number; probability: number }> {
  return thetaRange.map((theta) => ({
    theta,
    probability: computeProbability(theta, difficulty, discrimination, guessing),
  }))
}

export function computeIIFPoints(
  difficulty: number,
  discrimination: number = 1,
  guessing: number = 0,
  thetaRange: number[] = generateThetaRange()
): Array<{ theta: number; information: number }> {
  return thetaRange.map((theta) => ({
    theta,
    information: computeItemInformation(theta, difficulty, discrimination, guessing),
  }))
}
