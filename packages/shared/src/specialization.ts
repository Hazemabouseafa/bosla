export function parseWeightToken(token: string): Record<string, number> {
  const weights: Record<string, number> = {};
  const matches = token.match(/[a-z]\d/g) ?? [];
  for (const m of matches) {
    weights[m[0]] = (weights[m[0]] ?? 0) + Number(m[1]);
  }
  return weights;
}

export interface RankableDomain {
  id: string;
  slug: string;
  nameAr: string;
  descriptionAr: string;
  weightsCode: string;
  speciesCode: string;
  leafCount: number;
}

export function rankSpecializationDomains(
  domains: RankableDomain[],
  dimensionScores: Record<string, number>,
  speciesScores: Record<string, number>,
): Array<RankableDomain & { score: number }> {
  return domains
    .map((d) => {
      const w = parseWeightToken(d.weightsCode);
      let score = 0;
      for (const [key, weight] of Object.entries(w)) {
        score += weight * (dimensionScores[key] ?? 0);
      }
      if (d.speciesCode) {
        score += 2 * (speciesScores[d.speciesCode] ?? 0);
      }
      return { ...d, score };
    })
    .sort((a, b) => b.score - a.score);
}
