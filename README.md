# River Notes · Bitácora de eliminaciones MTT

Aplicación web **100 % local** para registrar eliminaciones de torneos MTT, conservar el contexto de cada mano y obligarte a revisar tus decisiones antes de seguir registrando. No usa cuentas, nube, telemetría ni análisis automáticos.

## Requisitos

- Node.js 20 o superior (probado con Node.js 24).
- npm.
- En Windows puede ser necesario tener instaladas las herramientas de compilación de Node.js para `better-sqlite3` si no existe un binario precompilado para tu versión.

## Arranque

```bash
npm install
npm start
```

`npm start` inicia el servidor exclusivamente en `http://127.0.0.1:3000` y abre el navegador automáticamente.

Variables de entorno opcionales:

| Variable | Uso |
| --- | --- |
| `DATABASE_PATH` | Ruta alternativa para la base SQLite. Por defecto: `./data/eliminations.db`. El respaldo `backup-latest.json` se escribe en la misma carpeta. |
| `OPEN_BROWSER=0` | Evita que se abra el navegador al iniciar. |
| `NODE_ENV=production` | Sirve la compilación de `dist/` en lugar del middleware de Vite. |

Para desarrollo con recarga del servidor:

```bash
npm run dev
```

## Uso

1. **Registrar eliminación**: formulario en dos pasos. El primero captura torneo, Buy-in, posiciones, Stack y las cartas con un selector visual de 52 cartas (13 rangos × 4 palos). El segundo recoge las tres reflexiones: `[PR-EL]`, `[ERR-01]` y `[OK-01]`.
2. **Selector de cartas sin candados**: Héroe, Villano, Flop, Turn y River siempre se pueden activar. El flujo avanza solo de Héroe → Villano → Flop → Turn → River. «Desconocida» salta directo al Flop y «Terminó Preflop» limpia las cartas comunitarias sin bloquear el Flop. La calle se calcula automáticamente según el board completo.
3. **Baraja de cuatro colores**: picas en gris oscuro, corazones en rojo, diamantes en azul y tréboles en verde, tanto en el selector como en el historial y la revisión. Las cartas ya usadas quedan atenuadas y no se pueden repetir en la misma mano.
4. **Borradores**: puedes guardar una mano sin finalizarla. Los borradores no cuentan para activar una revisión y pueden crearse o editarse mientras hay una revisión pendiente.
5. **Revisión obligatoria**: se activa al completar la quinta entrada pendiente o al cumplirse siete días desde la primera entrada completada (o desde la última revisión cerrada). Mientras exista una revisión pendiente, no se pueden finalizar entradas nuevas, pero sí guardar borradores. El aviso aparece en el banner, en el menú lateral y como notificación; la aplicación no te redirige a la fuerza y el historial sigue disponible.
6. **Cierre de revisión**: exige marcar cada entrada del bloque y escribir las tres conclusiones. Al cerrarlo se desbloquea la finalización y el bloque queda registrado en el archivo de revisiones del historial y en las exportaciones.
7. **Historial completo**: por defecto muestra **todas** las entradas, sin ocultar borradores ni bloques cerrados. Incluye pestañas `Todas (N)`, `Pendientes de Revisión`, `Revisadas` y `Borradores`, búsqueda y filtros combinables por torneo, fechas, Buy-in, moneda y estado.
8. **Calendario mensual**: mapa de calor con selector de mes y año. La intensidad indica cuántas eliminaciones registraste; los puntos distinguen pendientes, revisadas y borradores. Cada día muestra un tooltip con la fecha y la cantidad, y al hacer clic filtra el historial por esa fecha. El botón «Quitar filtro de fecha» limpia el filtro.
9. **Archivo de revisiones**: cada bloque cerrado aparece como un acordeón con sus tres conclusiones y todas las manos que lo formaron. Nada se oculta ni se elimina.
10. **Guardar progreso**: botón junto a `LOCAL`. Guarda el formulario activo como borrador (si tiene torneo y las dos cartas del héroe), ejecuta `PRAGMA wal_checkpoint(FULL)` y crea `data/backup-latest.json`. Muestra `Progreso guardado • HH:mm:ss` y permite descargar o restaurar el respaldo desde el menú `▾`.
11. **Copias de seguridad**: desde el historial puedes descargar una copia JSON o SQLite y restaurarla. La restauración valida el archivo, reemplaza los datos locales y conserva las secuencias de numeración.

## Integridad y autosanación

Al arrancar el servidor y antes de evaluar cada revisión, la aplicación audita la base:

- elimina marcas huérfanas que apunten a entradas o bloques inexistentes;
- revincula entradas `COMPLETED` que hayan perdido su marca dentro de un bloque pendiente;
- revierte lotes `PENDING` vacíos, incompletos o corruptos para que nunca bloqueen la aplicación;
- normaliza entradas y marcas de bloques cerrados;
- tolera filas con JSON corrupto: el listado y los contadores siguen funcionando y la entrada se muestra con las cartas que se puedan recuperar.

Una revisión con `checks.length === 0` **nunca** bloquea la finalización. Las entradas vinculadas a un bloque cerrado no se pueden eliminar, para preservar el historial permanente de aprendizaje.

## Datos y privacidad

- La base de datos vive en `data/eliminations.db` y usa SQLite en modo WAL con claves foráneas activadas.
- Los archivos `eliminations.db-wal` y `eliminations.db-shm` son parte del funcionamiento normal de SQLite.
- `data/backup-latest.json` es el último respaldo creado por «Guardar progreso». Se escribe junto a la base y está excluido de Git.
- Los números de entrada usan `AUTOINCREMENT`: nunca se reutilizan, aunque se elimine una entrada. La interfaz los muestra como `ENTRADA 01`, `ENTRADA 02`, etc.
- El servidor escucha solo en `127.0.0.1`. No hay autenticación porque no se expone a la red; no lo publiques en Internet.
- Las copias de seguridad contienen información personal de tus sesiones. Guárdalas en un lugar seguro.
- No se envían datos a servicios externos ni se ejecutan análisis automáticos de las manos.

## API local

| Método y ruta | Uso |
| --- | --- |
| `GET /api/health` | Comprobación de que el servidor local responde. |
| `GET /api/state` | Resumen, conteos, actividad, entradas recientes y revisión pendiente. |
| `GET /api/eliminations` | Historial completo. Acepta filtros; sin filtros devuelve todas las entradas. Incluye `counts` y `activity`. |
| `GET /api/activity` | Actividad agrupada por día para el calendario. |
| `GET /api/reviews/history` | Bloques de revisión cerrados con sus conclusiones y manos. |
| `POST /api/progress/save` | Checkpoint WAL y creación de `backup-latest.json`. |
| `GET /api/progress/backup` | Descarga del último `backup-latest.json`. |
| `POST /api/progress/restore` | Restaura y valida el último `backup-latest.json`. |

El resto de rutas de entrada, revisión y exportación se mantiene igual que en la versión anterior.

## Exportaciones y restauración

- **Markdown**: incluye las entradas en orden cronológico y los bloques de revisión cerrados. Cada entrada conserva sus saltos de línea y su formato canónico; cada bloque incluye sus tres conclusiones y todas sus manos.
- **JSON**: instantánea completa con entradas, revisiones, marcas y secuencias.
- **SQLite**: copia consistente de la base, generada con la API de backup de SQLite.
- **`backup-latest.json`**: respaldo rápido del botón «Guardar progreso», pensado para recuperar el estado más reciente sin salir de la aplicación.
- **Restauración JSON**: valida el esquema, la coherencia de revisiones, las notaciones, las fechas y las secuencias antes de reemplazar los datos.
- **Restauración SQLite**: comprueba la integridad del archivo, que pertenezca a River Notes y que su contenido sea coherente. Si algo falla, conserva la base anterior.

## Pruebas

```bash
npm test        # ejecuta la suite una vez
npm run check   # compilación TypeScript + build de Vite + pruebas
```

La suite cubre, entre otros:

- duplicados de cartas rechazados por el backend;
- notación exacta (`99`, `A9s`, `AKo`);
- persistencia de entradas y borradores al reabrir SQLite;
- activación exacta de la revisión al completar la quinta entrada;
- activación del ciclo de siete días, incluido el límite exacto;
- bloqueo persistente tras reiniciar y desbloqueo al cerrar la revisión;
- numeración permanente tras eliminar una entrada;
- descarga y restauración de copias JSON y SQLite;
- formato canónico con saltos de línea y filtros combinables;
- validación de filtros, cuerpos JSON y copias inválidas con mensajes en español;
- selector visual sin candados, auto-avance, «Desconocida», «Terminó Preflop» y baraja de cuatro colores;
- autorreparación de lotes vacíos, incompletos, marcas huérfanas y filas con JSON corrupto;
- historial completo por defecto, conteos coherentes, actividad diaria y archivo de revisiones;
- guardado de progreso, creación de `backup-latest.json` y restauración del último respaldo.

## Arquitectura

```
server/
  index.ts      Arranque local, Vite en desarrollo y apertura del navegador
  app.ts        API Express y manejo de errores en español
  database.ts   Esquema SQLite, WAL, claves foráneas y mapeo seguro de filas
  domain.ts     Esquemas Zod, notación de manos y validaciones del dominio
  service.ts    Reglas de negocio, autorreparación, revisiones, bloqueos y exportaciones
  backup.ts     Instantáneas JSON, backup-latest.json, validación y restauración
src/
  App.tsx       Estado global, refresco y guardado del formulario activo
  pages/        Inicio, registro, historial y revisión
  components/   Layout, selector de cartas y cartas visuales reutilizables
tests/          Escenarios críticos, API, integridad, historial, respaldo y selector
```

## Problemas frecuentes

- **El puerto 3000 está ocupado**: cierra el proceso que lo usa o detén otra instancia de River Notes.
- **`better-sqlite3` no carga**: comprueba que `npm install` terminó correctamente y que tu versión de Node tiene binarios disponibles o herramientas de compilación.
- **La base está bloqueada**: cierra otras instancias de la aplicación. SQLite WAL permite lecturas concurrentes, pero no debe abrirse la misma base desde varios servidores.
- **«Guardar progreso» no guarda el formulario**: el borrador activo necesita el nombre del torneo y las dos cartas del héroe. El botón siempre crea el respaldo de la base aunque no haya un formulario completo.
- **No aparece el respaldo**: pulsa «Guardar progreso» al menos una vez o usa «Descargar último respaldo»; si no existe, la aplicación lo genera en ese momento.
- **Hay una revisión pendiente que no muestra entradas**: la autosanación la revierte o la completa al arrancar. Recarga la página; si persiste, revisa la consola del servidor.
- **Quiero empezar de cero**: detén la aplicación, elimina `data/eliminations.db`, `data/eliminations.db-wal`, `data/eliminations.db-shm` y `data/backup-latest.json`, y vuelve a iniciar. Los números de entrada comenzarán de nuevo en `01`.
