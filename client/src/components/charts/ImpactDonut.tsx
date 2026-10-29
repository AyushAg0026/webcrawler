import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { useReducedMotion } from 'framer-motion';
import type { Impact } from '@/types';
import { SEVERITY, SeverityIcon } from '@/components/SeverityBadge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { IMPACTS } from '@/lib/scan-utils';
import { ChartCard, ChartTooltipBox } from './ChartCard';

export function ImpactDonut({ counts, className }: { counts: Record<Impact, number>; className?: string }) {
  const reduceMotion = useReducedMotion();
  const total = IMPACTS.reduce((sum, impact) => sum + counts[impact], 0);
  const data = IMPACTS.map((impact) => ({ impact, label: SEVERITY[impact].label, count: counts[impact] }));
  const percent = (n: number) => (total ? Math.round((n / total) * 100) : 0);

  // The legend shows icon + label + count for every slice, so the chart is
  // readable without telling colors apart.
  const legend = (
    <ul className="grid gap-2 text-sm">
      {data.map((d) => (
        <li key={d.impact} className="flex items-center gap-2">
          <SeverityIcon impact={d.impact} />
          <span className="flex-1">{d.label}</span>
          <span className="font-medium tabular-nums">{d.count}</span>
          <span className="w-10 text-right text-muted-foreground tabular-nums">{percent(d.count)}%</span>
        </li>
      ))}
    </ul>
  );

  return (
    <ChartCard
      className={className}
      title="Violations by impact"
      description="Share of affected elements per severity"
      summary={`Donut chart: ${data.map((d) => `${d.count} ${d.label.toLowerCase()}`).join(', ')}, ${total} in total.`}
      chart={
        <div className="flex flex-col items-center gap-6 sm:flex-row lg:flex-col xl:flex-row">
          <div className="relative size-44 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart accessibilityLayer={false}>
                <Pie
                  data={data.filter((d) => d.count > 0)}
                  dataKey="count"
                  nameKey="label"
                  innerRadius="68%"
                  outerRadius="100%"
                  paddingAngle={2}
                  // Recharts makes the pie focusable by default. The chart is
                  // aria-hidden (the legend/table carry the data), so keep it out of the Tab order.
                  rootTabIndex={-1}
                  stroke="var(--card)"
                  strokeWidth={2}
                  isAnimationActive={!reduceMotion}
                  animationDuration={300}
                >
                  {data
                    .filter((d) => d.count > 0)
                    .map((d) => (
                      <Cell key={d.impact} fill={SEVERITY[d.impact].color} />
                    ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    const item = payload?.[0]?.payload as (typeof data)[number] | undefined;
                    if (!active || !item) return null;
                    return (
                      <ChartTooltipBox>
                        <p className="flex items-center gap-1.5 font-medium">
                          <SeverityIcon impact={item.impact} /> {item.label}
                        </p>
                        <p className="text-muted-foreground">
                          {item.count} elements · {percent(item.count)}%
                        </p>
                      </ChartTooltipBox>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-semibold tabular-nums">{total}</span>
              <span className="text-xs text-muted-foreground">elements</span>
            </div>
          </div>
          <div className="w-full">{legend}</div>
        </div>
      }
      table={
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Impact</TableHead>
              <TableHead className="text-right">Elements</TableHead>
              <TableHead className="text-right">Share</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((d) => (
              <TableRow key={d.impact}>
                <TableCell>
                  <span className="flex items-center gap-2">
                    <SeverityIcon impact={d.impact} /> {d.label}
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums">{d.count}</TableCell>
                <TableCell className="text-right tabular-nums">{percent(d.count)}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      }
    />
  );
}
