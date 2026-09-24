import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <Link to="/" className="mt-2 inline-block text-sm underline">
        Go to the dashboard
      </Link>
    </div>
  );
}
