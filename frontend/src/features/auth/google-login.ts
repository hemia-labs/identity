import { API_BASE_URL } from '@/lib/api'

const RETURN_TO_KEY = 'hemia.google.returnTo'

export function startGoogleLogin(returnTo: string | null) {
  // Keep the callback fixed so it can be matched exactly by the backend allowlist.
  sessionStorage.removeItem(RETURN_TO_KEY)
  if (returnTo) sessionStorage.setItem(RETURN_TO_KEY, returnTo)
  const url = new URL(`${API_BASE_URL}/auth/google`, window.location.origin)
  url.searchParams.set('redirect_uri', new URL('/auth/callback', window.location.origin).toString())
  if (returnTo === '/invitations') url.searchParams.set('invitation', '1')
  window.location.assign(url.toString())
}

export function consumeGoogleReturnTo() {
  const returnTo = sessionStorage.getItem(RETURN_TO_KEY)
  sessionStorage.removeItem(RETURN_TO_KEY)
  return returnTo
}
