import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/login',
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/pages/auth/LoginPage.vue'),
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('@/pages/auth/RegisterPage.vue'),
    },
    {
      path: '/forgot-password',
      name: 'forgot-password',
      component: () => import('@/pages/auth/ForgotPasswordPage.vue'),
    },
    {
      path: '/reset-password',
      name: 'reset-password',
      component: () => import('@/pages/auth/ResetPasswordPage.vue'),
    },
    {
      path: '/verify-email',
      name: 'verify-email',
      component: () => import('@/pages/auth/VerifyEmailPage.vue'),
    },
    {
      path: '/mfa/challenge',
      name: 'mfa-challenge',
      component: () => import('@/pages/auth/MfaChallengePage.vue'),
    },
    {
      path: '/accounts',
      redirect: '/account-selector',
    },
    {
      path: '/account-selector',
      name: 'account-selector',
      component: () => import('@/pages/selection/AccountSelectorPage.vue'),
    },
    {
      path: '/select-organization',
      name: 'select-organization',
      component: () => import('@/pages/selection/SelectOrganizationPage.vue'),
    },
    {
      path: '/authorize',
      redirect: '/consent',
    },
    {
      path: '/consent',
      name: 'consent',
      component: () => import('@/pages/selection/ConsentPage.vue'),
    },
    {
      path: '/logout',
      name: 'logout',
      component: () => import('@/pages/system/LogoutPage.vue'),
    },
    {
      path: '/session-expired',
      name: 'session-expired',
      component: () => import('@/pages/system/SessionExpiredPage.vue'),
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/pages/system/NotFoundPage.vue'),
    },
  ],
})

export default router
