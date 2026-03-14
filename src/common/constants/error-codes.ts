/**
 * Centralized error codes for API responses.
 * Use code in addition to HTTP status for client handling.
 */
export const ERROR_CODES = {
  // Auth (1xxx)
  UNAUTHORIZED: 1001,
  TOKEN_EXPIRED: 1002,
  INVALID_CREDENTIALS: 1003,
  FORBIDDEN: 1004,

  // Validation (2xxx)
  VALIDATION_FAILED: 2001,
  BAD_REQUEST: 2002,

  // Resource (3xxx)
  NOT_FOUND: 3001,
  CONFLICT: 3002,

  // Server (5xxx)
  INTERNAL_ERROR: 5001,
  SERVICE_UNAVAILABLE: 5002,
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
