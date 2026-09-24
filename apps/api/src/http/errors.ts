/** An error with an HTTP status and a message that is safe to show to the client. */
export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = 'HttpError';
    this.status = status;
  }
}

export interface FieldError {
  field: string;
  message: string;
}

/** A request that failed validation, with a message per field. */
export class RequestValidationError extends Error {
  readonly errors: FieldError[];

  constructor(errors: FieldError[]) {
    super('The request has invalid fields');
    this.name = 'RequestValidationError';
    this.errors = errors;
  }
}
