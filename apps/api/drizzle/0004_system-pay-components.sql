-- System pay components per country, from docs/research-country-pay-structures.md. Employer
-- contributions are stored as amounts on pay items, so no rates are kept here. HR can add more
-- components later.
INSERT INTO "pay_components" ("code", "name", "category", "country_code", "default_frequency") VALUES
  -- All countries
  ('contract_fee', 'Contract fee', 'earning', NULL, 'monthly'),
  ('stipend', 'Stipend', 'earning', NULL, 'monthly'),
  -- India
  ('basic', 'Basic', 'earning', 'IN', 'monthly'),
  ('hra', 'House rent allowance', 'allowance', 'IN', 'monthly'),
  ('special_allowance', 'Special allowance', 'allowance', 'IN', 'monthly'),
  ('lta', 'Leave travel allowance', 'allowance', 'IN', 'yearly'),
  ('performance_bonus', 'Performance bonus', 'bonus', 'IN', 'yearly'),
  ('employer_pf', 'Employer provident fund', 'employer_contribution', 'IN', 'monthly'),
  ('gratuity', 'Gratuity provision', 'employer_contribution', 'IN', 'monthly'),
  ('employer_esi', 'Employer ESI', 'employer_contribution', 'IN', 'monthly'),
  ('health_insurance', 'Group health insurance', 'benefit', 'IN', 'yearly'),
  -- United States
  ('base_salary', 'Base salary or wages', 'earning', 'US', 'bi_weekly'),
  ('bonus', 'Bonus', 'bonus', 'US', 'yearly'),
  ('commission', 'Commission', 'bonus', 'US', 'quarterly'),
  ('employer_fica', 'Employer FICA', 'employer_contribution', 'US', 'bi_weekly'),
  ('unemployment_insurance', 'Federal and state unemployment insurance', 'employer_contribution', 'US', 'yearly'),
  ('retirement_match', '401(k) match', 'employer_contribution', 'US', 'bi_weekly'),
  ('health_insurance', 'Health insurance (employer share)', 'benefit', 'US', 'monthly'),
  -- Canada
  ('base_salary', 'Base salary or wages', 'earning', 'CA', 'bi_weekly'),
  ('vacation_pay', 'Vacation pay', 'earning', 'CA', 'bi_weekly'),
  ('bonus', 'Bonus', 'bonus', 'CA', 'yearly'),
  ('employer_cpp', 'Employer CPP and CPP2', 'employer_contribution', 'CA', 'bi_weekly'),
  ('employer_ei', 'Employer EI', 'employer_contribution', 'CA', 'bi_weekly'),
  ('retirement_match', 'RRSP match', 'employer_contribution', 'CA', 'bi_weekly'),
  ('group_benefits', 'Group benefits', 'benefit', 'CA', 'monthly'),
  -- Australia
  ('base_salary', 'Base salary or wages', 'earning', 'AU', 'bi_weekly'),
  ('allowances', 'Allowances', 'allowance', 'AU', 'bi_weekly'),
  ('leave_loading', 'Annual leave loading', 'allowance', 'AU', 'yearly'),
  ('bonus', 'Bonus', 'bonus', 'AU', 'yearly'),
  ('superannuation', 'Superannuation guarantee', 'employer_contribution', 'AU', 'bi_weekly');
