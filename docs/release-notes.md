Identity: despliegue Docker con backend y frontend versionados juntos.

- PostgreSQL y cloudflared son externos.
- Migraciones manuales: revisar las incluidas en `release.json`, validar backup y
  ejecutar la operacion `migrate` antes de `deploy` cuando haya pendientes.
- Base nueva: inicializar seeds manualmente; el CI no ejecuta seeds.
- Rollback de imagenes no revierte el esquema ni restaura datos.

Los cambios funcionales se generan desde Changesets y ambos changelogs.
Actualizar estas notas en la PR funcional cuando cambien la compatibilidad de
base de datos o las instrucciones de actualizacion.
