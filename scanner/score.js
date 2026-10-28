// Phase 2: turns violations into a 0-100 score.

// How many points each affected element costs, by severity.
export const IMPACT_WEIGHTS = { critical: 10, serious: 5, moderate: 2, minor: 1 };

// Score = 100 minus (weight x number of affected elements), never below 0.
// Counting elements (not rules) means 30 unlabeled images hurt more than 1.
export function scorePage(violations) {
  const penalty = violations.reduce(
    (sum, v) => sum + IMPACT_WEIGHTS[v.impact] * v.elements.length,
    0
  );
  return Math.max(0, 100 - penalty);
}

// Site score = average of the pages that loaded. Failed pages are left out
// because we know nothing about them, not because they are perfect.
export function scoreSite(pages) {
  const scored = pages.filter((p) => p.status === 'ok');
  if (scored.length === 0) return null;
  const total = scored.reduce((sum, p) => sum + p.score, 0);
  return Math.round(total / scored.length);
}

export function scoreLabel(score) {
  if (score === null || score === undefined) return 'No score';
  if (score >= 90) return 'Good';
  if (score >= 50) return 'Needs work';
  return 'Poor';
}
