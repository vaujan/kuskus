import type { ApiErrorCode, ApiResult } from '../../shared/library-contract'

export function errorResult(error: unknown, code: ApiErrorCode = 'io-error'): ApiResult<never> {
  return {
    ok: false,
    code,
    error:
      error instanceof Error && error.message
        ? error.message
        : 'The operation could not be completed.'
  }
}
