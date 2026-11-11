# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Jugadores de torneos MTT, hispanohablantes, que juegan sesiones online o en vivo y registran sus eliminaciones en su propio equipo. El usuario principal es una sola persona: la que juega, registra y revisa. No hay cuentas, equipos ni roles.

La situación de uso es concreta: después de una mano o una sesión, el jugador quiere capturar el contexto mientras está fresco; antes de seguir jugando, quiere revisar patrones y convertir lo aprendido en una regla. No hay investigación de usuarios, testimonios ni métricas que confirmen otras audiencias; no deben inventarse.

## Product Purpose

River Notes es una bitácora local de eliminaciones MTT que conserva el contexto de cada mano y obliga a una revisión periódica antes de seguir registrando. Existe para que el jugador no acumule manos sin aprender: cada entrada completa alimenta un bloque de revisión; cada bloque cerrado produce tres conclusiones y queda visible para siempre.

El éxito es que el jugador pueda reconstruir qué pasó, detectar patrones y llegar a la siguiente sesión con una regla concreta. No es un solver, un HUD, un analizador automático ni una red social.

## Positioning

Un diario de aprendizaje local y con fricción deliberada: la revisión es obligatoria, el historial es permanente y completo, y los datos no salen del equipo.

Lo que un producto vecino no podría copiar sin traicionar su modelo: no hay nube, cuentas, telemetría ni análisis automático; la aplicación no decide por el jugador, solo le devuelve su propio contexto y sus conclusiones.

## Operating Context

- Se usa en un navegador local en `http://127.0.0.1:3000`, sobre Windows, macOS o Linux con Node.js; no se expone a la red.
- Flujo principal: registrar una eliminación en dos pasos (datos y cartas; tres reflexiones), guardar borradores, completar entradas, revisar bloques de cinco entradas o ciclos de siete días, cerrar la revisión y consultar el historial.
- El historial es el archivo de aprendizaje: entradas, borradores, bloques cerrados, calendario de actividad y exportaciones.
- El jugador puede guardar el progreso del formulario activo, crear `backup-latest.json`, descargar copias JSON o SQLite y restaurarlas.
- Los datos viven en SQLite local; la aplicación no necesita Internet para funcionar.
- El idioma de toda la interfaz, los mensajes y la documentación es español.

## Capabilities and Constraints

Capacidades confirmadas:

- Alta, edición y borrado de entradas; borradores; numeración permanente.
- Selector visual de 52 cartas con destinos Héroe, Villano, Flop, Turn y River siempre activables; auto-avance; `Desconocida`; `Terminó Preflop`; baraja de cuatro colores.
- Revisión obligatoria por cinco entradas completadas o siete días; bloqueo de finalización mientras hay una revisión pendiente; los borradores siguen permitidos.
- Cierre de revisión con tres conclusiones; archivo permanente de bloques con todas sus manos.
- Historial completo por defecto con pestañas `Todas`, `Pendientes de Revisión`, `Revisadas` y `Borradores`; búsqueda, filtros combinables y calendario mensual tipo mapa de calor con filtro por día.
- Guardado de progreso con checkpoint WAL y `backup-latest.json`; descarga y restauración de copias JSON o SQLite.
- Exportación Markdown, JSON y SQLite; formato canónico por entrada.
- Autosanación al arrancar y antes de evaluar revisiones: lotes vacíos o incompletos, marcas huérfanas y filas corruptas no bloquean la aplicación.
- API local en Express; esquema SQLite con WAL y claves foráneas.

Restricciones no negociables:

- El historial nunca oculta `DRAFT`, `COMPLETED - Pendiente` ni `COMPLETED - Revisada`; los bloques cerrados tampoco se ocultan.
- Una revisión con `checks.length === 0` nunca bloquea.
- Los ocho valores de la baraja de cuatro colores son fuente de verdad: picas `#18181b` y `#3f3f46`, corazones `#dc2626` y `#ef4444`, diamantes `#2563eb` y `#3b82f6`, tréboles `#16a34a` y `#22c55e`.
- Las entradas vinculadas a un bloque cerrado no se pueden eliminar.
- No hay cuentas, nube, telemetría, análisis automático ni envío de datos a terceros.
- La aplicación escucha solo en `127.0.0.1`; no está pensada para publicarse en Internet.
- Los datos son personales; las copias de seguridad deben tratarse como tales.
- El idioma de la interfaz y los mensajes es español.

Decisiones abiertas:

- No hay métricas de producto, investigación de usuarios, testimonios ni objetivos cuantitativos confirmados.
- No hay una versión nativa iOS o Android; la plataforma es web.
- No hay multiusuario, sincronización ni colaboración.
- No se ha definido una identidad visual nueva; el sistema visual existente se documenta en `DESIGN.md`.
- No se ha definido una estrategia de marketing, precios ni licencia.

## Brand Commitments

- Nombre: **River Notes**.
- Voz: español directo, sobrio y reflexivo; tuteo; terminología de poker precisa; sin promesas de ganancias ni consejos financieros.
- Identidad existente: sala de poker nocturna, verde profundo, cartas y textura de fieltro; el lema visible es «Tu juego, en perspectiva».
- La baraja de cuatro colores y el tema oscuro verde son compromisos visuales existentes que el rediseño debe preservar salvo instrucción explícita.

## Evidence on Hand

- `README.md`: requisitos, uso, integridad, API, exportaciones, pruebas y arquitectura.
- `PLAN-REDISENO.md`: invariante de seguridad, baseline, comandos y plan de cinco interacciones.
- `src/`, `server/` y `tests/`: implementación y 31 pruebas automatizadas.
- `data/`: vacío en el repositorio; no hay datos reales ni muestras de producción.
- No hay testimonios, clientes, métricas, casos de estudio, material de prensa ni investigación de usuarios. No fabricarlos.

## Product Principles

1. **Local y privado por defecto.** Los datos son del jugador y se quedan en su equipo; no hay cuentas, nube ni telemetría.
2. **Nada se oculta.** El historial completo, los borradores y los bloques cerrados son parte del aprendizaje; la interfaz no esconde estados incómodos.
3. **Revisar antes de seguir.** La fricción de la revisión es una función, no un obstáculo; una revisión vacía nunca debe bloquear.
4. **Contexto antes que conclusión.** Cada mano conserva cartas, posiciones, stack, buy-in y las tres reflexiones; sin contexto no hay aprendizaje.
5. **Español claro y preciso.** La interfaz habla el idioma del jugador y usa terminología de poker sin jerga innecesaria.

## Accessibility & Inclusion

- Interfaz web en español, con estructura semántica, navegación por teclado y foco visible.
- Objetivo de contraste AA para texto y controles; el color no debe ser el único código de estado.
- Respetar `prefers-reduced-motion`; el movimiento no debe ser requisito para entender un cambio.
- Responsive de 390 px a 1440 px, sin scroll horizontal; objetivos táctiles cómodos en móvil.
- Formularios con etiquetas asociadas, mensajes de error claros y estados vacíos útiles.
- No se ha realizado una auditoría formal con usuarios ni una certificación WCAG; el objetivo AA es una meta de implementación, no una certificación.
