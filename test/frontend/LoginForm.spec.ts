import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { ref } from 'vue'
import LoginForm from '../../frontend/src/features/auth/components/LoginForm.vue'

const { mutateAsync, push, startGoogleLogin } = vi.hoisted(() => ({ mutateAsync: vi.fn(), push: vi.fn(), startGoogleLogin: vi.fn() }))
vi.mock('@/features/auth/google-login', () => ({ startGoogleLogin }))
const mutationError = ref<unknown>(null)
vi.mock('@/features/identity/composables/useIdentityApi', () => ({
  useLoginMutation: () => ({ mutateAsync, error: mutationError, isPending: ref(false) }),
}))
vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ push }),
}))

async function settleValidation() {
  await flushPromises()
  await new Promise(resolve => setTimeout(resolve, 30))
  await flushPromises()
}

function render() {
  return mount(LoginForm, { global: { plugins: [createPinia()] } })
}

beforeEach(() => {
  vi.clearAllMocks()
  mutationError.value = null
})

describe('LoginForm', () => {
  it('offers Google first and reveals the password form on request', async () => {
    const wrapper = render()
    expect(wrapper.findAll('button')[0]!.text()).toBe('Iniciar sesión con Google')
    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.find('input[type="password"]').exists()).toBe(false)
    await wrapper.findAll('button').find(button => button.text() === 'Continuar con contraseña')!.trigger('click')
    expect(wrapper.find('form').exists()).toBe(true)
    expect(wrapper.find('input[type="email"]').exists()).toBe(true)
    expect(wrapper.find('input[type="password"]').exists()).toBe(true)
    expect(mutateAsync).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('starts Google login without submitting password credentials', async () => {
    const wrapper = render()
    const button = wrapper.findAll('button').find(button => button.text() === 'Iniciar sesión con Google')!
    await button.trigger('click')
    expect(startGoogleLogin).toHaveBeenCalledWith(null)
    expect(mutateAsync).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it.each([undefined, ''])('shows a required message for password %s without calling login', async password => {
    const wrapper = render()
    await wrapper.findAll('button').find(button => button.text() === 'Continuar con contraseña')!.trigger('click')
    await wrapper.get('input[type="email"]').setValue('person@example.com')
    if (password !== undefined) await wrapper.get('input[type="password"]').setValue(password)
    await wrapper.get('form').trigger('submit')
    await settleValidation()
    expect(wrapper.text()).toContain('Ingresa tu contrasena')
    expect(mutateAsync).not.toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
    wrapper.unmount()
  })
  it('shows the length message for a short password without calling login', async () => {
    const wrapper = render()
    await wrapper.findAll('button').find(button => button.text() === 'Continuar con contraseña')!.trigger('click')
    await wrapper.get('input[type="email"]').setValue('person@example.com')
    await wrapper.get('input[type="password"]').setValue('short')
    await wrapper.get('form').trigger('submit')
    await settleValidation()
    expect(wrapper.text()).toContain('Minimo 8 caracteres')
    expect(mutateAsync).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('handles a rejected login and keeps the form available for retry', async () => {
    mutateAsync.mockImplementationOnce(async () => {
      const error = { status: 401, message: 'Credenciales invalidas' }
      mutationError.value = error
      throw error
    })
    const wrapper = render()
    await wrapper.findAll('button').find(button => button.text() === 'Continuar con contraseña')!.trigger('click')
    await wrapper.get('input[type="email"]').setValue('person@example.com')
    await wrapper.get('input[type="password"]').setValue('example-password')
    await wrapper.get('form').trigger('submit')
    await settleValidation()
    expect(wrapper.text()).toContain('Credenciales invalidas')
    expect(push).not.toHaveBeenCalled()
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeUndefined()
    mutateAsync.mockResolvedValueOnce({ session: { sessionId: 'test-session' } })
    await wrapper.get('form').trigger('submit')
    await settleValidation()
    expect(push).toHaveBeenCalledWith('/session')
    wrapper.unmount()
  })

})
