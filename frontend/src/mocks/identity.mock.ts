export type SessionAccount = {
  accountIndex: number
  displayName: string
  email: string
  initials: string
  lastUsedAt: string
}

export type Organization = {
  organizationIndex: number
  name: string
  role: string
  status: 'active' | 'invited'
}

export type ConsentRequest = {
  clientName: string
  clientDomain: string
  redirectTo: string
  scopes: Array<{ key: string; label: string; description: string }>
}

export const sessionMock = {
  sessionLabel: 'Navegador actual',
  expiresIn: '28 min',
}

export const accountsMock: SessionAccount[] = [
  {
    accountIndex: 0,
    displayName: 'Cristian Mendez',
    email: 'cristian@hemia.mx',
    initials: 'CM',
    lastUsedAt: 'Hace 3 min',
  },
  {
    accountIndex: 1,
    displayName: 'Soporte Cliente ABC',
    email: 'soporte@cliente.com',
    initials: 'SA',
    lastUsedAt: 'Ayer',
  },
]

export const organizationsMock: Organization[] = [
  { organizationIndex: 0, name: 'Hemia', role: 'Owner', status: 'active' },
  { organizationIndex: 1, name: 'MedSync', role: 'Admin', status: 'active' },
  { organizationIndex: 2, name: 'Cliente ABC', role: 'Soporte', status: 'invited' },
]

export const consentMock: ConsentRequest = {
  clientName: 'Hemia Console',
  clientDomain: 'console.hemia.cloud',
  redirectTo: '/session-expired',
  scopes: [
    { key: 'profile', label: 'Perfil basico', description: 'Nombre visible y correo.' },
    { key: 'organizations', label: 'Organizaciones', description: 'Lista de organizaciones disponibles.' },
    { key: 'permissions', label: 'Permisos asignados', description: 'Roles y permisos para cargar Console.' },
  ],
}
