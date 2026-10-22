# API de máquina de @hemia/auth

`MachineClient` es una API server-side para OAuth client_credentials, independiente
de `SsoConfig`, login humano, cookies, MFA y `SessionStore`. Se incorpora al core
de @hemia/auth; no crea otro paquete ni añade dependencias.

El código está preparado para la próxima versión mediante Changesets. No está
publicado en npm y no debe presumirse disponible en los consumidores instalados
con @hemia/auth 1.0.8. Esta entrega no cambia credenciales, políticas ni servicios
desplegados.

## Comparación con el SsoClient anterior

| Requisito     | SsoClient anterior                                       | MachineClient                                                                                                             |
| ------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Configuración | SsoConfig, credenciales con fallback al cliente de login | Emisor, tokenUrl, credenciales de máquina y destinos explícitos                                                           |
| Caché         | Clave fija en SessionStore                               | En memoria por instancia/proceso; clave por emisor, tokenUrl, cliente, API base, audiencia/resource y scopes normalizados |
| Concurrencia  | Sin emisión compartida                                   | Una emisión en curso por clave, también durante renovación                                                                |
| Expiración    | TTL mínimo 30 s que podía superar un token corto         | Descuento de transporte y margen de 30 s; no cachea tokens cortos ni acepta tokens vencidos                               |
| Scopes        | No comprueba el scope de la respuesta                    | Solicitud limitada al destino; respuesta exige el conjunto exacto                                                         |
| HTTP          | Resuelve URL y usa redirect por defecto                  | Origen y ruta base restringidos; redirect=error y credentials=omit                                                        |
| Timeouts      | No estaban acotados en SsoClient                         | Emisión y API tienen presupuestos independientes                                                                          |
| Errores       | Error genérico / UnauthorizedError                       | MachineClientError con stage y status opcional, sin detalles del proveedor                                                |

SsoClient conserva su constructor público y su respuesta JSON, pero delega tokens
y transporte en MachineClient. Su parámetro store sigue aceptado; ya no guarda
tokens máquina en Redis. Conserva el fallback de credenciales de su configuración
histórica; la API nueva exige sus propias credenciales y no ofrece ese fallback.
Una app que usaba URLs fuera de su apiBaseUrl debe registrar un destino explícito
y utilizar MachineClient, no eludir la restricción de transporte.

## Uso sin login humano

```ts
import { MachineClient, MachineClientError } from "@hemia/auth";

const billing = new MachineClient({
  issuer: "https://identity.example.com",
  tokenUrl: "https://identity.example.com/oauth/token",
  clientId: "producto-billing-service",
  clientSecret: secretFromServerConfiguration,
  tokenTimeoutMs: 5000,
  requestTimeoutMs: 5000,
  destinations: {
    billing: {
      baseUrl: "https://billing.example.com/api/v1",
      audience: "billing-api",
      scopes: [
        "billing.integration.catalog.read",
        "billing.integration.checkout.create",
        "billing.integration.checkout.read",
        "billing.integration.licenses.read",
      ],
    },
  },
});

const response = await billing.request(
  "billing",
  "billing/integrations/v1/catalog/products/balanz_cfdi/plans",
  { scopes: ["billing.integration.catalog.read"] },
);
if (!response.ok) {
  // El dominio conserva aquí su política de HTTP y recuperación.
  throw new Error("Billing catalog unavailable");
}
const payload: unknown = await response.json();
// Validar el contrato de catálogo antes de usar payload.
```

También se puede usar `getAccessToken('billing', scopes)` si una integración ya
tiene un transporte HTTP con sus restricciones. Esa llamada no valida ni limita
el destino de una petición que el consumidor haga por fuera de `request`.
Para retirar código de transporte duplicado, usar request y conservar las
validaciones y excepciones de dominio en el consumidor.

Configurar destinos desde valores confiables del backend, nunca desde el body,
query o URLs enviadas por el navegador. Request sólo admite el origen y el path
base registrado; normaliza la base a una ruta terminada en slash. En una base
`/api/v1`, pasar rutas relativas como `billing/integrations/v1/...`, no `/billing/...`.
Rechaza URLs con credenciales/fragmentos y rutas con separadores o percent
doblemente codificados. No sigue redirecciones, aunque el caller intente activarlas.
Elimina Cookie y sustituye Authorization por el token de servicio.

## Audiencia fija y serviceDestinations

- Para un cliente OAuth con una audiencia fija, `audience` debe coincidir con la
  registrada. Puede omitirse para conservar un contrato existente que ya obtiene
  la audiencia del registro del cliente.
- Para serviceDestinations, enviar `resource` y/o `audience` que seleccionen un
  destino autorizado en Identity. Si ambos están configurados deben corresponder
  al mismo destino; Identity lo comprueba.
- Resource es la URI registrada, no el endpoint concreto. MachineClient exige que
  su origen corresponda al de baseUrl. El tokenUrl debe pertenecer al emisor configurado.
- Los scopes permitidos son literales; no expande comodines ni concede derechos.
  Puede solicitar un subconjunto mediante init.scopes o getAccessToken. Si se
  omiten scopes se solicitan todos los configurados para ese destino.

Legal puede reutilizar su cliente de máquina por ambiente con destinos distintos:

```ts
const legalService = new MachineClient({
  issuer: "https://identity.example.com",
  tokenUrl: "https://identity.example.com/oauth/token",
  clientId: "legal-service",
  clientSecret: legalServiceSecret,
  destinations: {
    identity: {
      baseUrl: "https://identity.example.com",
      resource: "https://identity.example.com",
      audience: "identity-api",
      scopes: ["identity.oauth_clients.read", "identity.tokens.introspect"],
    },
    balanz: {
      baseUrl: "https://api.balanz.example.com",
      resource: "https://api.balanz.example.com",
      audience: "balanz-api",
      scopes: ["legal.consumer_context.read"],
    },
  },
});
```

## Vida del token, tiempos y fallos

- Caché y single-flight son por instancia/proceso. Construir una instancia duradera
  por configuración; no crearla en cada request. Dos procesos pueden emitir dos
  tokens: no es una cola ni un lock distribuido de pagos.
- La configuración se copia al construir el cliente. Para rotar credenciales o
  destinos, recrearlo; no mutar una configuración esperando invalidar el caché.
- La respuesta OAuth requiere Bearer, expires_in entero entre 1 y 600 y scopes
  exactos. Un token corto puede devolverse si sigue vigente, pero no se cachea
  durante su margen de renovación. Una respuesta lenta no prolonga su vigencia.
- La caché no contiene respuestas fallidas. Una emisión fallida libera su promesa
  compartida y la siguiente llamada explícita puede intentarlo otra vez.
- Timeouts por defecto: 5000 ms cada uno; rango 1–30000 ms. Son presupuestos por
  etapa, no un deadline total. El transporte de API acepta signal del consumidor.
  Cancelar un consumidor no cancela la emisión compartida; tras recibir el token
  se comprueba de nuevo la cancelación antes de enviar su petición.
- ConfigError identifica configuración/destino/scopes inválidos. MachineClientError
  tiene stage token/request y status opcional para una respuesta OAuth rechazada.
  No conserva cuerpo, URL, secretos, tokens, cause ni detalles de red.
- Request devuelve Response incluso con HTTP 4xx/5xx. No trata HTTP 2xx como
  autorización comercial, no invalida una aceptación legal ni concede licencia.
  Las decisiones y validación JSON pertenecen al cliente de dominio.
- No hay reintentos automáticos de GET, POST ni emisión. Un POST de aceptación o
  checkout debe recuperar su clave/idempotencia mediante la lógica del dominio.
- HTTPS es obligatorio. `allowHttpLoopback: true` sólo permite localhost/127.0.0.1/
  ::1 en desarrollo; NODE_ENV=production lo rechaza siempre.

El cliente confía en la respuesta del endpoint OAuth configurado y protegido por
TLS. No es un verificador de JWT entrantes: Billing, Legal y los callbacks conservan
su verificación/introspección y sus políticas de cliente, producto y organización.

## Adopción de consumidores existentes

1. Publicar una release de @hemia/auth que incluya esta API por el proceso existente
   de Changesets. Esta tarea no ejecuta versionado ni publicación.
2. Billing y Legal ya declaran @hemia/auth; actualizar a esa release antes de
   reemplazar sus bloques OAuth. Mantener los mapeos de excepciones, validación de
   evidencia y recuperación de checkout. No importar una API que su 1.0.8 instalada
   todavía no exporta.
3. Balanz no declara @hemia/auth. Su incorporación necesita aprobación explícita
   de dependencia conforme al AGENTS de Balanz; hasta entonces conserva su código.
4. Comparar productores y consumidores con las pruebas de contrato y la guía de
   alta. No retirar checks de dominio al cambiar el cliente de transporte.

Specora no está expuesto como herramienta en esta sesión. Se contrastó con código
vigente, documentos locales de tokens/destinos y los contratos de Balanz/Billing/
Legal; la documentación canónica del propietario debe sincronizarse antes de release.

## Verificación

En packages/auth: `bun run test`, `bun run typecheck`, `bun run build` y
`bun run test:built`. Las pruebas nuevas cubren expiración, transporte lento,
scopes, aislamiento, concurrencia, renovación, timeout, cancelación y destinos.
Las peticiones OAuth/API se simulan; pruebas anteriores usan servidores locales
de fixture y pueden necesitar permiso de escucha. No se llaman servicios reales.
