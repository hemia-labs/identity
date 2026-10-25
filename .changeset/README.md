# Changesets de Identity

La aplicacion privada `backend` + `frontend` comparte version; `@hemia/auth`
conserva su version y publicacion npm independiente.

- Aplicacion: agregar `bun run changeset` dirigido a `backend` o `frontend`.
  El merge a `main` crea/actualiza la PR de version. Fusionar esa PR genera
  tag `identity-vX.Y.Z`, Release e imagenes; despliega si
  `prod.ENABLE_IDENTITY_DEPLOY=true`. Rollback y migraciones son manuales.
- SDK: agregar un changeset dirigido a `@hemia/auth`. El flujo de `develop`
  mantiene la PR de version y publicacion npm con environment `npm` y
  `ENABLE_NPM_PUBLISH=true`.

Usar archivos changeset separados para SDK y aplicacion, incluso en una PR que
cambie ambos. Los scripts de version ignoran el otro destino para conservar sus
notas pendientes. No ejecutar `changeset version` directamente para publicar:
las PR automaticas usan `version:identity` o `version:auth`, que tambien actualizan
las versiones del lockfile sin recalcular dependencias.

Ver [CI/CD de Identity](../docs/identity-ci-cd.md) para requisitos de GitHub,
Tailscale y servidor. Nunca incluir secretos en un changeset.
