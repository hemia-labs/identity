import { afterEach, describe, expect, it, vi } from 'vitest'
import { startGoogleLogin, consumeGoogleReturnTo } from '../../frontend/src/features/auth/google-login'

afterEach(() => { vi.unstubAllGlobals(); sessionStorage.clear() })

describe('Google login navigation', () => {
  it('uses the configured backend and fixed callback while keeping returnTo in this tab', () => {
    const assign = vi.fn()
    vi.stubGlobal('window', { location: { origin: 'https://id.example.test', assign } })
    const returnTo = '/oauth/authorize?state=original&client_id=app'
    startGoogleLogin(returnTo)
    const url = new URL(assign.mock.calls[0]![0])
    expect(url.pathname).toMatch(/\/auth\/google$/)
    expect(url.searchParams.get('redirect_uri')).toBe('https://id.example.test/auth/callback')
    expect(consumeGoogleReturnTo()).toBe(returnTo)
    expect(consumeGoogleReturnTo()).toBeNull()
  })
  it('clears a previous OAuth request when starting a direct login', () => {
    vi.stubGlobal('window', { location: { origin: 'https://id.example.test', assign: vi.fn() } })
    startGoogleLogin('/oauth/authorize?state=old')
    startGoogleLogin(null)
    expect(consumeGoogleReturnTo()).toBeNull()
  })
})
