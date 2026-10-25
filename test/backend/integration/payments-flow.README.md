# Flujo de pagos entre repositorios

Desde `identity/`, con Docker activo y los API de Identity, Console, Legal, Billing y Balanz compilados:

```sh
bash test/backend/integration/payments-flow.docker.sh
```

Los repositorios `identity-access`, `console`, `legal`, `billing` y `balanz` deben ser hermanos. También deben estar construidos `@hemia/auth` y `@hemia/payments` e instalados sus paquetes en Balanz. La prueba no instala dependencias ni compila proyectos implícitamente.

El script crea PostgreSQL 18.4 y Redis 8 en puertos dinámicos de loopback, cuatro bases vacías y credenciales temporales. Redis verifica la serialización real de cambios del catálogo. Ejecuta las migraciones explícitamente y elimina los contenedores y sus volúmenes al terminar. Nunca lee archivos `.env` ni usa bases/credenciales residentes.

La prueba usa las clases reales de OAuth de Identity (secret hash, firma RSA, emisión, introspección, destinos y persistencia), la coordinación de Console, los guards y servicios de Legal/Billing, el SDK instalado en Balanz, su contexto de contratación y su receptor de licencias. Los adaptadores HTTP proporcionan el request/context de Nest; no se arranca la aplicación completa ni se prueba el login del navegador. Balanz ejecuta las migraciones reales necesarias para autenticación/autorización y facturación. Los demás ejecutan todas las migraciones compiladas.

Los documentos publicados son fixtures persistidos y usan el almacenamiento de prueba de Legal. PayPal es un proveedor determinista explícito; no se realizan cobros ni peticiones a PayPal. El evento de activación atraviesa el procesador real de Billing y la entrega usa OAuth y HTTP reales entre los servicios locales.

Cobertura esperada: capacidad arbitraria de reportes sin llamadas a Billing, catálogo de pagos sin Legal/organizaciones/retornos, licencias sin Legal, reutilización del único cliente del backend, preset completo de pagos, preparación de sistema sin clientes, activación y repetición idempotente, una sola credencial del consumidor con varias funciones, permisos específicos por audiencia, claims de Identity sin organización/roles, aceptación jurídica con reintento, catálogo/checkout/licencia mediante SDK, rechazo de otros usuarios/organizaciones, fallo y reintento de entrega, actualización del acceso en Balanz, permisos compartidos preservados hasta desactivar el último sistema, retirada de permisos entrantes y salientes, reactivación desde destinos vacíos y desactivación con cliente suspendido. La introspección del consumidor se concede por las funciones declaradas receiver o collector, sin permiso inicial oculto. Balanz usa el PaymentsModule real de Nest para licencias y callbacks; la sesión de usuario de prueba atraviesa sus guards reales. El tiempo impreso mide solicitudes del backend; no demuestra por sí solo el objetivo de cinco minutos de uso humano.

Para una revisión manual del frontend sobre el mismo backend aislado:

```sh
PAYMENTS_FLOW_KEEP_SERVERS=1 bash test/backend/integration/payments-flow.docker.sh
```

Esta variante prepara sistemas nuevos para el preset de pagos, reportes, catálogo y licencias, y mantiene los servicios vivos. El login abre el mismo asistente genérico con preset=payments; quitar el parámetro permite seleccionar otras funciones. Imprime `UI_FIXTURE_READY` con la URL del API temporal, `/auth/login`, selección sugerida y URLs de retorno (sin secretos). Iniciar Console web con `NEXT_PUBLIC_CONSOLE_API_BASE_URL` apuntando a esa URL. El origen permitido es `http://localhost:5176`; puede cambiarse mediante `PAYMENTS_FLOW_UI_ORIGIN`.

El login de esta variante asigna una cookie de sesión opaca `HttpOnly` para un operador ficticio. Solo sustituye el login/autoridad humana de Console para evaluar el formulario. Las llamadas administrativas y la activación usan las clases y OAuth reales. No demuestra SSO real. Detener con Ctrl+C elimina los contenedores; no dejar este servidor de prueba publicado.
