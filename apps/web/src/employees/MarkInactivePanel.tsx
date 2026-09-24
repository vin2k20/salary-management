import { useState } from 'react';
import { TextField } from '../components/text-field.tsx';
import { Alert } from '../components/ui/alert.tsx';
import { Button } from '../components/ui/button.tsx';

/** Today in UTC (YYYY-MM-DD), the same day the API checks against. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Asks for the inactive date before an employee is marked inactive. */
export function MarkInactivePanel({
  name,
  hireDate,
  pending,
  error,
  onConfirm,
  onCancel,
}: {
  name: string;
  hireDate: string;
  pending: boolean;
  error: string | null;
  onConfirm: (inactiveOn: string) => void;
  onCancel: () => void;
}) {
  const [inactiveOn, setInactiveOn] = useState(today);

  return (
    <section
      aria-labelledby="mark-inactive-heading"
      className="mt-6 rounded-lg border bg-card p-6 shadow-sm"
    >
      <h2 id="mark-inactive-heading" className="text-lg font-medium">
        Mark inactive
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {name} will be left out of the directory and the dashboard. Their details and pay history
        are kept, and they can be marked active again.
      </p>
      {error && <Alert className="mt-4">{error}</Alert>}
      <div className="mt-4 max-w-xs">
        <TextField
          id="employee-inactive-on"
          label="Inactive from"
          type="date"
          min={hireDate}
          max={today()}
          value={inactiveOn}
          onChange={(event) => {
            setInactiveOn(event.target.value);
          }}
        />
      </div>
      <div className="mt-4 flex gap-2">
        <Button
          disabled={pending}
          onClick={() => {
            onConfirm(inactiveOn);
          }}
        >
          {pending ? 'Saving...' : 'Confirm mark inactive'}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </section>
  );
}
