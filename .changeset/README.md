# Changesets de Identity

`@hemia/auth` es el paquete público de este workspace. Las apps `backend` y `frontend` son privadas. Los PR de código o API pública del paquete deben incluir un changeset generado con `bun run changeset` y dirigido a `@hemia/auth`, con impacto `patch`, `minor` o `major` según SemVer. Los cambios solo de tests o de documentación fuera del paquete pueden usar `bun run changeset --empty` si CI requiere una entrada.

La versión 1.0.8 de la rama de preparación ya se fijó antes de instalar Changesets. Su changeset vacío registra ese punto de partida sin pedir otra subida de versión. Para versiones posteriores, `bun run changeset version` actualizará versión y changelog en un PR de versión revisado; el workflow `release-auth.yml` publica únicamente tras fusionar un PR exclusivo de versión, validar el tarball y habilitar `ENABLE_NPM_PUBLISH=true`.

El estado local de preparación es 1.0.9. El changeset `auth-machine-client.md` solicita minor y producirá 1.1.0 con MachineClient; no subas manualmente otra vez esa versión. Payments debe publicarse después de esa release. La publicación requiere el environment `npm`, Trusted Publisher `hemia-labs/identity` + `release-auth.yml` + environment `npm` y la variable `ENABLE_NPM_PUBLISH`. Los ajustes remotos no se verificaron en esta preparación.
