export function formatServiceError(error: unknown): string {
  if (error instanceof Error) return error.message

  if (error && typeof error === 'object') {
    const serviceError = error as {
      message?: string
      details?: string
      hint?: string
      code?: string
    }

    const parts = [
      serviceError.message,
      serviceError.details,
      serviceError.hint,
      serviceError.code,
    ].filter((part): part is string => typeof part === 'string' && part.length > 0)

    if (parts.length > 0) return parts.join(' | ')
  }

  return String(error)
}
