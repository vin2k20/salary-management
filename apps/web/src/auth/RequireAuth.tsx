import { Navigate, Outlet, useLocation } from 'react-router';
import { AppShell } from '../app/AppShell.tsx';
import { useCurrentUser } from './session.ts';

/** Shows the app to signed-in users and sends everyone else to the login page. */
export function RequireAuth() {
  const { data: user, isPending, isError } = useCurrentUser();
  const location = useLocation();

  if (isPending) {
    return <p className="p-6 text-sm text-muted-foreground">Loading...</p>;
  }
  if (isError) {
    return (
      <p role="alert" className="p-6 text-sm">
        The application cannot reach the server. Try again in a minute.
      </p>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return (
    <AppShell user={user}>
      <Outlet />
    </AppShell>
  );
}
