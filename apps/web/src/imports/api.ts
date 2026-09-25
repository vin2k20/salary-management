import {
  importSummarySchema,
  type ExportFormat,
  type ImportSummary,
  type SpreadsheetDataset,
} from '@salary/shared';
import { apiUpload } from '../api/client.ts';

/** Checks a file and previews its changes; nothing is saved. */
export function validateFile(file: File): Promise<ImportSummary> {
  return apiUpload('/api/imports/validate', file, importSummarySchema);
}

/** Saves a file, all or nothing. */
export function commitFile(file: File): Promise<ImportSummary> {
  return apiUpload('/api/imports/commit', file, importSummarySchema);
}

export function templateHref(format: ExportFormat, dataset?: SpreadsheetDataset): string {
  const params = new URLSearchParams({ format });
  if (dataset) params.set('dataset', dataset);
  return `/api/imports/template?${params.toString()}`;
}
