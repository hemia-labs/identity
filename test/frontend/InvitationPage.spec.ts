import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import InvitationPage from '../../frontend/src/pages/auth/InvitationPage.vue'
const { fetchJson, getSession, push } = vi.hoisted(() => ({ fetchJson: vi.fn(), getSession: vi.fn(), push: vi.fn() }))
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
describe('Invitation onboarding UI', () => {
  it('exchanges the fragment token, removes it from the URL and waits for explicit acceptance', async () => {
    getSession.mockResolvedValue({ sessionId: 'session', user: { email: invitation.email } })
    const wrapper = render(); await flushPromises()
    expect(fetchJson).toHaveBeenCalledWith('/auth/invitations/preview', { method: 'POST', body: { token: 'secret-token' } })
    expect(window.location.hash).toBe('')
    expect(sessionStorage.length).toBe(0)
    expect(fetchJson).toHaveBeenCalledTimes(1)
    await wrapper.findAll('button').find(b => b.text() === 'Aceptar invitación')!.trigger('click'); await flushPromises()
    expect(fetchJson).toHaveBeenLastCalledWith('/auth/invitations/accept', { method: 'POST', body: {} })
    expect(wrapper.text()).toContain('Ya formas parte de Org')
  })
  it('does not let a session with a different email accept', async () => {
    getSession.mockResolvedValue({ sessionId: 'session', user: { email: 'other@example.test' } })
    const wrapper = render(); await flushPromises()
    expect(wrapper.text()).toContain('Inicia sesión con el correo invitado')
    expect(wrapper.findAll('button').some(b => b.text() === 'Aceptar invitación')).toBe(false)
  })
  it('registers the invited email server-side and then accepts using cookies', async () => {
    const wrapper = render(); await flushPromises()
    await wrapper.get('input[autocomplete="given-name"]').setValue('Name')
    await wrapper.get('input[autocomplete="family-name"]').setValue('Surname')
    await wrapper.findAll('input[type="password"]')[0]!.setValue('safe-password')
    await wrapper.findAll('input[type="password"]')[1]!.setValue('safe-password')
    await wrapper.get('input[type="checkbox"]').setValue(true)
    fetchJson.mockResolvedValueOnce({ session: { sessionId: 'new-session' } }).mockResolvedValueOnce({ accepted: true })
    await wrapper.get('form').trigger('submit'); await flushPromises()
    expect(fetchJson).toHaveBeenCalledWith('/auth/invitations/register', { method: 'POST', body: { firstName: 'Name', lastName: 'Surname', password: 'safe-password' } })
    expect(wrapper.text()).toContain('Ya formas parte de Org')
  })
  it('keeps a failed preview recoverable without storing the token', async () => {
    fetchJson.mockRejectedValueOnce(new Error('unavailable'))
    const wrapper = render(); await flushPromises()
    expect(wrapper.text()).toContain('unavailable')
    await wrapper.findAll('button').find(b => b.text() === 'Reintentar')!.trigger('click'); await flushPromises()
    expect(fetchJson).toHaveBeenLastCalledWith('/auth/invitations/preview', { method: 'POST', body: { token: 'secret-token' } })
  })
})
