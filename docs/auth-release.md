# Publicación de `@hemia/auth`

El workflow [Auth releases](../.github/workflows/release-auth.yml) se ejecuta al hacer push a `develop` en `hemia-labs/identity`.

1. Un PR de código que cambia el paquete incluye un changeset (`bun run changeset`). Después del merge, Changesets crea o actualiza un PR con la nueva versión, `CHANGELOG.md` y `bun.lock`. El changeset vacío de 1.0.8 no genera otro incremento.
2. El PR de versiones pasa [Auth package validation](../.github/workflows/package-auth.yml) y requiere revisión antes del merge. El workflow de release solo acepta un merge que cambie `packages/auth/package.json`, `packages/auth/CHANGELOG.md`, `bun.lock` y los changesets consumidos.
3. Ese merge ejecuta typecheck, tests, build, prueba del adaptador NestJS y una instalación limpia del tarball. El job de publicación descarga **ese mismo tarball**, comprueba su SHA-512 y el registro npm, y omite una versión ya publicada con contenido idéntico. Rechaza contenido diferente o una versión anterior a `latest`.

## Configuración necesaria antes de publicar

- En GitHub, permitir que Actions cree pull requests. Si los checks del PR creado por `GITHUB_TOKEN` requieren aprobación manual, configurar opcionalmente una GitHub App con `RELEASE_APP_CLIENT_ID` y `RELEASE_APP_PRIVATE_KEY` para crearlo.
- Proteger `develop` con revisión obligatoria y el check `Auth package` requerido antes del merge del PR de versiones.
- Crear el environment `npm` en GitHub. Configurar en npmjs.com el Trusted Publisher de `@hemia/auth` con organización `hemia-labs`, repositorio `identity`, workflow **`release-auth.yml`**, environment **`npm`** y permiso de `npm publish` directo.
- Cuando el Trusted Publisher y los checks estén listos, fijar la variable de repositorio `ENABLE_NPM_PUBLISH=true`. Antes de eso, el job de validación funciona, pero el de publicación no se ejecuta. No se necesita `NPM_TOKEN` de escritura.

## Primera publicación: 1.0.8

La versión 1.0.8 ya está fijada en el PR inicial; ese PR también cambia código, así que su merge no es un release. Cuando npm Trusted Publishing y la variable de publicación estén configurados, abrir un PR separado contra `develop` que **solo** agregue `.changeset/bootstrap-auth-1.0.8.json` con este contenido:

```json
{"name":"@hemia/auth","version":"1.0.8"}
```

Tras revisar y fusionar ese PR, se valida y publica la 1.0.8 mediante el mismo workflow. El registro npm conserva el control final: si la 1.0.8 ya existe con distinto tarball, el job falla sin sobrescribirla.
