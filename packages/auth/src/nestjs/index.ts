export { SsoModule, type SsoModuleAsyncOptions } from './sso.module';
export { SSO_CONFIG, SESSION_STORE } from './tokens';
export { SsoAuthGuard } from './sso.guard';
export {
  Public,
  CurrentUser,
  IS_PUBLIC_KEY,
  type RequestAuthContext,
  type CurrentUserPayload,
} from './decorators';
export { SsoExceptionFilter } from './exceptions';

// Lo que inyecta @CurrentUser() (= req.user que cuelga SsoAuthGuard). Alias para el adapter.
export type { AuthenticatedUser as CurrentUserPayload } from '../core/index';
