/** Нарушение инварианта: домен отказывает, а не правит молча. */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}

export function fail(message: string): never {
  throw new DomainError(message);
}
