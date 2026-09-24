# Research Notes: Salary and Payroll Management in India

Author: Vineet Kumar | Date: 23 Sep 2026 | Purpose: background for the requirements, not a client deliverable

Statutory values below were checked in September 2026. They change often, so verify against official sources before relying on them.

## 1. How salary is expressed in India

Indian offers are usually quoted as annual CTC (cost to company). CTC is larger than what the employee receives each month.

| Layer | Typical parts |
|---|---|
| Fixed earnings (gross) | Basic, HRA (house rent allowance), special allowance, LTA, other allowances |
| Variable | Performance bonus, statutory bonus, incentives |
| Employer contributions | Employer PF, employer ESI (if eligible), gratuity provision, group insurance |
| CTC | Gross plus variable plus employer contributions |
| Net (take-home) | Gross minus employee PF, employee ESI, professional tax, TDS and other deductions |

Labour Codes (in force from 21 Nov 2025): the four codes replaced 29 older labour laws. Under the Code on Wages, "wages" (Basic plus DA plus retaining allowance) must be at least 50% of total remuneration. Many employers are restructuring salaries in 2026, which raises PF and gratuity costs and slightly lowers take-home pay.

## 2. Statutory items a payroll system handles

| Item | Summary |
|---|---|
| EPF and EPS | 12% of wages from the employee and 12% from the employer (8.33% of the employer share goes to pension, 3.67% to PF). The wage ceiling was revised from INR 15,000 to INR 25,000 per month with effect from 17 Sep 2026. |
| ESI | Health insurance for employees earning up to INR 21,000 per month gross. Employee 0.75%, employer 3.25%. |
| Professional tax | State level, capped at INR 2,500 per year. Slabs and months differ by state (for example Karnataka, Maharashtra, West Bengal). |
| Labour welfare fund | State level, small fixed amounts, frequency differs by state. |
| TDS on salary | Employer deducts income tax monthly based on projected annual income and the employee's chosen regime. The Income Tax Act 2025 applies from 1 Apr 2026 and uses the term "tax year". New regime slabs are unchanged for 2026-27: nil up to 4 lakh, then 5%, 10%, 15%, 20%, 25% in 4 lakh steps, and 30% above 24 lakh. Standard deduction INR 75,000; rebate makes income up to 12 lakh tax free. |
| Gratuity | 15/26 of last drawn wages times years of service. Eligible after 5 years for permanent staff and after 1 year for fixed-term staff under the new codes. |
| Full and final settlement | Dues on exit must be paid within two working days under the Code on Wages. |

## 3. The monthly payroll cycle in Indian tools

1. Lock inputs: joiners, exits, salary revisions, attendance and loss of pay, reimbursements, investment declarations.
2. Compute gross, arrears, deductions and net pay per employee.
3. Review variance against last month and get approval.
4. Generate the bank transfer file or pay directly through a banking partner.
5. Pay statutory dues and file returns: EPF ECR, ESI, professional tax, TDS (quarterly return and annual certificate to employees).
6. Publish payslips and reports.

## 4. Products used widely in India and what they offer

| Product | Positioning | Notable features |
|---|---|---|
| greytHR | SMB payroll with long compliance history | Statutory compliance, attendance and biometric integration, payslips, employee self-service |
| Keka | Mid-market HR and payroll, popular with IT companies | Payroll, arrears, attendance, performance, compensation module with salary bands, benchmarking and revision history |
| Zoho Payroll | Payroll inside the Zoho suite | Multi-state compliance, direct bank payout, accounting integration |
| RazorpayX Payroll | Startups, payroll tied to payments | Automated TDS, PF, PT and ESI payment and filing, same-day disbursal, contractor payouts |
| Darwinbox | Enterprise HR suite | Global workforce, compensation planning, pay equity, workflows |
| Workday, SAP SuccessFactors | Large global enterprises | Global HR and compensation, pay bands, compa-ratio, merit cycles |
| Deel, Rippling, Remote | Multi-country and employer of record | Payroll and compliance in many countries from one system |

Common patterns across these tools that are relevant to this assessment:

- Employee master record as the base of everything.
- Effective-dated salary records and revision history, with reasons and arrears.
- Salary structure templates per country or grade.
- Filters and reports: headcount and salary cost by location, department and grade; salary distribution.
- Compensation views: pay bands per role and level, compa-ratio (salary divided by band midpoint), outliers.
- Bulk import through Excel templates with row-level validation errors.
- Role-based access (HR admin, payroll admin, manager, employee) and an audit log.

## 5. Mapping to the assessment

The assessment asks for salary data management and pay insights for 10,000 employees across multiple countries. It does not ask for payroll processing. Most of the India-specific work above belongs to payroll engines and is out of scope.

| Area | In the brief? | Decision |
|---|---|---|
| Employee and pay records | Yes | Build, with fields researched per country (Q4) |
| Pay history | Not stated | Build: history kept for every pay change (Q6) |
| Insights on how the org pays people | Yes | Build a dashboard with all four pay questions (Q9) |
| Multi-country, multi-currency | Yes | USA, Canada, Australia and India in local currency, org-wide in USD, daily rates (Q5) |
| Meaning of "salary" (base, gross or CTC) | Not stated | Pay as components with frequencies, with monthly and annual totals (Q3); matches how CTC is built in India |
| Statutory deductions, payslips, filings | No | Left out (Q10) |
| Pay bands and compa-ratio | No | Next step, mentioned in trade-offs |
| Excel import and export | Not stated, but the problem is "everything is in Excel" | Build for .xlsx and CSV (Q11) |
| Roles and login | Single persona in the brief | Global and country HR roles, JWT login with reset and invites (Q1, Q2) |

The clarification questions were shared with the Incubyte team, who left the details to me. The answers I decided are in `clarification-questions.md`, and the research for all four countries is in `research-country-pay-structures.md`.

## Sources

- [PeopleStrong: New Labour Codes 2026](https://www.peoplestrong.com/blog/new-labour-code-in-india/)
- [Labour Law Reporter: Salary structure under new Labour Codes](https://labourlawreporter.com/salarystructure.asp)
- [ClearTax: Income tax slabs FY 2025-26 and 2026-27](https://cleartax.in/s/income-tax-slabs)
- [HDFC Bank: Budget 2026-27 and Income Tax Act](https://www.hdfc.bank.in/blogs/union-budget/budget-2026-27-income-tax-act-2026-tax-slabs-stt)
- [LabourCodes360: EPF wage ceiling INR 15,000 to 25,000](https://labourcodes360.com/tools/epf-wage-ceiling)
- [CiteHR: EPF wage ceiling amendment, 17 Sep 2026](https://www.citehr.com/thread/epf-wage-ceiling-amendments-in-code-on-social-security-17-september-2026)
- [Keka: Best payroll software in India 2026](https://www.keka.com/best-payroll-software-in-india)
- [greytHR: Best payroll software in India 2026](https://www.greythr.com/list/best-payroll-software/)
- [Darwinbox: Best payroll software in India](https://darwinbox.com/blog/10-best-payroll-software-india)
- [Keka: Compensation planning software](https://www.keka.com/compensation-planning-software)
- [HROne: Compensation management software](https://hrone.cloud/blog/compensation-management-software/)
