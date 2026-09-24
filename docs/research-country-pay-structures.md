# Research Notes: Employee Fields and Pay Components by Country

Author: Vineet Kumar | Date: 24 Sep 2026 | Purpose: basis for the employee fields, pay components and seed data (answers to Q3, Q4 and Q5)

Rates below were checked in September 2026 for realistic synthetic data. They change every year, and the application stores amounts, not rules, so no rate is hard-coded in business logic.

## 1. Countries in scope

| Country | Currency | Share of the 10,000 employees | Common pay frequencies | Region field |
|---|---|---|---|---|
| India | INR | 60% (6,000) | Monthly | State (professional tax differs by state) |
| United States | USD | 15% (1,500) | Bi-weekly, weekly, semi-monthly, monthly | State (state taxes and unemployment insurance differ) |
| Canada | CAD | 15% (1,500) | Bi-weekly, semi-monthly, weekly | Province or territory (Quebec runs its own pension and parental plans) |
| Australia | AUD | 10% (1,000) | Fortnightly (bi-weekly), weekly, monthly | State or territory |

## 2. Employee fields

Common to all countries:

| Field | Notes |
|---|---|
| Employee code | Business key used in spreadsheets, unique |
| First name, last name | |
| Work email | |
| Job title | Used for peer comparison in insights |
| Job level | Optional grade, such as L1 to L6 |
| Department | Used for cost per department |
| Country | One of the four countries |
| Region | State, province or territory |
| Employment type | Full-time, part-time, contractor, intern |
| Weekly hours and FTE | Full-time equivalent, for example 0.5 for half time |
| Hire date | |
| Status and inactive date | Active or inactive |

Country-specific optional fields:

| Country | Field | Why it matters |
|---|---|---|
| United States | FLSA status (exempt or non-exempt) | Decides overtime eligibility |
| Australia | Award or agreement name | Many roles are paid under an award |
| India | PF and ESI applicability | Depends on wages and establishment rules |
| Canada | None beyond province | Province covers the main differences |

Deliberately not stored: government IDs (SSN, SIN, TFN, PAN, Aadhaar), bank details, date of birth and gender. None are needed to manage pay or answer pay questions, and each adds privacy risk.

## 3. Typical pay components

### India

| Component | Usual frequency | Notes |
|---|---|---|
| Basic | Monthly | Under the Labour Codes (in force from 21 Nov 2025), wages must be at least 50% of total pay |
| House rent allowance (HRA) | Monthly | Often 40% to 50% of basic |
| Special allowance | Monthly | Balancing component |
| Leave travel allowance (LTA) | Yearly | |
| Performance bonus | Yearly | Variable pay |
| Employer provident fund | Monthly | 12% of wages, on wages up to INR 25,000 a month from 17 Sep 2026 (was INR 15,000) |
| Gratuity provision | Monthly | About 4.81% of basic |
| Employer ESI | Monthly | 3.25%, only where gross pay is up to INR 21,000 a month |
| Group health insurance | Yearly | Benefit |
| Stipend | Monthly | Interns |

### United States

| Component | Usual frequency | Notes |
|---|---|---|
| Base salary or wages | Bi-weekly | Hourly staff are stored as the expected amount per pay period |
| Bonus or commission | Yearly or quarterly | Variable pay |
| Employer FICA | Bi-weekly | 7.65%: Social Security 6.2% on wages up to USD 184,500 (2026) plus Medicare 1.45% on all wages |
| Federal and state unemployment | Yearly | FUTA 0.6% on the first USD 7,000; state rates vary |
| 401(k) match | Bi-weekly | Commonly a few percent of salary |
| Health insurance (employer share) | Monthly | Benefit |

### Canada

| Component | Usual frequency | Notes |
|---|---|---|
| Base salary or wages | Bi-weekly | |
| Vacation pay | Bi-weekly | At least 4% in most provinces, mainly for hourly staff |
| Bonus | Yearly | |
| Employer CPP and CPP2 | Bi-weekly | 5.95% on earnings between CAD 3,500 and CAD 74,600, plus CPP2 4% up to CAD 85,000 (2026); matched with the employee |
| Employer EI | Bi-weekly | 1.4 times the employee rate of 1.63%, on earnings up to CAD 68,900 (2026) |
| RRSP match | Bi-weekly | Optional employer benefit |
| Group benefits | Monthly | Health and dental |

### Australia

| Component | Usual frequency | Notes |
|---|---|---|
| Base salary or wages | Fortnightly | |
| Superannuation guarantee | Fortnightly | 12% of qualifying earnings from 1 Jul 2025. From 1 Jul 2026 it is paid with each pay run (payday super) |
| Allowances | Fortnightly | Such as travel or tools, depending on the award |
| Annual leave loading | Yearly | Often 17.5% of four weeks of leave pay under awards |
| Bonus | Yearly | |

### Contractors and interns (all countries)

Contractors get a contract fee and no employer contributions. Interns get a stipend or wages and, depending on the country and role, limited or no benefits.

## 4. How this shapes the design

- **Salary is a set of pay components**, each with an amount, a currency and a frequency. Annual and monthly totals are calculated from them.
- **HR can add new components** (Q3), per country or for all countries, with a category (earning, allowance, bonus, employer contribution, benefit, other) and a default frequency.
- **Frequencies** are stored in a table with the number of periods per year, so a new frequency needs no code change.
- **Employer contributions are stored as amounts,** not calculated from rates. This keeps the application a data and insight tool (Q10) and avoids rules that change every year.
- **Seed data** uses the components and approximate rates above, the country split from Q7, and a mix of employment types.

## Sources

- [Canada.ca: EI premium rates and maximums](https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/payroll/payroll-deductions-contributions/employment-insurance-ei/ei-premium-rates-maximums.html)
- [TAAG: CPP and EI rates in 2026](https://taag.ca/canada-pension-plan-and-employment-insurance-rates-in-2026/)
- [ATO: Super guarantee](https://www.ato.gov.au/tax-rates-and-codes/key-superannuation-rates-and-thresholds/super-guarantee)
- [AustralianSuper: FY27 super changes for employers](https://www.australiansuper.com/employers/employers-articles/2026/06/super-changes)
- [ATO: Superannuation on annual leave loading](https://www.ato.gov.au/businesses-and-organisations/super-for-employers/quarterly-super-to-30-june-2026/how-much-super-to-pay/list-of-payments-that-are-ordinary-time-earnings/superannuation-on-annual-leave-loading)
- [Paychex: FICA tax in 2026](https://www.paychex.com/articles/payroll-taxes/how-to-calculate-fica-rate)
- [Mercer Advisors: Social Security wage base 2026](https://www.merceradvisors.com/taxes/social-security-wage-base-2026-increase-employer-guide/)
- India sources are listed in `research-india-payroll.md`.
