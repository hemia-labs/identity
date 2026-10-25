import { z } from 'zod'

export const loginSchema = z.object({
  email: z.email('Correo invalido'),
  password: z.string({ error: 'Ingresa tu contrasena' })
    .min(1, 'Ingresa tu contrasena')
    .min(8, 'Minimo 8 caracteres'),
})

export const registerSchema = z
  .object({
    name: z.string().min(2, 'Nombre requerido'),
    email: z.email('Correo invalido'),
    password: z.string().min(8, 'Minimo 8 caracteres'),
    confirmPassword: z.string().min(8, 'Confirma tu password'),
    acceptTerms: z.boolean().refine(Boolean, 'Debes aceptar terminos'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Los passwords no coinciden',
    path: ['confirmPassword'],
  })

export const forgotPasswordSchema = z.object({
  email: z.email('Correo invalido'),
})

export const resetPasswordSchema = z
  .object({
    token: z.string().min(6, 'Token requerido'),
    password: z.string().min(8, 'Minimo 8 caracteres'),
    confirmPassword: z.string().min(8, 'Confirma tu password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Los passwords no coinciden',
    path: ['confirmPassword'],
  })

export const mfaSchema = z.object({
  code: z.array(z.coerce.string()).length(6, 'Codigo de 6 digitos'),
})
