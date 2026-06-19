import { Module, type DynamicModule, type Provider } from '@nestjs/common';
import { SsoCore, SsoClient, validateConfig, type SsoConfig } from '../core/index';
import type { SessionStore } from '../core/index';
import { SSO_CONFIG, SESSION_STORE } from './tokens';
import { SsoController } from './sso.controller';
import { SsoAuthGuard } from './sso.guard';

/** Opciones para {@link SsoModule.forRootAsync}. */
export interface SsoModuleAsyncOptions {
  /** Módulos a importar para que las dependencias de `inject` estén disponibles en la factory de config. */
  imports?: any[];
  /** Providers inyectados en `useFactoryConfig`. */
  inject?: any[];
  /** Factory que construye el {@link SsoConfig}; se valida antes de crear {@link SsoCore}. */
  useFactoryConfig: (...args: any[]) => SsoConfig | Promise<SsoConfig>;
  /** Provider que enlaza el {@link SessionStore} de la app al token {@link SESSION_STORE}. */
  store: Provider;
  /** Registrar globalmente para que el guard y los decoradores apliquen en toda la app. Por defecto `true`. */
  global?: boolean;
}

/**
 * Módulo dinámico de NestJS que integra el SSO en una app. Instancia {@link SsoCore} y
 * {@link SsoClient} a partir de la config y el store del cliente, registra
 * {@link SsoController} y {@link SsoAuthGuard}, y los exporta para inyección.
 */
@Module({})
export class SsoModule {
  static forRootAsync(opts: SsoModuleAsyncOptions): DynamicModule {
    return {
      module: SsoModule,
      global: opts.global ?? true,
      imports: opts.imports ?? [],
      controllers: [SsoController],
      providers: [
        opts.store,
        {
          provide: SSO_CONFIG,
          inject: opts.inject ?? [],
          useFactory: opts.useFactoryConfig,
        },
        {
          provide: SsoCore,
          inject: [SSO_CONFIG, SESSION_STORE],
          useFactory: (cfg: SsoConfig, store: SessionStore) =>
            new SsoCore(validateConfig(cfg), store),
        },
        {
          provide: SsoClient,
          inject: [SSO_CONFIG, SESSION_STORE],
          useFactory: (cfg: SsoConfig, store: SessionStore) => new SsoClient(cfg, store),
        },
        SsoAuthGuard,
      ],
      exports: [SsoCore, SsoClient, SsoAuthGuard],
    };
  }
}
