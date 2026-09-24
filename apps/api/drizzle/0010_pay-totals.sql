-- Pay totals per employee on a date, in the employee's local currency. An item counts when
-- effective_from <= date < effective_to (or it has no end). Annual amount = amount x periods per
-- year. Gross pay counts earnings, allowances and bonuses only (not employer contributions or
-- benefits). The monthly equivalent is annual / 12, worked out by the application so one rounding
-- rule applies everywhere. Employees without current pay get zero totals.
CREATE FUNCTION pay_totals_on(on_date date)
RETURNS TABLE (
  employee_id uuid,
  currency_code char(3),
  annual_total_minor bigint,
  annual_gross_minor bigint
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    e.id,
    c.currency_code,
    coalesce(sum(i.amount_minor * f.periods_per_year), 0)::bigint,
    coalesce(
      sum(i.amount_minor * f.periods_per_year)
        FILTER (WHERE pc.category IN ('earning', 'allowance', 'bonus')),
      0
    )::bigint
  FROM employees e
  JOIN countries c ON c.code = e.country_code
  LEFT JOIN pay_items i
    ON i.employee_id = e.id
    AND i.effective_from <= on_date
    AND (i.effective_to IS NULL OR i.effective_to > on_date)
  LEFT JOIN pay_frequencies f ON f.code = i.frequency_code
  LEFT JOIN pay_components pc ON pc.id = i.component_id
  GROUP BY e.id, c.currency_code
$$;
--> statement-breakpoint
-- Totals for today, read by the employee directory and the dashboard.
CREATE VIEW current_pay_totals AS
SELECT * FROM pay_totals_on(current_date);
