import type { ImportAction, ImportSummary } from '@salary/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { errorMessage } from '../api/errors.ts';
import { Alert } from '../components/ui/alert.tsx';
import { Button } from '../components/ui/button.tsx';
import { Input } from '../components/ui/input.tsx';
import { Label } from '../components/ui/label.tsx';
import { StatTable } from '../dashboard/StatTable.tsx';
import { commitFile, templateHref, validateFile } from '../imports/api.ts';
import { changeCount, counted, previewSentence, resultSentence } from '../imports/wording.ts';

const ACTION_LABELS: Record<ImportAction, string> = {
  add: 'Add',
  update: 'Update',
  pay: 'Pay change',
};

const TEMPLATES = [
  { label: 'Excel template', href: templateHref('xlsx') },
  { label: 'CSV template: employees', href: templateHref('csv', 'employees') },
  { label: 'CSV template: pay components', href: templateHref('csv', 'pay') },
];

const countFormat = new Intl.NumberFormat('en-US');

function Problems({ summary }: { summary: ImportSummary }) {
  return (
    <section aria-labelledby="problems-heading" className="mt-6">
      <h2 id="problems-heading" className="sr-only">
        Problems
      </h2>
      <Alert>
        The file has {counted(summary.errorCount, 'problem')}. Nothing was saved; fix{' '}
        {summary.errorCount === 1 ? 'it' : 'them'} and check the file again.
      </Alert>
      <StatTable
        label="Problems"
        className="mt-4 max-h-[28rem] overflow-y-auto"
        columns={[
          { header: 'Sheet' },
          { header: 'Row' },
          { header: 'Column' },
          { header: 'Problem' },
        ]}
        rows={summary.errors.map((error, index) => ({
          key: String(index),
          cells: [
            error.sheet,
            error.row === null ? '' : String(error.row),
            error.column ?? '',
            error.message,
          ],
        }))}
      />
      {summary.errors.length < summary.errorCount && (
        <p className="mt-2 text-sm text-muted-foreground">
          Showing the first {countFormat.format(summary.errors.length)} of{' '}
          {counted(summary.errorCount, 'problem')}.
        </p>
      )}
    </section>
  );
}

function Preview({
  summary,
  onImport,
  importing,
}: {
  summary: ImportSummary;
  onImport: () => void;
  importing: boolean;
}) {
  const total = changeCount(summary);
  if (total === 0) {
    return (
      <p role="status" className="mt-6 text-sm">
        Nothing to import: every row matches what is stored.
      </p>
    );
  }
  return (
    <section aria-labelledby="changes-heading" className="mt-6">
      <h2 id="changes-heading" className="text-lg font-medium">
        Changes
      </h2>
      <p className="mt-1 text-sm">{previewSentence(summary)}</p>
      <StatTable
        label="Changes"
        className="mt-4 max-h-[28rem] overflow-y-auto"
        columns={[
          { header: 'Sheet' },
          { header: 'Row' },
          { header: 'Employee code' },
          { header: 'Change' },
          { header: 'Details' },
        ]}
        rows={summary.changes.map((change) => ({
          key: `${change.sheet} ${String(change.row)}`,
          cells: [
            change.sheet,
            String(change.row),
            change.employeeCode,
            ACTION_LABELS[change.action],
            change.details,
          ],
        }))}
      />
      {summary.changes.length < total && (
        <p className="mt-2 text-sm text-muted-foreground">
          Showing the first {countFormat.format(summary.changes.length)} of{' '}
          {counted(total, 'change')}.
        </p>
      )}
      <Button className="mt-4" disabled={importing} onClick={onImport}>
        {importing ? 'Importing...' : `Import ${counted(total, 'change')}`}
      </Button>
    </section>
  );
}

/**
 * Import (HLD 6.3): choose an Excel or CSV file, check it and see every problem by row and
 * column, then save it. Nothing is saved unless the whole file is valid.
 */
export function ImportPage() {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  // A new input after an import, so the same file can be chosen again.
  const [inputKey, setInputKey] = useState(0);
  const check = useMutation({ mutationFn: validateFile });
  const save = useMutation({
    mutationFn: commitFile,
    // Employees, pay and the dashboard may all have changed.
    onSuccess: () => queryClient.invalidateQueries(),
  });

  function startAgain(next: File | null) {
    setFile(next);
    check.reset();
    save.reset();
  }

  return (
    <>
      <h1 className="text-2xl font-semibold">Import</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        Add or update employees and their current pay from an Excel or CSV file with the template
        columns. An export from the Employees page has the same columns, with your data. Files are
        checked first, and nothing is saved unless every row is valid. Excel files can have up to
        20,000 rows; use CSV files for more.
      </p>
      <ul className="mt-3 flex flex-wrap gap-4 text-sm">
        {TEMPLATES.map((template) => (
          <li key={template.label}>
            <a href={template.href} download className="underline underline-offset-4">
              {template.label}
            </a>
          </li>
        ))}
      </ul>

      {save.isSuccess ? (
        <div role="status" className="mt-6 rounded-lg border p-4 text-sm">
          <p>{resultSentence(save.data)}</p>
          <div className="mt-3 flex gap-2">
            <Link to="/employees" className="underline underline-offset-4">
              Go to employees
            </Link>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                startAgain(null);
                setInputKey((key) => key + 1);
              }}
            >
              Import another file
            </Button>
          </div>
        </div>
      ) : (
        <>
          <form
            className="mt-6 flex flex-wrap items-end gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (file) check.mutate(file);
            }}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="import-file">File</Label>
              <Input
                key={inputKey}
                id="import-file"
                type="file"
                accept=".xlsx,.csv"
                className="w-80"
                onChange={(event) => {
                  startAgain(event.target.files?.[0] ?? null);
                }}
              />
            </div>
            <Button type="submit" variant="secondary" disabled={!file || check.isPending}>
              {check.isPending ? 'Checking...' : 'Check file'}
            </Button>
          </form>

          {check.isError && <Alert className="mt-6">{errorMessage(check.error)}</Alert>}
          {save.isError && <Alert className="mt-6">{errorMessage(save.error)}</Alert>}
          {check.data &&
            (check.data.valid ? (
              <Preview
                summary={check.data}
                importing={save.isPending}
                onImport={() => {
                  if (file) save.mutate(file);
                }}
              />
            ) : (
              <Problems summary={check.data} />
            ))}
        </>
      )}
    </>
  );
}
