import type { ReactNode } from 'react';
import { errorMessage } from '../api/errors.ts';
import { Alert } from '../components/ui/alert.tsx';

/** What a section needs to know about its request. */
export interface SectionStatus {
  isPending: boolean;
  isError: boolean;
  error: unknown;
  isPlaceholderData: boolean;
}

/**
 * A titled dashboard section with its loading and error states. While new filters load, the
 * previous figures stay on screen, dimmed, so the page does not jump.
 */
export function DashboardSection({
  id,
  title,
  description,
  actions,
  status,
  children,
}: {
  id: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  status: SectionStatus;
  children: ReactNode;
}) {
  const headingId = `${id}-heading`;
  return (
    <section aria-labelledby={headingId} className="mt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id={headingId} className="text-lg font-medium">
            {title}
          </h2>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions}
      </div>
      {status.isError && <Alert className="mt-4">{errorMessage(status.error)}</Alert>}
      {status.isPending && <p className="mt-4 text-sm text-muted-foreground">Loading...</p>}
      <div className={status.isPlaceholderData ? 'opacity-60 transition-opacity' : undefined}>
        {children}
      </div>
    </section>
  );
}
