-- Reference data. The same values are defined in packages/shared (money, countries, pay frequencies),
-- and a test checks that both stay in step.
INSERT INTO "currencies" ("code", "name", "minor_digits") VALUES
  ('USD', 'US dollar', 2),
  ('CAD', 'Canadian dollar', 2),
  ('AUD', 'Australian dollar', 2),
  ('INR', 'Indian rupee', 2);
--> statement-breakpoint
INSERT INTO "countries" ("code", "name", "currency_code") VALUES
  ('US', 'United States', 'USD'),
  ('CA', 'Canada', 'CAD'),
  ('AU', 'Australia', 'AUD'),
  ('IN', 'India', 'INR');
--> statement-breakpoint
INSERT INTO "pay_frequencies" ("code", "name", "periods_per_year") VALUES
  ('weekly', 'Weekly', 52),
  ('bi_weekly', 'Every two weeks', 26),
  ('monthly', 'Monthly', 12),
  ('bi_monthly', 'Every two months', 6),
  ('quarterly', 'Quarterly', 4),
  ('bi_quarterly', 'Every two quarters', 2),
  ('half_yearly', 'Half-yearly', 2),
  ('yearly', 'Yearly', 1);
