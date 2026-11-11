---
name: River Notes
description: Bitácora local de eliminaciones MTT; sala de poker nocturna, verde profundo y acento lima.
colors:
  ink: "#080d0b"
  ink-deep: "#0a0f0d"
  panel: "#111a16"
  panel-raised: "#131f1a"
  sidebar: "#0d1512"
  surface-input: "#0b120f"
  line: "#294034"
  line-soft: "#23342b"
  line-strong: "#2a4034"
  text: "#edf1ee"
  text-strong: "#e8ece9"
  text-muted: "#93a198"
  text-dim: "#7f9086"
  lime: "#bdf36b"
  lime-bright: "#cbff7a"
  lime-deep: "#6a9a42"
  lime-wash: "#1e311b"
  lime-wash-deep: "#203a1c"
  lime-ink: "#15200f"
  warning: "#efc977"
  warning-deep: "#2e2717"
  danger: "#dd8d84"
  danger-deep: "#2b1715"
  draft: "#94a3b8"
  draft-deep: "#292d2a"
  draft-text: "#aab0ac"
  suit-spade-deep: "#18181b"
  suit-spade-soft: "#3f3f46"
  suit-heart-deep: "#dc2626"
  suit-heart-soft: "#ef4444"
  suit-diamond-deep: "#2563eb"
  suit-diamond-soft: "#3b82f6"
  suit-club-deep: "#16a34a"
  suit-club-soft: "#22c55e"
typography:
  display:
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "clamp(26px, 3vw, 34px)"
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: "-0.025em"
  headline:
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.2
  title:
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "17px"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "10px"
    fontWeight: 800
    lineHeight: 1.4
    letterSpacing: "0.02em"
  mono:
    fontFamily: '"Cascadia Code", Consolas, monospace'
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.65
rounded:
  xs: "5px"
  sm: "6px"
  md: "7px"
  lg: "8px"
  xl: "9px"
  panel: "11px"
  pill: "16px"
  circle: "50%"
spacing:
  "2xs": "4px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.lime}"
    textColor: "{colors.lime-ink}"
    rounded: "{rounded.sm}"
    padding: "0 24px"
    height: "42px"
  button-primary-hover:
    backgroundColor: "{colors.lime-bright}"
    textColor: "{colors.lime-ink}"
    rounded: "{rounded.sm}"
    padding: "0 24px"
    height: "42px"
  button-secondary:
    backgroundColor: "{colors.surface-input}"
    textColor: "{colors.text-strong}"
    rounded: "{rounded.sm}"
    padding: "0 24px"
    height: "42px"
  button-secondary-hover:
    backgroundColor: "{colors.surface-input}"
    textColor: "{colors.text-strong}"
    rounded: "{rounded.sm}"
    padding: "0 24px"
    height: "42px"
  button-danger:
    backgroundColor: "{colors.surface-input}"
    textColor: "{colors.danger}"
    rounded: "{rounded.sm}"
    padding: "0 24px"
    height: "42px"
  button-warning:
    backgroundColor: "{colors.warning}"
    textColor: "{colors.warning-deep}"
    rounded: "{rounded.sm}"
    padding: "0 24px"
    height: "42px"
  button-small:
    backgroundColor: "{colors.surface-input}"
    textColor: "{colors.text-strong}"
    rounded: "{rounded.sm}"
    padding: "0 14px"
    height: "35px"
  save-progress:
    backgroundColor: "{colors.panel-raised}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "36px"
  save-progress-saved:
    backgroundColor: "{colors.lime-wash-deep}"
    textColor: "{colors.lime}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "36px"
  save-progress-error:
    backgroundColor: "{colors.danger-deep}"
    textColor: "{colors.danger}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "36px"
  input:
    backgroundColor: "{colors.surface-input}"
    textColor: "{colors.text-strong}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "43px"
  nav-item:
    backgroundColor: "{colors.sidebar}"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.lg}"
    padding: "0 12px"
    height: "44px"
  nav-item-active:
    backgroundColor: "{colors.lime-wash-deep}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    padding: "0 12px"
    height: "44px"
  history-tab:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.md}"
    padding: "9px 13px"
  history-tab-active:
    backgroundColor: "{colors.lime-wash}"
    textColor: "{colors.lime}"
    rounded: "{rounded.md}"
    padding: "9px 13px"
  panel:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.text}"
    rounded: "{rounded.panel}"
    padding: "22px 24px"
  playing-card:
    backgroundColor: "#f4f4f5"
    textColor: "{colors.suit-spade-deep}"
    rounded: "{rounded.xs}"
    width: "34px"
    height: "40px"
  playing-card-heart:
    backgroundColor: "#f4f4f5"
    textColor: "{colors.suit-heart-deep}"
    rounded: "{rounded.xs}"
    width: "34px"
    height: "40px"
  playing-card-diamond:
    backgroundColor: "#f4f4f5"
    textColor: "{colors.suit-diamond-deep}"
    rounded: "{rounded.xs}"
    width: "34px"
    height: "40px"
  playing-card-club:
    backgroundColor: "#f4f4f5"
    textColor: "{colors.suit-club-deep}"
    rounded: "{rounded.xs}"
    width: "34px"
    height: "40px"
  calendar-day:
    backgroundColor: "{colors.surface-input}"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.sm}"
    height: "46px"
  calendar-day-reviewed:
    backgroundColor: "rgba(189,243,107,.14)"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    height: "46px"
  calendar-day-pending:
    backgroundColor: "rgba(239,201,119,.14)"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    height: "46px"
  calendar-day-draft:
    backgroundColor: "rgba(148,163,184,.14)"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    height: "46px"
  status-draft:
    backgroundColor: "{colors.draft-deep}"
    textColor: "{colors.draft-text}"
    rounded: "{rounded.xs}"
    padding: "4px 7px"
  status-pending:
    backgroundColor: "{colors.warning-deep}"
    textColor: "{colors.warning}"
    rounded: "{rounded.xs}"
    padding: "4px 7px"
  status-reviewed:
    backgroundColor: "{colors.lime-wash-deep}"
    textColor: "{colors.lime}"
    rounded: "{rounded.xs}"
    padding: "4px 7px"
---

# Design System: River Notes

## Overview

**Creative North Star: "La mesa de estudio nocturna"**

River Notes se ve como la mesa de poker que queda después de una sesión: fieltro verde muy oscuro, luz baja, cartas blancas que concentran la atención y un acento lima que marca lo que está vivo. La interfaz es densa y operativa, pero no fría: el espacio está construido con capas tonales de verde, bordes finos y una tipografía compacta que prioriza el escaneo.

El sistema no busca espectáculo. La identidad aparece en detalles precisos: la espada de la marca, los números de entrada en lima, la baraja de cuatro colores, el calendario de calor y la cita «Tu juego, en perspectiva». El movimiento es escaso y funcional: una entrada de página de 250 ms y un tooltip de 120 ms; no hay coreografía decorativa.

La densidad es deliberada. Los textos de apoyo viven entre 8 y 13 px, los controles entre 35 y 44 px, y los paneles entre 17 y 24 px de padding. El resultado debe sentirse como una herramienta de trabajo: rápida de leer, silenciosa y enfocada en la siguiente decisión.

**Key Characteristics:**
- Fondo verde nocturno con capas tonales, no superficies blancas.
- Lima como acento de acción, foco y estado activo.
- Bordes de 1 px y radios contenidos; las sombras se reservan para elevación real.
- Baraja de cuatro colores con ocho valores exactos.
- Historial completo, calendario de calor y archivo de revisiones como piezas de información, no decoración.
- Movimiento mínimo, con `prefers-reduced-motion` como límite.

## Colors

La paleta es una sala de poker nocturna: verdes profundos para el espacio, lima para la energía y ámbar para la atención. Los estados del historial añaden gris, ámbar y lima; la baraja introduce rojo, azul y verde saturados, pero solo dentro de las cartas.

### Primary

- **Lima de mesa** (`#bdf36b`): acento principal. Se usa en la acción primaria, el número de entrada, los eyebrows, el foco activo, los enlaces de acción y los estados revisados. No es un color de fondo a gran escala.
- **Lima encendida** (`#cbff7a`): hover de la acción primaria.
- **Lima profunda** (`#6a9a42`): bordes de foco, selección y hover de controles.
- **Lima lavada** (`#1e311b`) y **lima de estado** (`#203a1c`): fondos de pestañas activas, entradas seleccionadas y estados revisados.
- **Tinta lima** (`#15200f`): texto sobre la acción primaria.

### Secondary

- **Ámbar de advertencia** (`#efc977`): revisión pendiente, bloqueo, avisos y calendario pendiente. Es el color de «mira esto antes de seguir».
- **Ámbar profundo** (`#2e2717`): fondo del aviso de revisión y de los estados pendientes.

### Neutral

- **Tinta de sala** (`#080d0b`): fondo global del documento.
- **Tinta profunda** (`#0a0f0d`): fondo de la barra lateral y de la marca.
- **Panel** (`#111a16`): superficie principal de tarjetas y paneles.
- **Panel elevado** (`#131f1a`): tarjetas internas, disciplina y menús.
- **Barra lateral** (`#0d1512`): navegación fija.
- **Superficie de entrada** (`#0b120f`): inputs, listas, fichas y días del calendario.
- **Línea** (`#294034`): borde estándar de paneles, botones secundarios e inputs.
- **Línea suave** (`#23342b`): separadores de la barra lateral y la topbar.
- **Línea fuerte** (`#2a4034`): bordes de listas, tarjetas de entrada y controles.
- **Texto** (`#edf1ee`): texto principal.
- **Texto fuerte** (`#e8ece9`): texto de inputs y controles.
- **Texto apagado** (`#93a198`): párrafos, metadatos y ayudas.
- **Texto tenue** (`#7f9086`): notas al pie, etiquetas y texto secundario.

### Tertiary

- **Rojo de peligro** (`#dd8d84`): acciones destructivas y errores.
- **Rojo profundo** (`#2b1715`): fondo de errores.
- **Gris de borrador** (`#94a3b8`): puntos y estados de borrador.
- **Gris de borrador profundo** (`#292d2a`): fondo del estado borrador.
- **Texto de borrador** (`#aab0ac`): texto del estado borrador.

### Baraja de cuatro colores

- **Picas**: `#18181b` (profundo) y `#3f3f46` (suave). En el deck oscuro el glyph usa `#e4e4e7` para contraste; el borde conserva `#3f3f46`.
- **Corazones**: `#dc2626` (profundo) y `#ef4444` (suave).
- **Diamantes**: `#2563eb` (profundo) y `#3b82f6` (suave).
- **Tréboles**: `#16a34a` (profundo) y `#22c55e` (suave).

### Named Rules

**The Four-Color Deck Rule.** Cada palo tiene un color propio. Corazones y diamantes nunca comparten rojo; la baraja no se reduce a dos colores.

**The Lime Is an Accent Rule.** El lima señala acción, foco o estado activo; no cubre superficies completas ni compite con las cartas.

**The Status Is Not Only Color Rule.** Borrador, pendiente y revisada siempre llevan texto además del color.

## Typography

**Display Font:** Inter, con fallback a `ui-sans-serif`, `system-ui`, `-apple-system`, `BlinkMacSystemFont`, `"Segoe UI"` y sans-serif. No hay una webfont cargada: Inter se usa si está instalada; el sistema resuelve el resto.

**Body Font:** La misma pila que display.

**Label/Mono Font:** `"Cascadia Code", Consolas, monospace` para el formato canónico.

**Character:** Una sola familia compacta y funcional. La jerarquía se construye por tamaño, peso y color, no por mezcla de familias. El resultado se lee como una herramienta de mesa: densa, precisa y sin adornos.

### Hierarchy

- **Display** (700, `clamp(26px, 3vw, 34px)`, 1.12, `-0.025em`): título de página; una sola vez por superficie.
- **Headline** (700, 24px, 1.2): títulos de tarjetas grandes y del panel de promesa.
- **Title** (700, 17px, 1.3): títulos de panel, secciones y tarjetas de revisión.
- **Body** (400, 13px, 1.55): párrafos, descripciones y textos de análisis. En listas y metadatos baja a 10–12 px.
- **Label** (800, 10px, 1.4, `0.02em`): eyebrows, etiquetas de campo, códigos `[PR-EL]`, `[ERR-01]` y `[OK-01]`, y metadatos de estado.
- **Mono** (400, 11px, 1.65): bloque de formato canónico y datos técnicos.

### Named Rules

**The One Family Rule.** No se introduce una segunda familia para decorar; la jerarquía se resuelve con escala, peso y color.

**The Small Label Rule.** Las etiquetas pueden ser pequeñas, pero siempre deben tener contraste suficiente y acompañar al dato, no sustituirlo.

## Layout

El shell es una cuadrícula de `224px` para la barra lateral fija y `minmax(0, 1fr)` para el workspace. La topbar mide `80px`, es sticky y usa `backdrop-filter: blur(14px)` sobre `rgba(8,13,11,.94)`. El contenido principal tiene un máximo de `1220px`, centrado, con padding `30px 40px 20px` y un ritmo de `24px` entre bloques.

La barra lateral es fija, con padding `24px 12px`, borde derecho `#23342b` y navegación de 44 px por ítem. La marca usa una espada de 31 px con drop-shadow. En `max-width: 800px` la barra se convierte en una franja superior estática, la marca y la tarjeta de disciplina se ocultan, y la navegación pasa a cuatro columnas; en `max-width: 520px` pasa a dos columnas.

El historial usa `345px` para la lista y el resto para el detalle, con `24px` de separación. La revisión usa `minmax(0, 1.8fr)` para la mano activa y `minmax(300px, .95fr)` para las conclusiones; en `max-width: 1100px` la revisión se apila. El formulario usa tres columnas para datos, dos para el selector de cartas y `3fr 1fr 1fr` para el board. El calendario es una cuadrícula de siete columnas con `6px` de gap y días de `46px`.

Breakpoints observados: `1100px`, `800px` y `520px`, con un mínimo de `320px`. En `520px` los formularios y destinos de carta pasan a una columna, el filtro a una columna y el calendario reduce sus días a `36px`; el contador numérico del día se oculta y el tooltip se alinea a la izquierda.

### Named Rules

**The 224 Rule.** La barra lateral mide 224 px en escritorio; el workspace nunca queda por debajo de su contenido mínimo.

**The 1220 Rule.** El contenido no se estira más allá de 1220 px; la lectura y el escaneo mandan sobre el ancho disponible.

## Elevation & Depth

El sistema es principalmente plano y tonal. La profundidad se construye con capas de verde (`#080d0b`, `#0d1512`, `#111a16`, `#131f1a`) y bordes de 1 px; las sombras aparecen solo cuando un elemento se eleva de verdad: paneles, menús, toasts y cartas.

### Shadow Vocabulary

- **Panel** (`box-shadow: 0 12px 50px rgba(0,0,0,.08)`): sombra ambiental muy sutil bajo paneles.
- **Menú de guardado** (`box-shadow: 0 18px 50px rgba(0,0,0,.55)`): elevación real de un menú flotante.
- **Toast** (`box-shadow: 0 10px 40px #000`): confirmación flotante.
- **Carta** (`box-shadow: 0 2px 5px rgba(0,0,0,.18)`): separación de la carta blanca del fondo.
- **Foco de input** (`box-shadow: 0 0 0 3px rgba(189,243,107,.06)`): halo de foco.
- **Foco de revisión** (`box-shadow: 0 0 0 2px rgba(189,243,107,.08)`): marca activa del bloque.
- **Hoy** (`box-shadow: inset 0 0 0 1px #6a9a42`): anillo interior del día actual.

### Named Rules

**The Flat-By-Default Rule.** Las superficies están planas en reposo. La sombra aparece para elevar un menú, un toast o una carta, no para decorar cada panel.

**The Border Does the Work Rule.** La estructura se comunica con bordes de 1 px; la sombra es una excepción, no el sistema.

## Shapes

El lenguaje de formas es contenido y funcional. El radio dominante es `7px` para controles, inputs, pestañas y chips; `8px` para ítems de navegación y listas; `11px` para paneles; `5px` para cartas, estados y calendario; `16px` para chips tipo píldora y `50%` para la marca y los puntos de estado.

Las cartas son la excepción táctil: superficie blanca `#f4f4f5`, borde `#d4d4d8`, radio `5px` y una sombra mínima. En el deck oscuro, las cartas usan fondo `#0b120f`, borde de color de palo y un glyph claro; las cartas ya usadas se atenúan con opacidad `.55` y fondo `#243d20`.

No hay clipping agresivo ni formas orgánicas. Los paneles son rectángulos redondeados; los estados son píldoras pequeñas; el calendario es una cuadrícula de celdas.

### Named Rules

**The 7/11 Rule.** Controles a 7 px, paneles a 11 px. Si un elemento no encaja en esa escala, se justifica por su función (cartas a 5 px, chips a 16 px).

**The White Card Rule.** El blanco se reserva para las cartas; no se usa como fondo de página ni de panel.

## Components

### Buttons

- **Shape:** radio `6px`, altura mínima `42px`, padding `0 24px`, tipografía `12px/700`.
- **Primary:** fondo lima `#bdf36b`, texto `#15200f`; hover `#cbff7a`.
- **Secondary:** borde `#294034`, fondo `#0b120f`, texto `#e4e9e5`.
- **Warning:** fondo ámbar `#efc977`, texto `#2f2818`.
- **Danger:** borde `#5e302d`, fondo transparente, texto `#dd8d84`.
- **Small:** altura `35px`, padding `0 14px`, tipografía `10px`.
- **Focus:** borde lima y halo `0 0 0 3px rgba(189,243,107,.06)` en inputs; en botones, el foco visible usa el color de acento.
- **Disabled:** opacidad `.48` y cursor `not-allowed`.

### Save Progress

- **Shape:** altura `36px`, radio `7px`, borde `#365329`, fondo `#142218`, texto `#dbe6dd`, tipografía `11px/700`.
- **Hover:** borde `#6a9a42`, fondo `#1b2e1c`.
- **Saved:** borde `#6a9a42`, fondo `#203a1c`, texto `#bdf36b`.
- **Error:** borde `#6c3732`, fondo `#2b1715`, texto `#efaaa2`.
- **Menu:** ancho `270px`, fondo `#0f1914`, borde `#355043`, radio `9px`, sombra `0 18px 50px rgba(0,0,0,.55)`.

### Chips

- **Style:** altura `32px`, padding `0 13px`, radio `16px`, borde `#2d4337`, fondo `#0c130f`, texto `#98a79e`, tipografía `10px`.
- **Active:** borde `#496238`, fondo `#1e311b`, texto `#bdf36b`.

### Cards / Containers

- **Panel:** borde `#294034`, radio `11px`, fondo `#111a16`, sombra `0 12px 50px rgba(0,0,0,.08)`.
- **Internal padding:** `22px 24px` para paneles estándar; `24px` para revisión y análisis; `25px` para tarjetas de herramienta.
- **Entry list item:** borde `#2a4034`, radio `8px`, fondo `#0c130f`; activo con borde `#466d31` y fondo `#203a1c`.
- **Status pill:** radio `5px`, padding `4px 7px`, tipografía `8px`; borrador `#292d2a`/`#aab0ac`, pendiente `#3b2e17`/`#efc977`, revisada `#203a1c`/`#bdf36b`.

### Inputs / Fields

- **Style:** borde `#2a4034`, radio `7px`, fondo `#0b120f`, texto `#e8ece9`, altura mínima `43px`, padding `0 12px`.
- **Focus:** borde `#6e9f48` y halo `0 0 0 3px rgba(189,243,107,.06)`.
- **Placeholder:** `#5e7066`.
- **Textarea:** padding `12px`, `line-height: 1.55`, redimensionado vertical.
- **Labels:** `10px`, color `#9aa8a0`, separadas del control por `7px`.

### Navigation

- **Desktop:** barra fija de `224px`, fondo `#0d1512`, borde derecho `#23342b`; ítem de `44px`, radio `8px`, texto `#9baa9f` a `12px`, número de sección a `11px`.
- **Active:** fondo `#253f20`, texto `#f2f4f2`, número lima, peso `700`.
- **Hover:** fondo `#131e19`, texto `#e8eee9`.
- **Mobile:** en `800px` la barra se vuelve una franja superior; la navegación pasa a cuatro columnas y luego a dos en `520px`.

### Playing Cards

- **Card:** `34×40px`, radio `5px`, fondo `#f4f4f5`, borde `#d4d4d8`, tipografía `16px/800`, sombra `0 2px 5px rgba(0,0,0,.18)`.
- **Compact:** `28×32px`, tipografía `13px`; mini `24×27px`, tipografía `11px`.
- **Suits:** picas `#18181b`, corazones `#dc2626`, diamantes `#2563eb`, tréboles `#16a34a`; el deck oscuro usa las variantes suaves y un glyph claro para picas.
- **Deck:** carta de `34px` de alto, fondo `#0b120f`, borde por palo; usada con opacidad `.55` y fondo `#243d20`; hover con borde lima y fondo `#1d301a`.

### History Tabs

- **Style:** padding `9px 13px`, radio `7px`, texto `#91a198` a `10px/700`, borde transparente.
- **Active:** borde `#496238`, fondo `#1e311b`, texto `#bdf36b`.
- **Hover:** fondo `#15231b`, texto `#dbe6dd`.
- **Overflow:** en móvil las pestañas no se envuelven; se desplazan horizontalmente.

### Calendar

- **Grid:** siete columnas, gap `6px`, día mínimo `46px`, radio `6px`, borde `#25382f`, fondo `#0b120f`, texto `#93a198` a `10px`.
- **Heat:** niveles de alpha `.14`, `.24`, `.36`, `.5`; pendiente ámbar, revisada lima, borrador gris, mixto con gradiente de 135°.
- **Today:** anillo interior `#6a9a42`; **selected:** outline `2px #bdf36b` con offset `1px`.
- **Day count:** píldora `#0a100d` con texto `#eaf0eb` a `8px`; se oculta en `800px`.
- **Tooltip:** fondo `#1c2a22`, borde `#3a5544`, radio `7px`, texto `#e8eee9` a `10px`, opacidad `.12s ease`.

### Review Archive

- **Summary:** grid `95px minmax(0,1fr) auto auto 18px`, gap `12px`, padding `14px 4px`, borde inferior `#2a3c33`; hover `#15231b`.
- **ID:** lima `#bdf36b`, `9px/800`; título `12px`; fecha `9px` en `#819188`; contador de manos en píldora con borde `#314b3b`.
- **Conclusions:** tres columnas con fondo `#0c130f`, borde `#2a4034`, radio `7px`, padding `12px`; el título de cada conclusión es lima a `9px/800`.
- **Hands:** grid `repeat(auto-fit, minmax(230px, 1fr))`, gap `10px`, tarjetas con borde `#2a4034`, radio `8px`, fondo `#0c130f`.

### Feedback

- **Error box:** borde `#6c3732`, fondo `#2b1715`, texto `#efaaa2`, radio `8px`, padding `14px 18px`.
- **Toast:** fijo abajo a la derecha, borde `#476b36`, fondo `#182717`, texto `#cafa83`, radio `8px`, padding `13px 18px`, sombra `0 10px 40px #000`.
- **Empty state:** centrado, mínimo `300px`, texto `#82938a`; la variante de revisión usa una marca lima de `30px`.

## Do's and Don'ts

### Do:

- **Do** conservar la jerarquía tonal verde: `#080d0b` → `#0d1512` → `#111a16` → `#131f1a`.
- **Do** usar lima `#bdf36b` para acción primaria, foco, eyebrows y estados activos; el acento debe seguir siendo escaso.
- **Do** mantener la baraja de cuatro colores con los ocho valores exactos y el glyph claro de picas sobre el deck oscuro.
- **Do** acompañar cada estado con texto: `Borrador`, `Completada - Pendiente`, `Completada - Revisada`.
- **Do** usar radio `7px` en controles y `11px` en paneles; `5px` en cartas y estados.
- **Do** conservar la barra lateral de `224px`, el contenido máximo de `1220px` y los breakpoints `1100/800/520`.
- **Do** reservar el blanco `#f4f4f5` para las cartas y mantener el fondo de página en verde nocturno.
- **Do** respetar `prefers-reduced-motion`: la entrada de página y el tooltip son los únicos movimientos base.

### Don't:

- **Don't** convertir el lima en fondo de paneles o páginas completas.
- **Don't** pintar corazones y diamantes del mismo rojo; la baraja perdería su lectura de cuatro colores.
- **Don't** ocultar borradores, entradas pendientes, entradas revisadas ni bloques cerrados para «limpiar» la interfaz.
- **Don't** sustituir los estados por color sin texto; el color no es el único código.
- **Don't** añadir sombras decorativas a cada tarjeta; el sistema es plano por defecto.
- **Don't** introducir una segunda familia tipográfica o una webfont solo por estética.
- **Don't** usar animaciones largas o rebotes en una herramienta de trabajo; el movimiento debe explicar estado, no entretener.
- **Don't** cambiar los ocho valores de la baraja, los textos funcionales ni los selectores que usan las pruebas.
