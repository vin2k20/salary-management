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
      <h1>Salary Management</h1>
      <section aria-labelledby="system-status-heading">
        <h2 id="system-status-heading">System status</h2>
        <ul role="status" className="status-list">
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
