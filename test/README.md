# Pruebas de Identity

Todas las pruebas viven en `identity/test/`; no agregar pruebas a `src/`, a los módulos ni a `scripts/`.

## Estructura

- `backend/unit/`: pruebas Jest por módulo y pruebas de guards compartidos.
- `backend/e2e/`: pruebas E2E de Nest, con configuración `backend/jest-e2e.json`.
- `auth/unit/`: pruebas Bun del core y del adaptador SvelteKit del SDK.
- `auth/package/`: comprobaciones del build NestJS/CJS/ESM y del tarball del SDK.
- `frontend/`: pruebas Vue con Vitest y jsdom.
- `release/`: pruebas Node de clasificación y preflight de releases; no publican paquetes.

## Ejecución

Desde la raíz `identity/`:

```sh
bun run test
bun run test:package
bun run test:tarball
```

`test` ejecuta las suites unitarias de backend, SDK y frontend, más las pruebas de release, una vez y sin modo watch. `test:package` compila el SDK y comprueba sus exports CJS/ESM. `test:tarball` necesita el SDK compilado y acceso a npm para instalar dependencias en un consumidor temporal; no publica ni guarda tarballs en vendor.

Desde `backend/`, `bun run test --runInBand` ejecuta las unitarias y `bun run test:typecheck` comprueba los tipos de las pruebas. `bun run test:e2e` es manual: monta AppModule y requiere servicios y configuración explícitos. No forma parte de la suite unitaria; usar un entorno aislado, nunca la base de producción. No ejecutar migraciones ni seeds automáticamente para prepararlo.

Desde `packages/auth/`, usar `bun run test`, `bun run typecheck`, `bun run build` y `bun run test:built`.

Desde `frontend/`, `bun run test --run` ejecuta las pruebas una vez y `bun run test:unit` permite modo watch. La configuración Vitest y de tipos incluye únicamente `test/frontend/`.

## Organización del código

Auth agrupa Google en `backend/src/modules/auth/google/` y los DTOs de contraseñas en `auth/dtos/password/`. Los módulos pequeños conservan su controller/service principal y sus carpetas existentes de DTOs y entidades.

El SDK agrupa sus clientes en `packages/auth/src/core/clients/` y su lógica de sesión, store y caché de contexto en `core/session/`. Las entradas públicas del paquete y la identidad de los tokens DI siguen siendo las mismas.

## Seed de clientes OAuth

Desde `backend/`, `bun run test:seed:docker` compila y crea un PostgreSQL desechable. Ejecuta explícitamente las migraciones y el seed tres veces: conserva `docs` y `helpdesk`, no recrea los clientes retirados, mantiene los ocho scopes de `legal` y comprueba que no cambian usuarios, contraseñas, clientes, secretos, configuración, estados, timestamps ni claves JWKS, incluso con datos personalizados y sin secretos de bootstrap. El runner no carga `.env` ni toca la base configurada; elimina su contenedor y volumen al terminar.
