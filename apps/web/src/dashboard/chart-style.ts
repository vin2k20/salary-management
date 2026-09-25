/** Shared chart styling: recessive axes and grid, text in text colours, one series colour. */
export const CHART = {
  series: 'var(--chart-1)',
  seriesSoft: 'var(--chart-1-soft)',
  surface: 'var(--background)',
  grid: 'var(--border)',
  tick: { fill: 'var(--muted-foreground)', fontSize: 12 },
  cursor: { fill: 'var(--muted)', opacity: 0.6 },
  /** Bars are at most this thick, so the band keeps some air. */
  barSize: 20,
} as const;

/** A tooltip box styled like the other popovers. */
export const TOOLTIP_CLASS = 'rounded-md border bg-background px-3 py-2 text-sm shadow-md';
