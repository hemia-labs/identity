import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import GoogleCallbackPage from '../../frontend/src/pages/auth/GoogleCallbackPage.vue'
import { useAuthStore } from '../../frontend/src/features/auth/stores/auth.store'

const { getSession, replace, query } = vi.hoisted(() => ({
  getSession: vi.fn(), replace: vi.fn(), query: {} as Record<string, string>,
}))
vi.mock('@/features/identity/api/identity.api', () => ({ getSession }))
vi.mock('vue-router', () => ({
  useRoute: () => ({ query }), useRouter: () => ({ replace }),
  RouterLink: { template: '<a><slot /></a>' },
}))

beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
  delete query.error
})

function render() {
  const pinia = createPinia()
  const wrapper = mount(GoogleCallbackPage, {
    global: { plugins: [pinia], stubs: { AuthLayout: { template: '<div><slot /></div>' }, RouterLink: true } },
  })
  return { wrapper, store: useAuthStore(pinia) }
}

describe('Google callback', () => {
  it('verifies the session and resumes the OAuth request through consent', async () => {
    const returnTo = '/oauth/authorize?client_id=app&state=original'
    sessionStorage.setItem('hemia.google.returnTo', returnTo)
    getSession.mockResolvedValue({ sessionId: 'google-session' })
    const { store } = render()
    await flushPromises()
    expect(store.sessionId).toBe('google-session')
    expect(replace).toHaveBeenCalledWith({ path: '/consent', query: { returnTo } })
    expect(sessionStorage.getItem('hemia.google.returnTo')).toBeNull()
  })

  it('returns to invitation acceptance after Google login', async () => {
    sessionStorage.setItem('hemia.google.returnTo', '/invitations')
    getSession.mockResolvedValue({ sessionId: 'google-session' })
    render()
    await flushPromises()
    expect(replace).toHaveBeenCalledWith('/invitations')
  })

  it('opens the session page when there is no OAuth request', async () => {
    getSession.mockResolvedValue({ sessionId: 'google-session' })
    render()
    await flushPromises()
    expect(replace).toHaveBeenCalledWith('/session')
  })

  it('shows a retry when session verification fails', async () => {
    getSession.mockRejectedValue(new Error('unauthorized'))
    const { wrapper, store } = render()
    await flushPromises()
    expect(wrapper.text()).toContain('No se pudo verificar tu sesión')
    expect(store.isAuthenticated).toBe(false)
    expect(replace).not.toHaveBeenCalled()
  })

  it.each([
    ['account_link_required', 'método habitual'],
    ['user_not_found', 'El usuario no existe'],
    ['google_auth_failed', 'Intenta de nuevo'],
  ])('handles %s without accepting an existing session', async (error, message) => {
    query.error = error
    const { wrapper, store } = render()
    await flushPromises()
    expect(wrapper.text()).toContain(message)
    expect(getSession).not.toHaveBeenCalled()
    expect(store.isAuthenticated).toBe(false)
  })
})
