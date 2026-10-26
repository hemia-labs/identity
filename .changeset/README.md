# Changesets de Identity

La aplicacion privada `backend` + `frontend` comparte version; `@hemia/auth`
conserva su version y publicacion npm independiente.

- Aplicacion: agregar `bun run changeset` dirigido a `backend` o `frontend`.
  El merge a `main` crea/actualiza la PR de version. Fusionar esa PR genera
  tag `identity-vX.Y.Z`, Release e imagenes; despliega si
  `prod.ENABLE_IDENTITY_DEPLOY=true`. Rollback y migraciones son manuales.
- SDK: agregar un changeset dirigido a `@hemia/auth`. El flujo de `main`
  mantiene la PR de version y publicacion npm con environment `npm` y
  `ENABLE_NPM_PUBLISH=true`; genera tag y Release `@hemia/auth@X.Y.Z`
  con las notas de su changelog. La PR usa `changeset-release/auth` para no
  mezclarse con la PR de version de la aplicacion.

Usar archivos changeset separados para SDK y aplicacion, incluso en una PR que
cambie ambos. Los scripts de version ignoran el otro destino para conservar sus
notas pendientes. No ejecutar `changeset version` directamente para publicar:
las PR automaticas usan `version:identity` o `version:auth`, que tambien actualizan
las versiones del lockfile sin recalcular dependencias.

Ver [CI/CD de Identity](../../../../obsidian-hemia-kb/11-reviews/pending/identity/operations/identity-ci-cd.md) para requisitos de GitHub,
Tailscale y servidor. Nunca incluir secretos en un changeset.
