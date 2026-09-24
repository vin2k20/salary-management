import { useQuery } from '@tanstack/react-query';
import { fetchHealth } from '../api/health.ts';

export function HomePage() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: ({ signal }) => fetchHealth(signal),
    // Show the current state straight away; the query runs again when the window regains focus.
    retry: false,
  });

  let apiStatus = 'Unavailable';
  let databaseStatus = 'Unknown';
  if (health.isPending) {
    apiStatus = 'Checking...';
    databaseStatus = 'Checking...';
  } else if (health.isSuccess) {
    apiStatus = 'Available';
    databaseStatus = health.data.database === 'ok' ? 'Available' : 'Unavailable';
  }

  return (
    <>
      <h1 className="text-2xl font-semibold">Salary Management</h1>
      <section aria-labelledby="system-status-heading" className="mt-6">
        <h2 id="system-status-heading" className="text-lg font-medium">
          System status
        </h2>
        <ul role="status" className="mt-2 space-y-1 text-sm">
          <li>
            API: <strong>{apiStatus}</strong>
          </li>
          <li>
            Database: <strong>{databaseStatus}</strong>
          </li>
        </ul>
      </section>
    </>
  );
}
