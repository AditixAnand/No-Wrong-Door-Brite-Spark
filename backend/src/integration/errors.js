// A shared error vocabulary every source client throws, so the aggregation
// layer can classify failures generically instead of knowing about any one
// source's quirks (SPEC2.md: "clean, centralized and reusable error
// handling for integrations").

class SourceNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SourceNotFoundError';
  }
}

class SourceHttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'SourceHttpError';
    this.status = status;
  }
}

class SourceInvalidResponseError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SourceInvalidResponseError';
  }
}

export { SourceNotFoundError, SourceHttpError, SourceInvalidResponseError };
