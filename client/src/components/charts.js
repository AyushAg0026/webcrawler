// Chart.js is tree-shakeable: register only the pieces our two charts use.
import {
  Chart,
  BarElement,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';

Chart.register(BarElement, CategoryScale, LinearScale, LineElement, PointElement, Tooltip);

// Charts draw on a <canvas>, which can't read CSS variables by itself,
// so we read the current theme colors from :root and pass them in.
export function themeColors() {
  const css = getComputedStyle(document.documentElement);
  const read = (name) => css.getPropertyValue(name).trim();
  return {
    series: read('--series-1'),
    text: read('--text-muted'),
    grid: read('--grid'),
    surface: read('--surface'),
  };
}

export function baseOptions(colors) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: { legend: { display: false } }, // one series: the heading names it
    scales: {
      x: { ticks: { color: colors.text }, grid: { color: colors.grid }, border: { display: false } },
      y: { ticks: { color: colors.text }, grid: { color: colors.grid }, border: { display: false } },
    },
  };
}
