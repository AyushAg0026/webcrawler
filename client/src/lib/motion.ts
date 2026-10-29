import type { Variants } from 'framer-motion';

// Shared animation presets. All under 300 ms; <MotionConfig reducedMotion="user">
// in main.tsx turns movement off for people who ask their OS for less motion.

export const staggerList: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
};

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.22, ease: 'easeOut' } },
};
