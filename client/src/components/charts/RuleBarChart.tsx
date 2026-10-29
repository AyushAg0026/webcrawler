import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useReducedMotion } from 'framer-motion';
import type { Violation } from '@/types';
import { SEVERITY, SeverityBadge, SeverityIcon } from '@/components/SeverityBadge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AXIS_TICK, ChartCard, ChartTooltipBox, MONO_FONT } from './ChartCard';

const TOP_N = 8;

export function RuleBarChart({ violations, className }: { violations: Violation[]; className?: string }) {
  const reduceMotion = useReducedMotion();
  const data = [...violations]
    .sort((a, b) => b.elements.length - a.elements.length)
    .slice(0, TOP_N)
    .map((v) => ({ id: v.id, help: v.help, impact: v.impact, count: v.elements.length }));
  const top = data[0];

  return (
    <ChartCard
      className={className}
      title="Violations by rule"
      description={`Top ${data.length} rules by affected elements, colored by severity`}
      summary={
        top
          ? `Bar chart of the ${data.length} most common rules. ${top.id} is the most common with ${top.count} affected elements.`
          : 'No violations.'
      }
      chart={
        <ResponsiveContainer width="100%" height={data.length * 34 + 30}>
          {/* layout="vertical" = horizontal bars, so long rule names fit on the axis. */}
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 32, bottom: 0, left: 0 }} accessibilityLayer={false}>
            <CartesianGrid horizontal={false} stroke="var(--border)" />
            <XAxis type="number" allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <YAxis
              type="category"
              dataKey="id"
              width={176}
              tick={{ ...AXIS_TICK, fontSize: 11.5, fontFamily: MONO_FONT }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: 'var(--accent)' }}
              content={({ active, payload }) => {
                const item = payload?.[0]?.payload as (typeof data)[number] | undefined;
                if (!active || !item) return null;
                return (
                  <ChartTooltipBox>
                    <p className="font-mono text-xs text-muted-foreground">{item.id}</p>
                    <p className="font-medium">{item.help}</p>
                    <p className="mt-1 flex items-center gap-1.5">
                      <SeverityIcon impact={item.impact} />
                      {SEVERITY[item.impact].label} · {item.count} elements
                    </p>
                  </ChartTooltipBox>
                );
              }}
            />
            <Bar dataKey="count" barSize={14} radius={[0, 4, 4, 0]} isAnimationActive={!reduceMotion} animationDuration={300}>
              {data.map((d) => (
                <Cell key={d.id} fill={SEVERITY[d.impact].color} />
              ))}
              <LabelList dataKey="count" position="right" fill="var(--muted-foreground)" fontSize={12} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      }
      table={
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rule</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead className="text-right">Elements</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="font-mono text-xs">{d.id}</TableCell>
                <TableCell>
                  <SeverityBadge impact={d.impact} />
                </TableCell>
                <TableCell className="text-right tabular-nums">{d.count}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      }
    />
  );
}
