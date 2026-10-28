import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import InvitationPage from '../../frontend/src/pages/auth/InvitationPage.vue'
const { fetchJson, getSession, push, startGoogleLogin } = vi.hoisted(() => ({ fetchJson: vi.fn(), getSession: vi.fn(), push: vi.fn(), startGoogleLogin: vi.fn() }))
vi.mock('@/features/auth/google-login', () => ({ startGoogleLogin }))
vi.mock('@/lib/api', () => ({ fetchJson, getErrorMessage: (e: Error) => e.message }))
vi.mock('@/features/identity/api/identity.api', () => ({ getSession }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push }), RouterLink: { template: '<a><slot /></a>' } }))
const invitation = { email: 'invitee@example.test', organization: 'Org', expiresAt: '2030-01-01' }
function render() { return mount(InvitationPage, { global: { plugins: [createPinia()], stubs: { AuthLayout: { template: '<div><slot /></div>' } } } }) }
beforeEach(() => {
  vi.clearAllMocks(); sessionStorage.clear();
  window.history.replaceState(null, '', '/invitations#token=secret-token')
  fetchJson.mockResolvedValue(invitation)
  getSession.mockRejectedValue(new Error('unauthorized'))
})
afterEach(() => vi.unstubAllGlobals())
describe('Invitation onboarding UI', () => {
  it('exchanges the fragment token, removes it from the URL and waits for explicit acceptance', async () => {
    getSession.mockResolvedValue({ sessionId: 'session', user: { email: invitation.email } })
    const wrapper = render(); await flushPromises()
    expect(fetchJson).toHaveBeenCalledWith('/auth/invitations/preview', { method: 'POST', body: { token: 'secret-token' } })
    expect(window.location.hash).toBe('')
    expect(sessionStorage.length).toBe(0)
    expect(fetchJson).toHaveBeenCalledTimes(1)
    fetchJson.mockResolvedValueOnce({ redirect_url: 'https://app.example.test/' })
    const assign = vi.fn()
    const realWindow = window
    vi.stubGlobal('window', new Proxy(realWindow, { get(target, key) { return key === 'location' ? { assign } : Reflect.get(target, key) } }))
    await wrapper.findAll('button').find(b => b.text() === 'Aceptar invitación')!.trigger('click'); await flushPromises()
    expect(fetchJson).toHaveBeenLastCalledWith('/auth/invitations/accept', { method: 'POST', body: {} })
    expect(assign).toHaveBeenCalledWith('https://app.example.test/')
  })
  it('does not let a session with a different email accept', async () => {
    getSession.mockResolvedValue({ sessionId: 'session', user: { email: 'other@example.test' } })
    const wrapper = render(); await flushPromises()
    expect(wrapper.text()).toContain('Inicia sesión con el correo invitado')
    expect(wrapper.findAll('button').some(b => b.text() === 'Aceptar invitación')).toBe(false)
  })
  it('uses Google without asking for profile data or a password', async () => {
    const wrapper = render(); await flushPromises()
    expect(wrapper.find('input[autocomplete="given-name"]').exists()).toBe(false)
    expect(wrapper.find('input[autocomplete="family-name"]').exists()).toBe(false)
    expect(wrapper.find('input[type="password"]').exists()).toBe(false)
    const google = wrapper.findAll('button').find(b => b.text() === 'Continuar con Google')!
    expect(google.attributes('disabled')).toBeDefined()
    await wrapper.get('input[type="checkbox"]').setValue(true)
    await google.trigger('click')
    expect(startGoogleLogin).toHaveBeenCalledWith('/invitations')
    expect(fetchJson).toHaveBeenCalledTimes(1)
  })
  it('shows an error when Google login cannot start', async () => {
    startGoogleLogin.mockImplementationOnce(() => { throw new Error('storage blocked') })
    const wrapper = render(); await flushPromises()
    await wrapper.get('input[type="checkbox"]').setValue(true)
    await wrapper.findAll('button').find(b => b.text() === 'Continuar con Google')!.trigger('click')
    expect(wrapper.text()).toContain('No se pudo iniciar Google')
  })
  it('keeps a failed preview recoverable without storing the token', async () => {
    fetchJson.mockRejectedValueOnce(new Error('unavailable'))
    const wrapper = render(); await flushPromises()
    expect(wrapper.text()).toContain('unavailable')
    await wrapper.findAll('button').find(b => b.text() === 'Reintentar')!.trigger('click'); await flushPromises()
    expect(fetchJson).toHaveBeenLastCalledWith('/auth/invitations/preview', { method: 'POST', body: { token: 'secret-token' } })
  })
})
