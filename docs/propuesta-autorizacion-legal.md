# Propuesta de catálogo de autorización de Legal v1

Estado: definición propuesta tras revisar código; **no publicada ni implementada**. No se ejecutaron migraciones/seeds ni se consultó la BD: el inventario corresponde al seed, guards, controladores y servicios actuales, no acredita asignaciones persistidas en ningún ambiente.

## Decisión

Access asigna roles de operador interno explícitos para Legal. Legal define sus permisos, evalúa recurso/alcance y usa `organization_id` sin tenant local. Separar tres superficies: consola interna, acciones personales de aceptación y acceso técnico de productos. Las páginas públicas siguen una política propia de documentos publicados y permitidos.

La matriz de permisos propuesta está documentada en este archivo; las combinaciones administrativas de scopes están en el [catálogo de Access](../../access/apps/api/src/modules/system-roles/legal-role-catalog.ts). No agregar fallback, aliases o doble fuente de autorización para mantener el modelo anterior.

## Inventario comprobado

El seed declara **4 roles y 27 permisos**:

| Rol actual | Concesión definida en el seed |
| --- | --- |
| `legal.admin` | Los 27 permisos. |
| `legal.viewer` | Los 8 permisos terminados en `.view`, incluidos aceptaciones, notificaciones y auditoría. |
| `legal.editor` | Los 8 de lectura más 11 de escritura: también evalúa pendientes, registra aceptaciones y gestiona notificaciones. |
| `legal.publisher` | Los 8 de lectura más publicación. |

Hallazgos que impiden trasladarlos sin cambios:

1. La configuración predeterminada convierte `organization_owner` y `organization_admin` en `legal.admin`. Contradice la asignación restringida de operadores internos acordada.
2. `LegalContextService` y `AccessEventsService` asignan `legal.viewer` cuando no encuentran un rol reconocido. El primer rol mapeado gana; no representa varias asignaciones con alcances independientes.
3. La selección y sincronización pueden cambiar `roleId` y reactivar la membresía local. Esta proyección no puede seguir siendo autoridad paralela ni sobrepasar una suspensión/revocación vigente.
4. `PermissionsGuard` permite comodines `*.*` y `prefijo.*`. El contrato nuevo debe usar permisos exactos del catálogo versionado.
5. `pending/evaluate` exige `actorType=service`, pero su controlador usa `LegalAuthGuard`, que construye un actor `user`. Con la ruta revisada no basta con asignar ese permiso a un editor/admin para poder ejecutarla. Requiere autenticación técnica separada.
6. `getAcceptance` solo permite al usuario consultar evidencia propia; `legal.acceptances.view` no significa hoy acceso operativo a evidencia de terceros. En cambio, exportación/auditoría y varios listados reciben filtros opcionales sin un alcance obligatorio derivado de la concesión.
7. `issuers` no contiene un tenant propietario y `listIssuers` parte de filtros vacíos. La mera existencia de `tenant_memberships` no prueba aislamiento de los recursos editoriales. Es obligatorio resolver el alcance de issuer/application antes de habilitar operadores limitados.
8. El seed agrega permisos con `ON CONFLICT DO NOTHING` pero no retira los anteriores. Cambiar el arreglo del seed no elimina privilegios obsoletos de BD.

## Roles de operador propuestos

| Rol | Propósito | Exclusiones relevantes |
| --- | --- | --- |
| `legal.viewer` | Consultar emisores, aplicaciones, documentos y versiones autorizados. | No evidencia personal, auditoría ni exportaciones. |
| `legal.editor` | Lectura editorial, alta/edición de documentos y borradores. | No publicar, gestionar emisores/aplicaciones, aceptar por terceros ni operar notificaciones. |
| `legal.publisher` | Revisar y publicar versiones; reintentar una publicación bajo el mismo permiso. | No editar borradores ni administrar asignaciones. |
| `legal.catalog_manager` | Gestionar estructura de emisores/aplicaciones y ciclo de vida de documentos. | No publicar ni consultar/exportar evidencia por este rol. |
| `legal.auditor` | Leer el catálogo y consultar/exportar evidencia y auditoría dentro del alcance autorizado. | No editar, publicar ni alterar evidencia. |
| `legal.notification_operator` | Consultar, reintentar y cancelar notificaciones dentro del alcance. | No publicar ni exportar evidencia. |

Se propone retirar `legal.admin`: sus responsabilidades se distribuyen en roles explícitos. No convertirlo automáticamente a la combinación de todos ellos. Si una persona necesita varias funciones, Access concede varias asignaciones, cada una con su alcance. Un `legal.catalog_manager` tampoco administra las asignaciones de Access.

Separar editor/publicador permite conceder funciones por separado; **no implementa por sí solo una aprobación por segunda persona**. Si se requiere impedir publicar el propio borrador, será una regla de transición adicional, no un permiso implícito.

## Matriz exacta de permisos de operador (25)

La tabla enumera permisos explícitos; los prefijos en prosa no son comodines ejecutables.

| Permiso | Roles que lo incluyen |
| --- | --- |
| `legal.issuers.view` | `viewer`, `editor`, `publisher`, `catalog_manager`, `auditor`, `notification_operator` |
| `legal.issuers.create` | `catalog_manager` |
| `legal.issuers.edit` | `catalog_manager` |
| `legal.issuers.archive` | `catalog_manager` |
| `legal.issuers.delete` | `catalog_manager` |
| `legal.applications.view` | `viewer`, `editor`, `publisher`, `catalog_manager`, `auditor`, `notification_operator` |
| `legal.applications.create` | `catalog_manager` |
| `legal.applications.edit` | `catalog_manager` |
| `legal.applications.archive` | `catalog_manager` |
| `legal.applications.delete` | `catalog_manager` |
| `legal.documents.view` | `viewer`, `editor`, `publisher`, `catalog_manager`, `auditor`, `notification_operator` |
| `legal.documents.create` | `editor` |
| `legal.documents.edit` | `editor` |
| `legal.documents.archive` | `catalog_manager` |
| `legal.documents.delete` | `catalog_manager` |
| `legal.versions.view` | `viewer`, `editor`, `publisher`, `catalog_manager`, `auditor`, `notification_operator` |
| `legal.versions.create` | `editor` |
| `legal.versions.edit` | `editor` |
| `legal.versions.publish` | `publisher` |
| `legal.acceptances.export` | `auditor` |
| `legal.acceptances.view` | `auditor` |
| `legal.notifications.view` | `notification_operator` |
| `legal.audit.view` | `auditor` |
| `legal.notifications.retry` | `notification_operator` |
| `legal.notifications.cancel` | `notification_operator` |

`archive` conserva las rutas actuales de archivo/restauración. `edit` comprende los cambios de estado que hoy usan ese permiso. `versions.publish` comprende publicar y reintentar publicaciones; no permite reescribir una versión publicada. `delete` nunca autoriza destruir versiones publicadas, aceptaciones o auditoría: deben comprobarse referencias/retención y estado del recurso en backend. Las comprobaciones pendientes son trabajo de implementación, no garantías ya demostradas por el seed.

## Capacidades personales y técnicas (fuera de los roles de operador)

| Capacidad propuesta | Actor y condiciones |
| --- | --- |
| `legal.self.pending.read` | Usuario autenticado; pendientes de su identidad/contexto, sin elegir otra persona en un DTO. |
| `legal.self.acceptances.read` | Usuario autenticado; evidencia propia y contexto validado. |
| `legal.self.acceptances.create` | Usuario autenticado; voluntad de aceptación, versión/regla vigentes e identidad del backend. Representación organizacional exige facultad verificable para esa organización. |
| `legal.pending.evaluate` | Servicio autenticado de un producto; audiencia, cliente y application autorizados, organización y membresía validadas en Access, sin tenant local. |

Las tres capacidades personales no son roles internos que Access deba asignar a todos los clientes. Su elegibilidad viene de la sesión, membresía/producto habilitado y reglas de aceptación. No se conceden por un fallback `legal.viewer`. Un rol de operador no confiere representación ni permite aceptar en nombre de otra persona.

Mantener las facultades de representación organizacional separadas de los roles de consola. El código actual revisa `rule.role` contra roles globales; al migrar debe especificarse ese contrato de representación sin reutilizar `legal.publisher` o `legal.auditor`.

Cambios de códigos: retirar `legal.pending.view` y `legal.acceptances.create` en favor de las capacidades personales. Retirar `legal.notifications.manage` y sustituirlo por `legal.notifications.retry`/`legal.notifications.cancel`. Conservar `legal.acceptances.view` para el auditor, separándolo de las rutas `/me`. Sin alias ni asignaciones automáticas. Resultado: **25 permisos de operador + 3 capacidades personales + 1 técnica**.

## Alcances y tenants: contrato requerido antes de publicar

Los destinos reales de la consola son **issuer y application**. Una organización de Access no equivale automáticamente a ninguno de ellos. No copiar `all_customers` de Billing ni interpretar un alcance omitido como global.

Propuesta de clases de alcance para Legal (aún requieren soporte explícito en Access):

- `legal_global`: todos los emisores/aplicaciones, concesión excepcional de plataforma.
- `issuers`: lista no vacía de emisores; cubre sus aplicaciones y documentos según sus relaciones verificadas.
- `applications`: lista no vacía de aplicaciones concretas; solo permite leer los datos mínimos de su emisor necesarios para operar, no editar ese emisor ni consultar sus aplicaciones hermanas.

Los seis roles admiten `legal_global`/`issuers`; `viewer`, `editor`, `publisher`, `auditor` y `notification_operator` pueden admitir `applications`. `catalog_manager` no admite `applications` para evitar atribuir administración del emisor desde una aplicación. Crear un issuer exige alcance global; crear una application exige autoridad sobre su issuer. Una petición que cambie de padre debe validar origen y destino.

La cobertura de evidencia/notificaciones queda definida en el [contrato de alcances v1](contrato-alcances-legal-v1.md): todas las organizaciones o conjunto explícito, siempre intersectado con issuer/application de la misma asignación. El publicador tiene autoridad editorial a nivel issuer/application; v1 no ofrece publicación limitada por cliente. El contrato está definido como propuesta, pendiente de soporte en Access y evaluación en Legal antes de publicar concesiones.

Legal opera sin `product_tenants`: `organization_id` es la frontera del consumidor y el provisioning se configura como `none`. Las filas históricas se conservan, sin usarse para autorizar. Separar siempre:

1. Organización de pertenencia del operador (Access).
2. Tenant operativo local de Legal.
3. Issuer/application sobre los que puede actuar.
4. Organización consumidora a la que se aplica una regla/aceptación.

La entrada personal deriva la organización consumidora de una membresía vigente en Access. La organización del empleado no debe convertirse automáticamente en destino de publicación/evidencia.

## Asignación y migración

- Operadores: membresía interna vigente; asignación inicial por plataforma. Delegación posterior solo con rol, alcance, destinatarios y vigencia contenidos, sin autoasignación/subdelegación.
- Access mantiene asignaciones, historial, versiones e invalidación; Legal mantiene catálogo ejecutable y evaluación por recurso.
- Reemplazar `LEGAL_ACCESS_ROLE_MAP` y el fallback de viewer por consumo de asignaciones de sistema con audiencia Legal y contrato versionado.
- No editar `tenant_memberships.roleId` desde dos autoridades. La proyección central no es una asignación local autónoma; cualquier retirada de columna/tabla requiere inventario y migración explícita posterior.
- No otorgar privilegios nuevos por inferir la equivalencia del rol antiguo. Auditar y conceder explícitamente, revocar lo anterior y retirar el modelo antiguo en un corte coordinado.
- Filtrar listados, opciones, conteos, detalle, exportación y operaciones de estado con el mismo alcance. Denegar recursos de otro issuer/application aunque se conozca el UUID.
- Catálogo local exacto y versionado: retirar permisos obsoletos en una migración explícita, nunca confiar en que un seed aditivo los elimine.

## Criterios para dar por implementado el catálogo

1. Las seis definiciones locales y el registro de Access coinciden con el manifiesto aprobado.
2. Sin rol explícito y administrador cliente: consola denegada; acciones personales autorizadas únicamente por su propia política.
3. Editor no publica; publicador no edita; viewer no exporta; auditor no acepta por terceros.
4. Lectura amplia + publicación limitada no produce publicación amplia. Cada permiso se evalúa unido al alcance de la misma asignación.
5. Aislamiento por issuer/application y cobertura explícita de evidencia por organización, incluidos filtros omitidos y UUID ajenos.
6. Servicio válido puede evaluar pendientes; usuario/editor no puede hacerse pasar por servicio.
7. Revocación/suspensión impiden operar y la sincronización no reactiva la concesión. No se modifica evidencia publicada para hacer pasar una prueba de permisos.

## Inventario de rutas administrativas actuales

Prefijo `v1/legal`; el guard común exige SSO de usuario. La tabla documenta el estado actual, no afirma que ya implemente el modelo propuesto.

| Ruta | Permiso actual |
| --- | --- |
| GET `issuers` | `legal.issuers.view` |
| GET `issuers/options` | `legal.issuers.view` |
| GET `issuers/:id` | `legal.issuers.view` |
| POST `issuers` | `legal.issuers.create` |
| PATCH `issuers/:id` | `legal.issuers.edit` |
| PATCH `issuers/:id/status` | `legal.issuers.edit` |
| POST `issuers/:id/unarchive` | `legal.issuers.archive` |
| POST `issuers/:id/archive` | `legal.issuers.archive` |
| DELETE `issuers/:id` | `legal.issuers.delete` |
| GET `applications` | `legal.applications.view` |
| POST `applications` | `legal.applications.create` |
| PATCH `applications/:id` | `legal.applications.edit` |
| PATCH `applications/:id/status` | `legal.applications.edit` |
| POST `applications/:id/archive` | `legal.applications.archive` |
| POST `applications/:id/unarchive` | `legal.applications.archive` |
| DELETE `applications/:id` | `legal.applications.delete` |
| GET `documents` | `legal.documents.view` |
| GET `documents/:id` | `legal.documents.view` |
| GET `document-types` | `legal.documents.view` |
| POST `documents` | `legal.documents.create` |
| PATCH `documents/:id` | `legal.documents.edit` |
| POST `documents/:id/archive` | `legal.documents.archive` |
| DELETE `documents/:id` | `legal.documents.delete` |
| GET `documents/:documentId/draft` | `legal.versions.view` |
| GET `documents/:documentId/versions` | `legal.versions.view` |
| GET `documents/:documentId/publications/:publicationId` | `legal.versions.view` |
| POST `documents/:documentId/publications/:publicationId/retry` | `legal.versions.publish` |
| POST `documents/:documentId/draft` | `legal.versions.create` |
| PATCH `documents/:documentId/draft` | `legal.versions.edit` |
| POST `documents/:documentId/draft/preview-publication` | `legal.versions.view` |
| POST `documents/:documentId/draft/publish` | `legal.versions.publish` |
| GET `me/pending` | `legal.pending.view` |
| GET `me/guard-check` | `legal.pending.view` |
| POST `pending/evaluate` | `legal.pending.evaluate` |
| POST `acceptances` | `legal.acceptances.create` |
| GET `acceptances/export` | `legal.acceptances.export` |
| GET `me/acceptances` | `legal.acceptances.view` |
| GET `acceptances/:id` | `legal.acceptances.view` |
| GET `notifications` | `legal.notifications.view` |
| POST `notifications/:notificationId/retry` | `legal.notifications.manage` |
| POST `notifications/:notificationId/cancel` | `legal.notifications.manage` |
| GET `audit-events` | `legal.audit.view` |

## Fuentes revisadas

- El seed anterior de roles/permisos locales fue retirado. El catálogo ejecutable es [legal-role-catalog.ts](../../../legal/apps/api/src/modules/legal/authorization/legal-role-catalog.ts).
- [Configuración y mapeo predeterminado](../../../legal/apps/api/src/config/sso.config.ts).
- [Resolución local](../../../legal/apps/api/src/modules/legal/services/legal-context.service.ts) y [sincronización por eventos](../../../legal/apps/api/src/modules/legal/services/access-events.service.ts).
- [Guard de permisos](../../../legal/apps/api/src/common/guards/permissions.guard.ts), [guard de identidad](../../../legal/apps/api/src/common/guards/legal-auth.guard.ts), [rutas](../../../legal/apps/api/src/modules/legal/controllers/legal.controller.ts) y [servicio](../../../legal/apps/api/src/modules/legal/services/legal.service.ts).
- Guías existentes de Hemia: `documentacion/04-systems/hemia-legal/security/` e `integrations/access-event-bus.md` (revisadas en el directorio de documentación). Exigen separación de consola/servicio, autorización por contexto y preservación de evidencia; el mapeo organizacional anterior debe alinearse con la decisión nueva.
- [Propuesta general](propuesta-autorizacion-sistemas-internos.md).

## Persistencia en Access

La persistencia de los dos alcances y destinos tipados está implementada en Access. La migración [AddLegalSystemScopes](../../access/apps/api/src/database/migrations/1790010000000-AddLegalSystemScopes.ts) conserva la representación e historia existentes de Billing; su contrato y límites están en [contrato de alcances](contrato-alcances-legal-v1.md).


Actualización 2026-09-20: la proyección administrativa de estos seis roles se implementó en Access (`legal-role-catalog.ts`). Sus permisos locales, sustitución de roles existentes y adopción del contexto nuevo por Legal siguen pendientes; no hay conversión automática de legal.admin ni publicación en el ambiente compartido.

## Consumidor implementado — 2026-09-21

Legal usa asignaciones explícitas firmadas, evalúa ambos alcances por concesión y filtra listados/exportaciones antes de paginar. Eliminados el fallback viewer y el mapeo organizacional en sesiones/eventos; sin escrituras automáticas de membresías. SDK 1.0.7: lecturas hasta 60 segundos y mutaciones frescas. Los permisos de notificación son retry/cancel separados. El catálogo no concede capacidades personales ni técnicas; sus entradas independientes están implementadas con tokens humanos y de servicio, scopes exactos y políticas explícitas por cliente. El traslado genérico entre padres queda prohibido. Auditoría excluye contexto no verificable y proyecta metadata editorial vacía. [Contrato y comandos de prueba](../../../legal/docs/legal/identity-access-contracts.md).

Validación: 71 pruebas unitarias y compilación; integración HTTP/PostgreSQL aislada con firmas reales y servicios de identidad de prueba. La suite funcional anterior mantiene 11 fallos preexistentes de publicaciones/aceptaciones/almacenamiento (16 casos pasan), por lo que no se declara cerrada toda la aceptación funcional ni el despliegue compartido.

### Actualización 2026-09-22: consumidores sin tenant local

Legal separa consola, accesos personales y evaluación técnica. No crea ni consulta tenants locales para autorizar; Access confirma organización, membresía, habilitación y roles organizacionales vigentes. Estos roles solo evalúan reglas de representación, nunca conceden roles internos. La migración preparada cambia Legal a `provisioning_mode: none`; las nuevas aceptaciones se identifican por identidad/organización/versión/regla. Historia antigua preservada y validada, sin fallback ni compatibilidad. Ver [contrato implementado y despliegue](../../../legal/docs/legal/personal-service-authorization.md). Pruebas aisladas verificadas; registros de clientes y migraciones compartidas pendientes. HORUS sigue TODO.

Estado de activación en desarrollo: [migraciones, clientes y pruebas reales del 2026-09-22](activacion-legal-desarrollo-2026-09-22.md). Este registro sustituye las notas anteriores que indicaban migraciones y catálogo compartidos pendientes; conserva los pendientes de asignaciones, aceptación documental y credencial del evaluador técnico.

Aceptación conectada completada el 2026-09-22: login/callback/selección por HTTP, publicación en almacenamiento real, aceptación por consumidor sin roles internos, aislamiento del auditor y revocación. Se retiraron los accesos temporales y se conservó evidencia. Ver [resultados](activacion-legal-desarrollo-2026-09-22.md#cierre-de-aceptación-conectada--2026-09-22). La inspección visual del frontend no forma parte de esa certificación.
