export type ApiError = {
  status: number
  message: string
  details?: unknown
}

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api/v1'

export function getApiOrigin() {
  return new URL(API_BASE_URL, window.location.origin).origin
}

export function resolveBackendUrl(url: string) {
  return new URL(url, getApiOrigin()).toString()
}

type FetchJsonOptions = Omit<RequestInit, 'body'> & {
  body?: unknown
}

export async function fetchJson<T>(path: string, options: FetchJsonOptions = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  if (!response.ok) {
    throw await toApiError(response)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

async function toApiError(response: Response): Promise<ApiError> {
  try {
    const payload = await response.json()
    return {
      status: response.status,
      message: Array.isArray(payload.message)
        ? payload.message.join(', ')
        : payload.message || response.statusText,
      details: payload,
    }
  } catch {
    return {
      status: response.status,
      message: response.statusText,
    }
  }
}

export function getErrorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message)
  }

  return 'No se pudo completar la accion'
}
