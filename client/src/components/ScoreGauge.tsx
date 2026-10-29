import { motion } from 'framer-motion';
import { scoreTone } from './ScoreBadge';

interface ScoreGaugeProps {
  score: number | null;
  size?: number;
  strokeWidth?: number;
}

/**
 * Circular 0-100 gauge. The ring is an SVG circle whose stroke is a dash as
 * long as the circumference; shifting the dash offset reveals only `score`%
 * of it. Animating the offset from "empty" to its final value fills the ring.
 */
export function ScoreGauge({ score, size = 168, strokeWidth = 12 }: ScoreGaugeProps) {
  const tone = scoreTone(score);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = (score ?? 0) / 100;

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={score === null ? 'No score' : `Accessibility score ${score} out of 100: ${tone.label}`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--border)" strokeWidth={strokeWidth} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={tone.color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - filled) }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
        />
      </svg>
      <div aria-hidden className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-5xl font-bold tracking-tight tabular-nums" style={{ fontSize: size * 0.3 }}>
          {score ?? '–'}
        </span>
        <span className={`mt-1 flex items-center gap-1 text-sm font-medium ${tone.text}`}>
          <tone.icon className="size-3.5" />
          {tone.label}
        </span>
      </div>
    </div>
  );
}
