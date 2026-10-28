// Same bands as scanner/score.js. The text label means the score never relies on color alone.
export function scoreLabel(score) {
  if (score === null || score === undefined) return 'No score';
  if (score >= 90) return 'Good';
  if (score >= 50) return 'Needs work';
  return 'Poor';
}

const BAND_CLASS = { Good: 'good', 'Needs work': 'warn', Poor: 'poor', 'No score': 'none' };

export default function ScoreBadge({ score, large = false }) {
  const label = scoreLabel(score);
  return (
    <span className={`score-badge ${BAND_CLASS[label]}${large ? ' large' : ''}`}>
      <span className="score-number">{score ?? '–'}</span>
      {large && <span className="score-max">/ 100</span>}
      <span className="score-label">{label}</span>
    </span>
  );
}
