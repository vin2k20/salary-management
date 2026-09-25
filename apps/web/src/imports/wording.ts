import type { ImportSummary } from '@salary/shared';

const countFormat = new Intl.NumberFormat('en-US');

/** "1 employee" or "3 employees". */
export function counted(count: number, singular: string, plural = `${singular}s`): string {
  return `${countFormat.format(count)} ${count === 1 ? singular : plural}`;
}

/** "a, b and c". */
function listed(parts: string[]): string {
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} and ${parts.at(-1) ?? ''}`;
}

/** Employees added and updated and pay changes, with the verb for each: "to add" or "added". */
function parts(summary: ImportSummary, verbs: { add: string; update: string }): string[] {
  const result: string[] = [];
  const { added, updated } = summary.employees;
  if (added > 0) result.push(`${counted(added, 'employee')} ${verbs.add}`);
  if (updated > 0) {
    result.push(
      added > 0
        ? `${countFormat.format(updated)} ${verbs.update}`
        : `${counted(updated, 'employee')} ${verbs.update}`,
    );
  }
  if (summary.pay.changed > 0) result.push(counted(summary.pay.changed, 'pay change'));
  return result;
}

export function changeCount(summary: ImportSummary): number {
  return summary.employees.added + summary.employees.updated + summary.pay.changed;
}

/** "1 employee to add, 1 to update and 1 pay change." */
export function previewSentence(summary: ImportSummary): string {
  return `${listed(parts(summary, { add: 'to add', update: 'to update' }))}.`;
}

/** "Imported: 1 employee added, 1 updated and 1 pay change." */
export function resultSentence(summary: ImportSummary): string {
  const done = parts(summary, { add: 'added', update: 'updated' });
  return done.length === 0 ? 'Imported: nothing changed.' : `Imported: ${listed(done)}.`;
}
