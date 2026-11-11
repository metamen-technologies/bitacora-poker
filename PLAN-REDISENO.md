# Plan de rediseño visual · River Notes (Etapa 2)

> **Estado:** planificación únicamente. En esta etapa **no** se ha instalado Impeccable, **no** se ha modificado la interfaz y **no** se ha hecho ningún commit. La Etapa 1 está cerrada con `npm run check` en verde: build correcto y **31/31 pruebas**.

## 1. Objetivo

Rediseñar la interfaz de River Notes en **cinco interacciones controladas**, usando los comandos reales de [`pbakaus/impeccable`](https://github.com/pbakaus/impeccable), sin romper ninguna garantía funcional de la Etapa 1.

El rediseño debe conservar:

- la aplicación local, React 19 + Vite + Express + SQLite;
- todos los textos en español;
- el historial completo, sin ocultar borradores ni bloques cerrados;
- la autorreparación de revisiones;
- el selector de cartas libre y la baraja de cuatro colores;
- el calendario, el archivo de revisiones y el guardado con checkpoint/backup;
- los contratos de la API y el esquema SQLite.

El rediseño **sí** puede cambiar:

- jerarquía, tipografía, espaciado, densidad, color, movimiento y responsive;
- la composición del shell, el historial, el formulario y la revisión;
- estilos, clases y estructura visual de los componentes;
- documentación visual (`PRODUCT.md`, `DESIGN.md`).

---

## 2. Invariante de seguridad funcional

Estas condiciones son **no negociables** y deben verificarse al final de cada interacción. Si una falla, se revierte solo el último diff y no se avanza.

| ID | Invariante | Verificación mínima |
|---|---|---|
| **I1** | El historial devuelve **todas** las entradas por defecto. Nada de `DRAFT`, `COMPLETED - Pendiente` o `COMPLETED - Revisada` queda oculto. | `GET /api/eliminations` sin query; `@($all.entries).Count -eq $all.counts.total`; la lista contiene los tres estados. |
| **I2** | Una revisión con `checks.length === 0` **nunca** bloquea. | Insertar un lote `PENDING` vacío; `GET /api/reviews/pending` devuelve `null`; crear una entrada `COMPLETED` responde `201`. |
| **I3** | La autosanación repara lotes vacíos/incompletos, marcas huérfanas y estados inconsistentes. | `npm test -- tests/integrity-repair.test.ts`; 6/6. |
| **I4** | Hidratación completa desde SQLite al abrir o recargar: entradas, borradores, marcas y bloques cerrados. | Crear 1 borrador + 5 completadas + 1 revisión cerrada; reiniciar el servidor; `GET /api/eliminations` y `GET /api/reviews/history` conservan todo. |
| **I5** | `Guardar progreso` guarda el formulario activo, ejecuta `PRAGMA wal_checkpoint(FULL)`, crea `data/backup-latest.json` y muestra `Progreso guardado • HH:mm:ss`. | `POST /api/progress/save`; `Test-Path data/backup-latest.json`; la UI muestra el texto con hora; `POST /api/progress/restore` conserva los conteos. |
| **I6** | Héroe, Villano, Flop, Turn y River siempre están activables; auto-avance; `Desconocida` salta a Flop; `Terminó Preflop` limpia comunitarias sin bloquear Flop. | `npm test -- tests/card-picker.test.tsx`; 6/6; además revisar `aria-pressed` y `toBeEnabled()` en navegador. |
| **I7** | La baraja de cuatro colores se conserva en formulario, historial y revisión. | `Select-String` de los ocho hex en `src/styles.css`; clases `suit-s`, `suit-h`, `suit-d`, `suit-c`; revisar las tres superficies. |
| **I8** | Calendario mensual con mes/año, intensidad o número, distinción pendientes/revisadas, tooltip con fecha y cantidad, clic para filtrar y acción para limpiar. | Navegar a `/historial`; probar mes anterior/siguiente, clic en día, tooltip y «Quitar filtro de fecha». |
| **I9** | `GET /api/eliminations` no aplica filtros destructivos ni borra datos. Los contadores y el listado por defecto coinciden. | Inspeccionar la ruta en `server/app.ts`; `counts.total === entries.length`; ningún `DELETE` fuera de `DELETE /api/eliminations/:id`. |
| **I10** | Respaldo y restauración JSON/SQLite siguen validando y conservan secuencias permanentes. | `npm test -- tests/history-progress.test.ts`; 4/4; restaurar desde el menú y comprobar que se navega al historial. |
| **I11** | La Etapa 2 **no** cambia el backend, el esquema ni los contratos de la API. | `git status --short server/` vacío; `npm run check` en verde; smoke de API. |
| **I12** | Accesibilidad y responsive: teclado, foco visible, contraste, `prefers-reduced-motion`, sin scroll horizontal en 390, 768, 1024 y 1440 px. | Navegación con Tab; `document.documentElement.scrollWidth <= window.innerWidth`; emulación de movimiento reducido; detector de Impeccable. |

### Verificación rápida de la API

Con el servidor en `http://127.0.0.1:3000`:

```powershell
$base = "http://127.0.0.1:3000"
$health   = Invoke-RestMethod "$base/api/health"
$state    = Invoke-RestMethod "$base/api/state"
$all      = Invoke-RestMethod "$base/api/eliminations"
$activity = Invoke-RestMethod "$base/api/activity"
$reviews  = Invoke-RestMethod "$base/api/reviews/history"
$save     = Invoke-RestMethod "$base/api/progress/save" -Method Post

if (-not $health.ok) { throw "Health falló" }
if (@($all.entries).Count -ne $all.counts.total) { throw "Contador y listado no coinciden" }
if ($state.pendingBatch -and @($state.pendingBatch.checks).Count -eq 0) { throw "Revisión vacía bloqueando" }
"OK · entradas=$(@($all.entries).Count) · total=$($all.counts.total) · días=$(@($activity.days).Count) · bloques=$(@($reviews.batches).Count) · backup=$($save.backupPath)"
```

---

## 3. Instalación exacta de Impeccable

Desde la raíz del proyecto:

```powershell
cd C:\Users\agent\Downloads\bitacora-poker
npx impeccable install -y --providers=opencode --scope=project
```

Esto instala en el proyecto:

- `.opencode/skills/impeccable/` (skill y scripts);
- `.opencode/commands/impeccable.md` (comando `/impeccable`);
- los artefactos de contexto que el instalador genere.

Después:

1. **Recarga OpenCode** para que cargue el comando y la skill.
2. Ejecuta `/impeccable init` en el chat, no en la terminal.
3. Ejecuta `/impeccable document` después de `init`.

### Diferencias importantes que el plan respeta

- El comando de contexto es **`/impeccable init`**, no `/teach-impeccable`. `teach` es un alias de `init`, pero el plan usa el nombre canónico.
- **No existe `/normalize`**. No lo uses.
- `/audit` **no** es un comando integrado: solo existe si lo fijas con `/impeccable pin audit`.
- La alternativa por terminal en Windows es:
  ```powershell
  .opencode\skills\impeccable\scripts\impeccable.cmd pin audit
  ```
- Para actualizar: `npx impeccable update`.
- Para comprobar deriva de contexto: `/impeccable doctor` (solo si hace falta; no lo ejecutes como efecto secundario de un rediseño).

### Comandos reales que se usarán

| Comando | Uso en este plan |
|---|---|
| `/impeccable init` | Crear `PRODUCT.md` con usuarios, propósito, restricciones y accesibilidad. |
| `/impeccable document` | Crear `DESIGN.md` a partir del sistema visual existente. |
| `/impeccable critique` | Revisión UX puntuada, con subagentes si están disponibles. |
| `/impeccable audit` | Auditoría técnica: accesibilidad, rendimiento, theming, responsive e integridad. |
| `/impeccable typeset` | Jerarquía tipográfica y legibilidad. |
| `/impeccable layout` | Espaciado, ritmo y estructura. |
| `/impeccable colorize` | Color con roles semánticos. |
| `/impeccable distill` | Quitar ruido y complejidad. |
| `/impeccable animate` | Movimiento con propósito. |
| `/impeccable adapt` | Adaptación a móvil, tablet y escritorio. |
| `/impeccable harden` | Errores, estados vacíos, contenido largo, i18n y edge cases. |
| `/impeccable polish` | Pasada final antes de cerrar. |

### Detector

```powershell
npx impeccable detect --json src/
npx impeccable detect --json --scope type src/
npx impeccable detect --json --scope layout src/
npx impeccable detect http://127.0.0.1:3000/historial
```

`exit code 2` significa “hay hallazgos”, no “el comando falló”. Hay que leerlos, verificar si son falsos positivos y corregir solo lo que aplique.

---

## 4. Baseline y rollback (obligatorio antes de tocar la UI)

El repositorio **no tiene commiteada la Etapa 1** (solo existe el commit inicial). Por eso **no uses `git checkout --` ni `git restore`** para revertir: borrarías todo el trabajo de la Etapa 1. El rollback se hace desde una copia física.

### Crear baseline

Detén el servidor antes de copiar `data/`:

```powershell
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$baseline = "C:\Users\agent\AppData\Local\Temp\opencode\bitacora-poker-baseline-$stamp"
New-Item -ItemType Directory -Path $baseline | Out-Null
Copy-Item -Recurse -Force src,server,tests,README.md,package.json,package-lock.json,index.html,tsconfig.json,vite.config.ts,vitest.config.ts,tailwind.config.cjs,postcss.config.cjs,.gitignore $baseline
if (Test-Path data) { Copy-Item -Recurse -Force data $baseline }
Write-Output "Baseline: $baseline"
```

Guarda la ruta en un archivo temporal o en la variable de sesión. Cada interacción debe empezar con el baseline ya creado.

### Rollback de una interacción

```powershell
# Ejemplo: restaurar solo los estilos
Copy-Item -Force "$baseline\src\styles.css" .\src\styles.css
```

Para restaurar todo el código (sin tocar `node_modules`):

```powershell
Remove-Item -Recurse -Force .\src, .\server, .\tests
Copy-Item -Recurse -Force "$baseline\src", "$baseline\server", "$baseline\tests" .
Copy-Item -Force "$baseline\README.md", "$baseline\package.json", "$baseline\package-lock.json", "$baseline\index.html", "$baseline\tsconfig.json", "$baseline\vite.config.ts", "$baseline\vitest.config.ts", "$baseline\tailwind.config.cjs", "$baseline\postcss.config.cjs", "$baseline\.gitignore" .
```

No borres `node_modules`, `dist` ni `data` con este comando. Si hay datos reales, restaura `data/` desde la copia solo cuando el servidor esté detenido.

---

## 5. Archivos permitidos y prohibidos

### Permitidos según la interacción

| Interacción | Archivos que puede tocar |
|---|---|
| 1. Contexto | `PRODUCT.md`, `DESIGN.md`, `.impeccable/**`, `.opencode/**` (instalación). **Nada de `src/` ni `server/`.** |
| 2. Diagnóstico | Solo reportes en `.impeccable/**`. **Cero cambios de código.** |
| 3. Tipografía y layout | `src/styles.css`, `index.html` (solo fuentes), `tailwind.config.cjs` (solo tokens), `src/components/Layout.tsx`, `src/pages/HistoryPage.tsx`, `src/pages/EntryPage.tsx`, `src/pages/ReviewPage.tsx` (solo clases/markup visual). |
| 4. Color, densidad y movimiento | `src/styles.css`, `src/components/PlayingCards.tsx`, `src/components/CardPicker.tsx`, `src/components/Layout.tsx`, `src/pages/HistoryPage.tsx`, `tailwind.config.cjs`. |
| 5. Adaptación y pulido | `src/styles.css`, `src/components/Layout.tsx`, `src/components/CardPicker.tsx`, `src/pages/HistoryPage.tsx`, `src/pages/ReviewPage.tsx`, `src/App.tsx` (solo si es imprescindible), `tests/card-picker.test.tsx` y `tests/history-progress.test.ts` (solo ampliaciones), `README.md`. |

### Prohibidos en toda la Etapa 2

- `server/**` (salvo que el usuario pida explícitamente un cambio funcional; no es el caso).
- `data/**` real.
- `package.json` y `package-lock.json` (salvo que se apruebe una dependencia; la preferencia es no añadir ninguna).
- `dist/**`.
- Cambiar textos funcionales, nombres de campos, endpoints, esquemas Zod o reglas de negocio.
- Ocultar entradas o bloques.
- Cambiar los ocho hex de la baraja.
- Cambiar los selectores que usan las pruebas.

### Selectores y contratos visuales que deben sobrevivir

Estos nombres son contrato de las pruebas y de la accesibilidad. Si el rediseño cambia el markup, hay que conservarlos o actualizar la prueba de forma aditiva, nunca debilitarla:

- `Seleccionar ${card}` y `Quitar ${card}`;
- `Héroe · 0/2`, `Villano · 0/2`, `Flop · 0/3`, `Turn · 0/1`, `River · 0/1`;
- `Desconocida`, `Terminó Preflop`;
- `role="status"` para avisos del selector;
- `playing-card`, `suit-s`, `suit-h`, `suit-d`, `suit-c`, `chosen-card`, `deck-card`;
- pestañas `Todas (N)`, `Pendientes de Revisión`, `Revisadas`, `Borradores`;
- `data-tooltip` del calendario;
- textos `Progreso guardado • HH:mm:ss`, `Guardar progreso`, `backup-latest.json`.

---

## 6. Las cinco interacciones

Cada interacción tiene: objetivo, comando, prompt exacto, archivos, entregable y verificación de no regresión. **No se avanza a la siguiente si la verificación falla.**

### Interacción 1 — Contexto y contrato visual

**Objetivo:** capturar la verdad del producto y el sistema visual existente antes de tocar nada. No es un rediseño.

**Comandos:** `/impeccable init` y, después, `/impeccable document`.

**Prompt exacto (pegar en OpenCode):**

```text
/impeccable init

Contexto: River Notes es una bitácora local de eliminaciones MTT. La usan jugadores de poker que quieren registrar cada mano, conservar el contexto y revisar patrones antes de seguir jugando. Todo está en español. El producto es local, sin cuentas, sin nube y sin telemetría.

Objetivo de esta interacción: crear PRODUCT.md con usuarios, propósito, contexto operativo, capacidades, restricciones, principios y accesibilidad. No escribas DESIGN.md todavía y no modifiques src/ ni server/.

Restricciones que debes registrar:
- Historial completo por defecto: nunca ocultar DRAFT, COMPLETED - Pendiente ni COMPLETED - Revisada.
- Revisión obligatoria que jamás bloquea si el lote no tiene entradas.
- Guardado con checkpoint WAL y backup-latest.json.
- Selector de cartas libre, auto-avance y baraja de cuatro colores.
- Calendario mensual y archivo de revisiones cerradas.
- Los datos son personales y locales; no se envían a terceros.

Haz solo las preguntas que no puedas responder con el repositorio. No inventes usuarios, métricas ni testimonios. Al terminar, resume qué quedó confirmado y qué quedó deliberadamente abierto.
```

Cuando `init` termine:

```text
/impeccable document

Documenta el sistema visual que ya existe en River Notes, en modo scan. Lee src/styles.css, tailwind.config.cjs, index.html y los componentes principales. Extrae tokens reales: colores, tipografía, espaciado, radios, sombras, breakpoints y componentes. No propongas un rediseño y no cambies ningún archivo de src/.

Incluye como restricciones del sistema:
- la baraja de cuatro colores con sus ocho valores;
- el tema oscuro verde;
- las pestañas del historial;
- el calendario de calor;
- el archivo de revisiones;
- el botón Guardar progreso.

Si algo no se puede inferir, déjalo como decisión abierta; no lo inventes.
```

**Archivos esperados:** `PRODUCT.md`, `DESIGN.md`, `.impeccable/config.json`, `.impeccable/design.json`, `.impeccable/surfaces/**` (si aplica). **Ningún cambio en `src/` ni `server/`.**

**Entregable:** `PRODUCT.md` y `DESIGN.md` revisables; tokens extraídos del código real, no de una plantilla.

**Verificación:**

```powershell
npm run check
git status --short
.opencode\skills\impeccable\scripts\impeccable.cmd context
Get-Content PRODUCT.md
Get-Content DESIGN.md
```

- `npm run check` debe seguir en **31/31**.
- `git status --short` no debe mostrar cambios en `src/` ni `server/`.
- `impeccable context` debe cargar `PRODUCT.md` y `DESIGN.md` sin errores.
- Si `init` intenta rediseñar o escribir CSS, detenerlo: esta interacción solo documenta.

---

### Interacción 2 — Diagnóstico sin editar

**Objetivo:** obtener una crítica UX y una auditoría técnica priorizadas, sin tocar código. El resultado decide qué se arregla en las interacciones 3–5.

**Comandos:** `/impeccable critique` y `/impeccable audit`.

**Prompt exacto (crítica):**

```text
/impeccable critique src/pages/HistoryPage.tsx

Superficie: historial de eliminaciones de River Notes. Modo Operate: la persona quiere escanear, filtrar y entender su historial rápido, no contemplar una landing.

Evalúa:
- especificidad del diseño (¿podría ser de otro producto?);
- jerarquía y carga cognitiva del historial, las pestañas, el calendario y el archivo de revisiones;
- estados DRAFT, COMPLETED - Pendiente y COMPLETED - Revisada;
- legibilidad de las cartas de cuatro colores;
- accesibilidad, foco, teclado y contraste;
- qué se siente pesado, repetitivo o decorativo.

No edites código. Entrega el reporte completo con puntuación, fortalezas, 3–5 problemas prioritarios y una lista de archivos/líneas concretas. Si no puedes usar subagentes, indícalo con el banner de modo degradado que corresponda.
```

**Prompt exacto (auditoría):**

```text
/impeccable audit src/

Audita la implementación web de River Notes sin cambiar código. Revisa accesibilidad, rendimiento, theming, responsive e integridad de implementación. Usa el detector real y, si está disponible, inspecciona la página en http://127.0.0.1:3000/historial.

Presta atención a:
- contraste de textos pequeños y metadatos;
- targets táctiles del calendario, las pestañas y el selector de cartas;
- scroll horizontal en 390 px;
- foco visible en botones, inputs y enlaces;
- estados vacíos, errores y contenido largo;
- coherencia de tokens y colores hardcodeados;
- que el rediseño no dependa de ocultar contenido.

No edites código. Ordena los hallazgos P0–P3 con archivo, línea, impacto y comando recomendado.
```

**Archivos esperados:** solo reportes en `.impeccable/**` (snapshots de critique/audit). **Cero cambios de código.**

**Entregable:** informe con puntuación de heurísticas, auditoría 0–20, P0/P1/P2/P3 y una lista de 3–5 cambios que se llevarán a las siguientes interacciones.

**Verificación:**

```powershell
npm run check
npx impeccable detect --json src/
git status --short
```

- `npm run check` sigue en **31/31**.
- `git status --short` no muestra cambios en `src/` ni `server/`.
- El detector corre y los hallazgos están explicados; los falsos positivos se marcan como tales.
- El informe cita archivos y líneas reales; no recomendaciones genéricas.

**Puerta de decisión:** el usuario elige los 3 problemas que se atacarán primero. Si no hay respuesta, se prioriza P0/P1 de accesibilidad y legibilidad del historial.

---

### Interacción 3 — Tipografía y layout

**Objetivo:** mejorar jerarquía, legibilidad, ritmo y estructura sin cambiar la identidad ni el comportamiento.

**Comandos:** `/impeccable typeset` y después `/impeccable layout`.

**Prompt exacto (tipografía):**

```text
/impeccable typeset src/

Objetivo: mejorar la jerarquía tipográfica de River Notes dentro del mundo visual existente (tema oscuro verde, producto Operate, todo en español). No cambies la identidad ni los textos.

Trabaja sobre:
- títulos de página, títulos de panel, etiquetas, metadatos, tablas y cartas;
- legibilidad de párrafos y textos de análisis;
- escala de tamaños y pesos;
- medida de lectura de 45–75 caracteres;
- números tabulares en fechas, stacks, buy-ins y contadores;
- foco, zoom y texto largo.

Restricciones duras:
- no cambies la baraja de cuatro colores;
- no ocultes entradas ni bloques;
- no cambies endpoints, estado ni textos funcionales;
- conserva los selectores de las pruebas.

Archivos permitidos: src/styles.css, index.html (solo fuentes), tailwind.config.cjs (solo tokens), y clases/markup visual de Layout, HistoryPage, EntryPage y ReviewPage. No toques server/.

Antes de editar, declara los roles tipográficos y el sistema que vas a usar. Después de editar, verifica con npm run check y con el detector --scope type.
```

**Prompt exacto (layout):**

```text
/impeccable layout src/

Objetivo: ordenar el ritmo y la estructura de River Notes sin convertirlo en otra aplicación. Modo Operate: densidad estable, escaneabilidad y jerarquía clara.

Revisa:
- el shell (sidebar + workspace + topbar);
- el historial (pestañas, calendario, filtros, lista y detalle);
- el formulario (pasos, panel de datos, selector de cartas, barra de guardado);
- la revisión (lista de entradas, panel activo, conclusiones);
- el archivo de revisiones y el panel de respaldo.

Busca: agrupación por proximidad, ritmo intencional, contenedores innecesarios, scroll horizontal, targets táctiles pequeños y orden de lectura en móvil.

Restricciones duras: no cambies la lógica, no ocultes contenido, no cambies los ocho hex de la baraja, no toques server/ y conserva los selectores de las pruebas.

Archivos permitidos: los mismos de typeset, solo clases/markup visual. Verifica con npm run check, detector --scope layout y capturas en 1440, 1024, 768 y 390 px.
```

**Archivos esperados:** `src/styles.css` como archivo principal; `index.html` solo si se añaden fuentes; `tailwind.config.cjs` solo si se formalizan tokens; `src/components/Layout.tsx`, `src/pages/HistoryPage.tsx`, `src/pages/EntryPage.tsx`, `src/pages/ReviewPage.tsx` solo en clases/markup visual.

**Entregable:** sistema tipográfico declarado y aplicado; layout con jerarquía clara; capturas antes/después en cuatro anchos.

**Verificación:**

```powershell
npm run check
npx impeccable detect --json --scope type src/
npx impeccable detect --json --scope layout src/
npx impeccable detect http://127.0.0.1:3000/historial
```

Además, en el navegador:

- 1440×900, 1024×768, 768×1024 y 390×844;
- `document.documentElement.scrollWidth <= window.innerWidth`;
- Tab por toda la página con foco visible;
- títulos en orden jerárquico;
- texto de cuerpo a 16 px como mínimo;
- ningún texto funcional cambiado.

**Rollback:** restaurar `src/styles.css` y los archivos de layout desde el baseline. No usar `git checkout`.

---

### Interacción 4 — Color, densidad y movimiento

**Objetivo:** dar color con roles semánticos, quitar ruido y añadir movimiento solo donde explica estado. La baraja de cuatro colores es intocable.

**Comandos:** `/impeccable colorize`, `/impeccable distill` y `/impeccable animate`.

**Prompt exacto (color):**

```text
/impeccable colorize src/

Objetivo: mejorar el color de River Notes con roles semánticos, no con una paleta nueva. Mantén el tema oscuro verde y la identidad de sala de poker.

Trabaja sobre:
- superficie, superficie elevada, texto primario/secundario, bordes y separadores;
- acción primaria, foco, selección, éxito, advertencia y error;
- estados del historial: borrador, pendiente y revisada;
- calendario: pendientes, revisadas, borradores e intensidad;
- archivo de revisiones y panel de respaldo.

Restricción dura: la baraja de cuatro colores debe conservar exactamente estos valores:
- picas #18181b / #3f3f46
- corazones #dc2626 / #ef4444
- diamantes #2563eb / #3b82f6
- tréboles #16a34a / #22c55e

Puedes usar una variante clara para el glyph sobre el deck oscuro si hace falta contraste, pero los ocho valores deben seguir siendo la fuente de verdad. No cambies el significado de los estados ni ocultes contenido.

Archivos permitidos: src/styles.css, src/components/PlayingCards.tsx, src/components/CardPicker.tsx, src/components/Layout.tsx, src/pages/HistoryPage.tsx, tailwind.config.cjs. No toques server/.

Verifica contraste AA (4.5:1 cuerpo, 3:1 texto grande/controles), estados hover/focus/disabled y que el color no sea el único código de estado.
```

**Prompt exacto (distill):**

```text
/impeccable distill src/

Objetivo: quitar ruido visual y complejidad innecesaria sin perder información ni funciones. River Notes es una herramienta Operate: la claridad gana a la decoración.

Busca:
- contenedores dentro de contenedores;
- bordes, sombras y gradientes que no explican jerarquía;
- etiquetas repetidas;
- acciones secundarias con demasiado peso;
- decoración que compite con el historial, las cartas y el calendario.

No elimines:
- pestañas del historial;
- estados DRAFT/PENDIENTE/REVISADA;
- el calendario, el archivo de revisiones ni el guardado;
- textos de ayuda necesarios;
- selectores de pruebas.

Archivos permitidos: los mismos de colorize. Verifica con npm run check y detector completo.
```

**Prompt exacto (movimiento):**

```text
/impeccable animate src/

Objetivo: añadir movimiento con propósito, no decoración. River Notes es una herramienta de trabajo: el movimiento debe explicar feedback, estado y continuidad.

Puntos permitidos:
- selección de carta y avance Héroe → Villano → Flop → Turn → River;
- guardado de progreso y toast;
- filtro de calendario y limpieza de fecha;
- marcado de una entrada en la revisión;
- apertura del archivo de revisiones.

Reglas:
- 100–150 ms para feedback inmediato, 150–300 ms para cambios de estado;
- transform y opacity, no animar width/height/top/left/margins;
- respetar prefers-reduced-motion con una alternativa que conserve el cambio de estado;
- nada de confeti, rebotes ni animaciones de carga largas;
- no bloquear el foco ni la lectura.

Archivos permitidos: src/styles.css y clases/markup visual de Layout, CardPicker, HistoryPage y ReviewPage. No toques la lógica de estado ni server/. Verifica con npm run check, teclado y emulación de movimiento reducido.
```

**Archivos esperados:** `src/styles.css`, `src/components/PlayingCards.tsx`, `src/components/CardPicker.tsx`, `src/components/Layout.tsx`, `src/pages/HistoryPage.tsx`, `tailwind.config.cjs`.

**Entregable:** paleta con roles, menos ruido, movimiento sutil y coherente; capturas de historial, formulario y revisión.

**Verificación:**

```powershell
npm run check
npx impeccable detect --json src/
npx impeccable detect http://127.0.0.1:3000/historial
Select-String -Path src\styles.css -Pattern "#18181b|#3f3f46|#dc2626|#ef4444|#2563eb|#3b82f6|#16a34a|#22c55e"
```

Además:

- contraste calculado, no “a ojo”;
- estados hover/focus/disabled visibles;
- calendario: puntos + número + tooltip, no solo color;
- historial: los tres estados siguen visibles;
- `prefers-reduced-motion`: el estado cambia sin movimiento espacial;
- ningún test de selector modificado.

**Rollback:** restaurar los archivos de esta interacción desde el baseline.

---

### Interacción 5 — Adaptación, endurecimiento y pulido final

**Objetivo:** que el rediseño funcione en móvil, tablet y escritorio; que resista errores, contenido largo y estados vacíos; y que la pasada final no introduzca regresiones.

**Comandos:** `/impeccable adapt`, `/impeccable harden` y `/impeccable polish`.

**Prompt exacto (adaptación):**

```text
/impeccable adapt src/

Objetivo: adaptar River Notes a móvil, tablet y escritorio sin convertirla en una versión escalada. La persona puede registrar una mano desde el móvil y revisar el historial desde el escritorio.

Revisa:
- sidebar de 224 px en móvil: debe convertirse en navegación inferior, drawer o patrón equivalente;
- topbar y botón Guardar progreso;
- historial: pestañas, calendario, filtros, lista y detalle;
- formulario: pasos, panel de datos, selector de cartas y barra de guardado;
- revisión: lista de entradas y panel activo;
- archivo de revisiones y panel de respaldo.

Requisitos:
- targets táctiles de 44×44 px como objetivo;
- sin scroll horizontal en 390 px;
- orden DOM y foco coherentes con el orden visual;
- nada de hover como única affordance;
- textos y botones siguen en español.

Archivos permitidos: src/styles.css y clases/markup visual de Layout, CardPicker, HistoryPage, ReviewPage y App.tsx solo si es imprescindible. No toques server/.

Verifica en 390×844, 768×1024, 1024×768 y 1440×900; usa teclado y emulación táctil.
```

**Prompt exacto (harden):**

```text
/impeccable harden src/

Objetivo: endurecer la interfaz de River Notes sin cambiar reglas de negocio. Revisa errores, estados vacíos, contenido largo, i18n y edge cases visuales.

Casos obligatorios:
- historial vacío y filtros sin resultados;
- revisión sin lote pendiente y lote vacío (nunca debe bloquear);
- formulario nuevo, borrador, completado y bloqueado por revisión;
- cartas desconocidas, board incompleto y Terminó Preflop;
- nombres de torneo largos, análisis con saltos de línea y muchos dígitos;
- calendario sin actividad y mes sin datos;
- backup inexistente, restore fallido y restore exitoso;
- errores de API en español.

No cambies endpoints, esquemas, reglas de revisión ni el significado de los estados. No ocultes contenido para “simplificar”. Archivos permitidos: los de adaptación, más tests solo de forma aditiva. Verifica con npm run check y un smoke de producción con base temporal.
```

**Prompt exacto (pulido final):**

```text
/impeccable polish src/

Objetivo: pasada final de calidad sobre River Notes. No es un rediseño: es consistencia, detalle y acabado.

Revisa:
- alineación óptica y matemática;
- consistencia de tokens, radios, sombras y espaciado;
- estados default/hover/focus/active/disabled/loading/error/success;
- tipografía, color, iconografía y cartas;
- movimiento y reduced motion;
- textos, puntuación y mayúsculas en español;
- código y CSS muerto introducido por el rediseño.

No cambies la identidad, los textos funcionales, los ocho hex de la baraja, los endpoints ni las reglas. No ocultes entradas. No debilites pruebas.

Antes de terminar:
1. npm run check;
2. detector completo;
3. smoke de producción;
4. capturas en cuatro anchos;
5. resumen de archivos tocados y de lo que no se tocó.
```

**Archivos esperados:** `src/styles.css`, `src/components/Layout.tsx`, `src/components/CardPicker.tsx`, `src/pages/HistoryPage.tsx`, `src/pages/ReviewPage.tsx`, `src/App.tsx` solo si es imprescindible; `tests/card-picker.test.tsx` y `tests/history-progress.test.ts` solo ampliaciones; `README.md` si cambia el uso visible.

**Entregable:** interfaz adaptada, endurecida y pulida; documentación actualizada; informe final con evidencias.

**Verificación final:**

```powershell
npm run check
npx impeccable detect --json src/
npx impeccable detect http://127.0.0.1:3000/historial
```

Smoke de producción con base temporal (no usar la base real):

```powershell
$dir = "C:\Users\agent\AppData\Local\Temp\opencode\river-smoke-final"
New-Item -ItemType Directory -Force -Path $dir | Out-Null
$env:NODE_ENV = "production"
$env:OPEN_BROWSER = "0"
$env:DATABASE_PATH = "$dir\eliminations.db"
npm start
```

En otra terminal:

```powershell
$base = "http://127.0.0.1:3000"
Invoke-RestMethod "$base/api/health"
Invoke-RestMethod "$base/api/state"
Invoke-RestMethod "$base/api/eliminations"
Invoke-RestMethod "$base/api/activity"
Invoke-RestMethod "$base/api/reviews/history"
Invoke-RestMethod "$base/api/progress/save" -Method Post
```

Comprobar:

- `/`, `/registro`, `/historial` y `/revision` responden `200`;
- el alta de un borrador y una entrada completada funciona;
- `backup-latest.json` se crea en la carpeta temporal;
- restaurar conserva los conteos;
- no hay errores en consola;
- el servidor se detiene y la base temporal se elimina.

**Rollback:** restaurar desde el baseline. Si el problema es solo visual, restaurar `src/styles.css` y los componentes; si es funcional, restaurar `src/` y `tests/` completos y volver a la Etapa 1.

---

## 7. Protocolo de verificación por turno

### Antes de cada interacción

1. Confirmar que el baseline existe y anotar su ruta.
2. `git status --short` para saber qué está tocado.
3. `npm run check` para confirmar el punto de partida.
4. Guardar una captura base de `/`, `/registro`, `/historial` y `/revision` en 1440 y 390 px.
5. Si hay datos reales, detener el servidor y copiar `data/` al baseline.

### Durante la interacción

- Respetar la lista de archivos permitidos.
- No cambiar textos funcionales ni contratos de prueba.
- No tocar `server/`, `data/` ni `dist/`.
- Hacer cambios pequeños y verificables; no mezclar tipografía, color y movimiento en un mismo diff si se pueden separar.
- Si el agente propone un rediseño total, recordarle que el modo es **refinamiento** y que la identidad se conserva.

### Después de cada interacción

1. `npm run check` → debe seguir en **31/31**.
2. Detector de Impeccable → revisar hallazgos, no ignorarlos sin explicación.
3. Navegador → cuatro anchos, teclado, foco, consola, sin scroll horizontal.
4. `git status --short` → solo archivos permitidos.
5. Capturas después → comparar con las de antes.
6. Actualizar `README.md` solo si cambió el uso visible.
7. Registrar evidencia en el chat: salida de comandos, capturas, conteos y cualquier decisión.

### Criterio de parada

Se detiene la interacción y se revierte si:

- falla una prueba;
- una entrada o un bloque desaparece del historial;
- una revisión vacía bloquea;
- se rompe el guardado o la restauración;
- el selector pierde destinos, auto-avance o la baraja de cuatro colores;
- aparece scroll horizontal en 390 px;
- el contraste de texto o controles queda por debajo de AA;
- se toca `server/` sin autorización.

---

## 8. Qué no hacer

- No ejecutar `/normalize` (no existe).
- No usar `/teach-impeccable` (usar `/impeccable init`; `teach` es alias, pero el plan usa el nombre canónico).
- No asumir que `/audit` existe antes de `pin audit`.
- No instalar en scope global; usar `--scope=project`.
- No reescribir la aplicación ni el backend.
- No cambiar los ocho hex de la baraja.
- No ocultar `DRAFT`, `COMPLETED - Pendiente` ni `COMPLETED - Revisada`.
- No ocultar bloques de revisión cerrados.
- No borrar entradas vinculadas a bloques cerrados.
- No tocar `data/` real durante pruebas o smoke.
- No hacer commit sin pedirlo.
- No usar `git checkout --` ni `git restore` para revertir la Etapa 2: la Etapa 1 no está commiteada. Usar el baseline físico.

---

## 9. Criterios de aceptación de la Etapa 2

- Las cinco interacciones se completan con `npm run check` en verde.
- El historial sigue mostrando todas las entradas y los tres estados.
- La revisión vacía sigue sin bloquear.
- `Guardar progreso` sigue creando `data/backup-latest.json` y muestra la hora.
- El selector sigue libre, con auto-avance, `Desconocida` y `Terminó Preflop`.
- La baraja conserva los ocho valores y se ve en formulario, historial y revisión.
- El calendario sigue filtrando y limpiando la fecha.
- El archivo de revisiones sigue mostrando las tres conclusiones y todas las manos.
- No hay scroll horizontal en 390, 768, 1024 y 1440 px.
- Teclado, foco y `prefers-reduced-motion` funcionan.
- La auditoría final no tiene P0/P1 sin resolver.
- `DESIGN.md` refleja el sistema final.
- El usuario aprueba el resultado visual antes de dar la Etapa 2 por cerrada.

---

## 10. Orden recomendado de ejecución

1. Crear baseline.
2. **Interacción 1:** instalar Impeccable, `init`, `document`. Verificar que no se tocó `src/`.
3. **Interacción 2:** `critique` + `audit`. Elegir 3 problemas.
4. **Interacción 3:** `typeset` + `layout`. Verificar y capturar.
5. **Interacción 4:** `colorize` + `distill` + `animate`. Verificar y capturar.
6. **Interacción 5:** `adapt` + `harden` + `polish`. Verificación final y smoke.
7. Actualizar `README.md` y `DESIGN.md` si hace falta.
8. Pedir aprobación visual. No hacer commit sin autorización.
