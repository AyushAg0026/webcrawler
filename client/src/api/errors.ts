// One error type for both APIs, so the UI can show `error.message` and check `status`.
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}
