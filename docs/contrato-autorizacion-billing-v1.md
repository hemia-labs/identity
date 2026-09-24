# Contrato de autorización Billing v1

**Estado:** contexto efectivo de Access, verificación SDK y consumo de consola Billing implementados; publicación y concesiones iniciales implementadas; activación explícita por ambiente pendiente.  
**Fecha:** 2026-09-12.  
**Ámbito:** Access, SDK y consola de Billing.  
**Base:** [Propuesta Billing](propuesta-autorizacion-billing.md).  
**Catálogo verificable:** [billing-authorization-v1.json](contracts/billing-authorization-v1.json).

Este documento cierra las decisiones del paso 1. Es normativo para los cambios siguientes; no afirma que existan endpoints, tablas o tokens compatibles en los despliegues actuales. No modifica el contrato de Legal ni el protocolo OAuth de Identity.

## 1. Resultado del análisis de la propuesta

| Aspecto | Antes del paso 1 | Definición cerrada |
|---|---|---|
| Roles y permisos | Seis roles y 17 permisos explícitos | Catálogo JSON con la misma matriz, sin herencia ni comodines |
| Alcances | Tres nombres, sin matriz de compatibilidad por rol | Matriz de la sección 2 |
| Catálogo frente a datos de clientes | Lectura compartida sin regla exacta | Evaluación por dominio de recurso, sección 3 |
| Asignación | Entidades conceptuales | Campos, validación y precedencia, sección 4 |
| Contexto firmado | Lista conceptual de claims | Un único payload v1 y reglas de rechazo, sección 5 |
| Autoridad de asignación | Delegación propuesta | Reglas administrativas obligatorias, sección 6 |
| Versiones y publicación del catálogo | Versionado genérico | Responsables y corte coordinado, sección 7 |

## 2. Catálogo y alcances permitidos

El identificador técnico del sistema es `billing`; el destinatario del contexto es `billing-api`. El catálogo inicial completo tiene `contract_version: 1` y `catalog_version: 1`. Los códigos son sensibles a mayúsculas; no se normalizan ni se aceptan aliases.

| Rol | `catalog_global` | `all_customers` | `organizations` |
|---|:-:|:-:|:-:|
| `billing.viewer` | No | Sí | Sí |
| `billing.operator` | No | Sí | Sí |
| `billing.catalog_manager` | Sí | No | No |
| `billing.invoice_operator` | No | Sí | Sí |
| `billing.auditor` | No | Sí | Sí |
| `billing.integration_operator` | No | Sí | Sí |

El JSON contiene el mapa exacto rol–permisos y el dominio de cada permiso. Billing es dueño de ese mapa. Access solo registra códigos, descripción, estado, versiones y alcances permitidos para administrar asignaciones; no evalúa ni siembra las acciones operativas como permisos globales.

Ningún rol humano obtiene `billing.*`, `billing.console.access`, `billing.subscriptions.manage` o los permisos de integración de máquina por este contrato. La habilitación de consola requiere al menos una asignación válida y reconocida para Billing, además de identidad, organización, membership y producto activos.

## 3. Semántica de autorización

### 3.1 Alcances

- `catalog_global`: operaciones sobre el catálogo comercial compartido. No cubre datos de clientes.
- `all_customers`: datos de todas las organizaciones clientes presentes en Billing, incluyendo clientes que se incorporen posteriormente. No concede escritura de catálogo.
- `organizations`: datos pertenecientes exactamente a los UUID enumerados en la asignación. No se amplía al añadir clientes ni por parentesco organizacional.

`all_customers` describe recursos administrados por Billing; no depende de que una organización cliente tenga acceso a la consola interna. Una organización comercial suspendida puede conservar pagos y facturas que un operador autorizado necesita consultar.

### 3.2 Lectura del catálogo desde roles operativos

Los permisos `billing.catalog.*` pertenecen al dominio `catalog`; los demás pertenecen al dominio `customer_data`.

`billing.catalog.read`, cuando esté expresamente incluido en un rol operativo, permite leer el catálogo compartido aun si esa asignación está limitada a clientes concretos. Es una excepción explícita de lectura de catálogo: no cambia el alcance de las otras acciones ni concede `catalog.manage/publish`.

La administración del catálogo solo se autoriza con un rol que incluya el permiso requerido y una asignación `catalog_global`. No deducir permisos del alcance por sí solo.

### 3.3 Recursos de clientes

Para una acción sobre datos de clientes debe existir al menos una asignación vigente que incluya el permiso y cuyo alcance cubra la organización propietaria del recurso. Billing resuelve esa organización desde los datos confiables; no la toma como autoridad del body o query enviados por el usuario.

- Para listados, unir únicamente los destinos de las asignaciones que incluyen **esa acción** y filtrar en la consulta antes de paginar, contar o agregar.
- Para detalles y escrituras, comprobar el recurso por ID y su organización, además de su estado de negocio.
- Para add-ons, resolver la organización de su suscripción.
- Para artefactos de facturas, conservar el mismo límite al generar o recuperar acceso a XML/PDF.
- Para auditoría y webhooks, los registros sin una organización resoluble solo pueden ser visibles bajo `all_customers` con el permiso correspondiente. Los alcances restringidos los excluyen; no inventar una organización para permitir acceso.
- Un webhook con efectos en varias organizaciones requiere autorización sobre todas ellas. Si no puede determinarse el conjunto de efectos, una asignación restringida no autoriza el reintento.
- El dashboard calcula agregados sobre el conjunto autorizado; un rol restringido no recibe totales globales de clientes.

Ejemplo obligatorio: `viewer/all_customers` más `invoice_operator/organizations:[Acme]` no permite emitir una factura de otra organización. Tampoco concede lectura global de facturas: `viewer` no incluye ese permiso.

El frontend puede recibir la unión de permisos para navegación, pero esa unión nunca sustituye la evaluación de asignaciones y alcance en el backend. Una asignación desconocida, mal formada o incompatible no concede acceso.

## 4. Contrato de asignación

### 4.1 Entrada administrativa

La organización del operador y la membership destino se especifican en la ruta administrativa, cuya ubicación final se implementará en el paso 2. El body tiene una única forma:

```json
{
  "product_code": "billing",
  "role_code": "billing.invoice_operator",
  "catalog_version": 1,
  "scope": {
    "type": "organizations",
    "organization_ids": ["11111111-1111-4111-8111-111111111111"]
  },
  "valid_from": "2026-09-12T12:00:00Z",
  "expires_at": null
}
```

- UUID para membership, organizaciones y asignaciones; fechas UTC RFC 3339. `valid_from` y `expires_at` son obligatorios; `expires_at: null` declara duración indefinida, siempre revocable.
- Para `catalog_global` y `all_customers`, `scope` contiene solo `type`. Para `organizations`, `organization_ids` es obligatorio, no vacío y sin duplicados; todos los destinos deben existir en Access al asignar.
- Access valida la combinación rol–alcance contra la versión exacta del catálogo. El consumidor también la verifica.
- Si existe vencimiento, debe ser posterior a `valid_from`. La asignación solo autoriza cuando `valid_from <= ahora < expires_at`, o sin límite final cuando sea null.
- Rechazar campos desconocidos y tipos incorrectos; no aceptar `tenant_id`, `permissions`, `global_roles` ni actor proporcionado por el solicitante como parte de esta entrada.
- Actor y timestamps de auditoría se derivan server-side. Las asignaciones guardan `assignment_id`, estado `active|revoked`, `assignment_version` y trazabilidad de creación/revocación. Inicio futuro y expiración son condiciones derivadas de las fechas, no estados editables.
- Una membership puede tener varias asignaciones para el mismo rol con alcances/vigencias diferentes; no imponer unicidad solo por membership y rol. Rechazar duplicados exactos activos y usar idempotencia en la creación para reintentos concurrentes.
- Cambiar rol, alcance o vigencia requiere revocar y reemplazar atómicamente la asignación con una nueva. Incrementar la versión de contexto y registrar auditoría/outbox en la misma transacción. No conservar el alcance anterior como fallback.

### 4.2 Tamaño y límites operativos

No truncar destinos ni reemplazar una lista grande por `all_customers`. La implementación debe establecer límites explícitos y coherentes de destinos, asignaciones y tamaño de respuesta antes de habilitar la API, con rechazo completo si se exceden. Esos valores operativos se fijan mediante pruebas representativas, no modifican la semántica del contrato.

El contexto permanece server-side, nunca se guarda en cookies del navegador. No crear variantes de payload opacas o de consulta indirecta para resolver tamaños sin una decisión de contrato posterior.

## 5. Contexto firmado Access → SDK → Billing

Se conserva la API de resolución de Access, con un único contrato nuevo para Billing. La solicitud identifica `organization_id` y `product_code: billing`; el servidor deriva `aud: billing-api` del catálogo. Un destinatario solicitado incompatible se rechaza, no se utiliza para acuñar un contexto arbitrario.

La respuesta contiene `context_token`; los datos paralelos de presentación no son fuente de autorización. JWT firmado con `typ: hemia-context+jwt`, algoritmo `RS256` y `kid` de las claves publicadas por Access. Es un perfil interno de Hemia, no una declaración de conformidad como access token OAuth RFC 9068.

Payload ilustrativo, con todos los campos del contrato v1; las fechas representan un ejemplo y no un token utilizable:

```json
{
  "iss": "https://api-access.hemia.cloud",
  "aud": "billing-api",
  "sub": "ana-user-id",
  "identity_issuer": "https://api-id.hemia.cloud",
  "identity_reference_id": "22222222-2222-4222-8222-222222222222",
  "organization_id": "33333333-3333-4333-8333-333333333333",
  "membership_id": "44444444-4444-4444-8444-444444444444",
  "product_code": "billing",
  "contract_version": 1,
  "catalog_version": 1,
  "context_version": 12,
  "jti": "55555555-5555-4555-8555-555555555555",
  "iat": 1789214400,
  "nbf": 1789214400,
  "exp": 1789214700,
  "assignments": [
    {
      "assignment_id": "66666666-6666-4666-8666-666666666666",
      "assignment_version": 1,
      "role_code": "billing.invoice_operator",
      "scope": {
        "type": "organizations",
        "organization_ids": ["11111111-1111-4111-8111-111111111111"]
      },
      "valid_from": 1789214400,
      "expires_at": null
    }
  ]
}
```

Las fechas del JWT son segundos UNIX enteros, a diferencia de las fechas RFC 3339 de la API administrativa. Versiones son enteros positivos. Issuers se configuran por ambiente; no se aceptan desde la petición como fuentes arbitrarias de confianza.

### Emisión y validación

- Access emite solo asignaciones vigentes del sistema solicitado, después de validar identidad, elegibilidad interna, organización, membership, producto, catálogo y roles activos.
- Sin asignaciones válidas se deniega la resolución para consola; no se emite un contexto que habilite acceso por roles organizacionales.
- `sub` identifica al sujeto del `identity_issuer`, no a una identidad global independiente de su emisor. El SDK compara ambos con la sesión y verifica su referencia en Access.
- Requerir firma, algoritmo y tipo exactos, issuer confiable, audiencia escalar `billing-api`, campos obligatorios y ausencia de campos ajenos al contrato. No aceptar ID tokens ni los antiguos `global_roles`/`permissions` en sustitución de `assignments`.
- `exp` no supera `iat + 300` ni el vencimiento más próximo de las asignaciones incluidas. Access calcula la expiración efectiva antes de firmar.
- Los consumidores verifican vigencia de cada asignación y contexto. No usar tolerancia de reloj para ampliar expiraciones de autorización; sincronizar relojes y rechazar estados futuros incompatibles.
- El SDK renueva antes del vencimiento, con exclusión de refresh concurrente. No reutiliza contexto de otra organización cuando cambia la selección.
- Billing exige las versiones exactas de contrato y catálogo que implementa. Una versión incompatible se rechaza como conflicto de contrato, sin bajar a otra política.

### Frescura e invalidación

La vigencia máxima del JWT se fija en 300 segundos para v1; la reutilización de lectura en Billing se limita adicionalmente a 60 segundos (ADR-014). Con Access caído solo continúan lecturas con contexto no vencido ni invalidado. Antes de `catalog.publish`, `invoices.issue`, `invoices.cancel`, `checkout.verify`, `addons.create`, `addons.cancel` y `webhooks.retry`, resolver un contexto nuevo contra Access y evaluar la acción/recurso inmediatamente antes de ejecutar. Un fallo de revalidación bloquea la operación; no se utiliza el contexto anterior como alternativa para esa escritura.

Esto reduce la ventana de revocación, pero no crea una transacción distribuida entre Access y el proveedor de pago. Las transiciones de negocio requieren sus controles locales de concurrencia e idempotencia.

`context_version` debe aumentar ante cambios de autorización efectivos, incluidos asignaciones y elegibilidad, y no solo al cambiar roles organizacionales. Eventos dirigidos por membership/asignación invalidan antes del TTL; nunca reducen una versión ya observada. Expirar un contexto sigue bloqueando si Access está caído.

### Errores para consumidores

| Situación | Respuesta requerida |
|---|---|
| Sesión de identidad ausente/inválida | 401 |
| Asignación ausente/revocada, producto o membership no habilitados | 403 |
| Selección requerida o ya no disponible | 409 |
| Versión de contrato/catálogo incompatible | 409 con código específico; no redirigir indefinidamente al login |
| Entrada administrativa inválida | 400 |
| Duplicado exacto o conflicto de actualización | 409 |
| Access no disponible cuando se requiere emitir/renovar/revalidar | 503; operación bloqueada |

Errores de firma, issuer o audiencia deben bloquear y registrarse como fallo de validación, sin exponer tokens. El SDK no debe convertir indiscriminadamente todos los errores de Access en sesión expirada.

## 6. Contrato de administración de plataforma

Facultades administrativas nuevas de Access, separadas de los permisos operativos de Billing:

- `system_role_catalog.read`
- `system_role_catalog.manage`
- `system_role_assignment.read`
- `system_role_assignment.grant`
- `system_role_assignment.revoke`
- `system_role_delegation.manage`

Se comprueban como autoridad de **plataforma**, no por el conjunto genérico de permisos de una membership cliente. No agregarlas automáticamente a `organization_owner` al ampliar el catálogo global.

`platform_super_admin` es la autoridad excepcional. Un administrador delegado necesita facultad de grant/revoke más un límite administrado de sistemas, roles, organizaciones de empleados elegibles, alcances, destinos y vigencia que puede conceder. No basta el nombre del permiso.

- Una delegación para destinos concretos solo permite conceder un subconjunto de esos destinos; nunca `all_customers`.
- `catalog_global` es una facultad separada y no se infiere de administrar clientes.
- La vigencia concedida no excede la autoridad del delegador; no puede otorgar duración indefinida si su autoridad está limitada.
- Delegar administración no es una acción operativa de Billing. La administración cotidiana de asignaciones no permite modificar la propia delegación.
- En v1, solo `platform_super_admin` administra delegaciones. Los delegados conceden/revocan asignaciones dentro de sus límites, sin subdelegación ni autoasignación de roles internos.
- Si se revoca o expira una delegación, las asignaciones derivadas dejan de ser efectivas. Guardar su procedencia y propagar invalidación; la caducidad del administrador no puede dejar privilegios derivados indefinidos.

La organización de empleados tiene un atributo controlado de elegibilidad interna, separado de `products.audience` y de nombres/correos. Valor predeterminado: no elegible. Solo administración de plataforma puede alterarlo; no exponerlo a actualización organizacional genérica. Deshabilitarlo invalida la autorización de operadores de esa organización.

El esquema persistente, endpoints administrativos e índices se implementan en el paso 2 respetando estas reglas. Registrar toda concesión, intento denegado relevante, cambio de delegación y revocación con actor verificado y destino.

## 7. Versionado, publicación y fuente de verdad

El catálogo JSON adjunto es el artefacto de diseño v1. Durante la implementación se integra en el repositorio de Billing como definición bajo su control; no se mantienen dos copias editables. Access importa la proyección administrativa de una versión revisada mediante un proceso explícito de publicación, nunca desde un endpoint público del producto o una URL proporcionada por el usuario.

- `contract_version` cambia cuando cambia la estructura o semántica del contexto/API.
- `catalog_version` cambia cuando se modifica el mapa de permisos, roles o alcances admitidos. Nunca cambiar silenciosamente el significado de una versión publicada.
- Access conserva las versiones y asignaciones necesarias para auditoría, pero no las acepta como contratos alternativos de autenticación.
- Consumidores, catálogo y asignaciones se actualizan mediante corte coordinado. Invalidar/reautenticar sesiones incompatibles. No implementar aliases, fallback, dual-read ni claims de transición.
- Identity no emite roles u organizaciones. El perfil nuevo pertenece a Access y no implica modificar su separación de dominios.

## 8. Verificación del paso 1 y entregas siguientes

El paso 1 entrega este contrato y el catálogo de seis roles/17 permisos. Se comprueban coincidencia con la matriz, unicidad de códigos, permisos conocidos, alcances admitidos y casos de no combinación de privilegios.

No entrega aún: persistencia, migraciones, seeds, APIs administrativas, emisores/verificadores adaptados, filtros de recursos ni pruebas de carga. Esas implementaciones deben satisfacer este contrato y los criterios de producción de la propuesta.

La siguiente entrega es Access: modelo, elegibilidad interna, autoridad y delegación de asignaciones, integridad transaccional y pruebas contra escalación. Billing y el SDK se adaptan antes del corte. No ejecutar migraciones o seeds automáticamente ni habilitar compatibilidad legacy.


## Implementación del contexto efectivo — 2026-09-15

Access evalúa las asignaciones y su delegación original sin caché antes de firmar. Una delegación revocada, reemplazada o vencida, o un administrador suspendido/inactivo/vencido, excluye sus asignaciones del contexto. La expiración del JWT también queda limitada por la membresía destinataria, habilitación del producto, delegación y membresía administradora. No se transfieren referencias ni se concede acceso por roles organizacionales.

El SDK `@hemia/auth` 1.0.5 agrega `resolveSystemContext`, que resuelve y verifica el perfil firmado mediante RS256/JWKS, issuer, audiencia escalar y tipo exactos, preservando los estados 401/403/409/503. El issuer esperado es la URL base configurada de Access sin slash final. Billing integra el paquete local reproducible; no se ha publicado al registro.

Billing reutiliza contexto verificado para GET/HEAD por un máximo de 60 segundos, sin TTL deslizante y acotado por `iat + 60` y `exp`; toda mutación vuelve a resolver contra Access. Valida el payload exacto y las versiones, obtiene permisos del catálogo local y evalúa cada acción con sus propios destinos. Los listados filtran antes de paginar/contar; detalles y escrituras verifican el propietario almacenado. La unión de permisos se envía al frontend solo para navegación. Webhooks sin propiedad organizacional verificable se excluyen de alcances restringidos y no pueden reintentarse bajo ellos.

El catálogo operativo vive en [Billing](../../../billing/apps/api/src/modules/auth/billing-authorization-v1.json); el JSON adjunto a este documento queda como snapshot del diseño v1, no como una segunda fuente operativa editable. No se añadieron migraciones, seeds, asignaciones implícitas ni compatibilidad con los antiguos claims de permisos para Billing. El corte exige desplegar Access y Billing/SDK coordinadamente y publicar/conceder el catálogo por administración explícita.

Validación: pruebas del SDK con servidor JWKS local, pruebas de contrato/alcance Billing y emisor real con PostgreSQL 18.4 en Docker. Las APIs de publicación y concesiones iniciales están implementadas; su ejecución por ambiente, mediciones representativas y prueba de despliegue integral con servicios externos siguen pendientes.
