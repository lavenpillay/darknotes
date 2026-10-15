/** Domain errors thrown by the service layer. Adapters (REST, MCP) map these to transport errors. */

export type DomainErrorCode = 'not_found' | 'invalid' | 'conflict';

export class DomainError extends Error {
  constructor(
    readonly code: DomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends DomainError {
  constructor(message: string) {
    super('not_found', message);
  }
}

export class ValidationError extends DomainError {
  constructor(message: string) {
    super('invalid', message);
  }
}

/** The request is well-formed but not allowed in the current state (e.g. deleting the last workspace). */
export class ConflictError extends DomainError {
  constructor(message: string) {
    super('conflict', message);
  }
}
