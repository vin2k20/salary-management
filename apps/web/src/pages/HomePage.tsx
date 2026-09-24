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
  if (health.isPending) apiStatus = 'Checking...';
  else if (health.isSuccess) apiStatus = 'Available';

  return (
    <>
      <h1>Salary Management</h1>
      <section aria-labelledby="system-status-heading">
        <h2 id="system-status-heading">System status</h2>
        <p role="status">
          API: <strong>{apiStatus}</strong>
        </p>
      </section>
    </>
  );
}
