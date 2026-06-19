import { SetMetadata, createParamDecorator, type ExecutionContext } from '@nestjs/common';

/** Clave de metadatos fijada por {@link Public} y leída por {@link SsoAuthGuard}. */
export const IS_PUBLIC_KEY = 'isPublic';

/** Marca una ruta o controlador como que no requiere autenticación. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Decorador de parámetro que inyecta el usuario autenticado adjuntado por {@link SsoAuthGuard}. */
export const CurrentUser = createParamDecorator(
  (_d: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest().user,
);
