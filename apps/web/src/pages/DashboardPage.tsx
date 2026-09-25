import { COUNTRIES } from '@salary/shared';
import { useCurrentUser } from '../auth/session.ts';
import { ExchangeRatesCard } from '../currency/ExchangeRatesCard.tsx';
import {
  insightsSearch,
  useDepartmentCosts,
  useInsightsSummary,
  usePayRanges,
} from '../dashboard/api.ts';
import { DashboardFilters } from '../dashboard/DashboardFilters.tsx';
import { DepartmentSection } from '../dashboard/DepartmentSection.tsx';
import { JobTitleSection } from '../dashboard/JobTitleSection.tsx';
import { OutliersSection } from '../dashboard/OutliersSection.tsx';
import { PayRangeSection } from '../dashboard/PayRangeSection.tsx';
import { CountryCostSection, SummaryFigures } from '../dashboard/SummarySection.tsx';
import { useDashboardQuery } from '../dashboard/useDashboardQuery.ts';

/**
 * How the organisation pays people (F7): headcount and cost, pay range per country, cost per
 * department, pay per job title and pay far from peers, within the user's scope (HLD 3.1).
 */
export function DashboardPage() {
  const { data: user } = useCurrentUser();
  const { query, update } = useDashboardQuery();
  const summary = useInsightsSummary(query);
  const ranges = usePayRanges(query);
  const departments = useDepartmentCosts(query);
  const ownCountry = user?.countryCode ?? null;
  const oneCountry = query.country !== undefined || ownCountry !== null;

  return (
    <>
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      {ownCountry && <p className="mt-1 text-muted-foreground">{COUNTRIES[ownCountry].name}</p>}
      <div className="mt-6">
        <DashboardFilters query={query} update={update} />
      </div>

      <SummaryFigures data={summary.data} status={summary} />
      {summary.data?.countryCode === null && (
        <CountryCostSection data={summary.data} status={summary} />
      )}
      <PayRangeSection data={ranges.data} status={ranges} oneCountry={oneCountry} />
      <DepartmentSection data={departments.data} status={departments} />
      <JobTitleSection query={query} chooseCountry={!oneCountry} />
      <OutliersSection key={insightsSearch(query)} query={query} showCountry={!oneCountry} />
      <ExchangeRatesCard />
    </>
  );
}
