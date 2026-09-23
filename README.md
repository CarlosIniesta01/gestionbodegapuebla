# Cellar Command Center

Quiero crear una aplicación moderna para bodegas y cooperativas vinícolas enfocada en gestión operativa, comunicación interna y trazabilidad visual en tiempo real.

NO quiero un ERP complejo.

NO quiero sustituir el software oficial de trazabilidad.

La app debe funcionar como:

- centro de control de bodega

- panel operativo visual

- sistema interno de coordinación

- trazabilidad rápida y sencilla

- mapa vivo de depósitos y procesos

# OBJETIVO PRINCIPAL

La aplicación debe permitir:

- registrar trabajos diarios

- controlar trasiegos y elaboraciones

- visualizar el estado de todos los depósitos

- coordinar operarios y enólogos

- gestionar tareas

- mantener histórico técnico

- mejorar la trazabilidad interna

- ver procesos abiertos en tiempo real

Debe ser:

- muy visual

- muy rápida

- mobile-first

- táctil

- moderna

- simple de usar en bodega

Inspiración:

- SCADA industrial

- centro de control

- dashboard operativo

- Trello + WhatsApp + trazabilidad de bodega

# TECNOLOGÍA

Frontend:

- React

- Tailwind

- Framer Motion

- SVG interactivo

Backend:

- Supabase

- Realtime

- PostgreSQL

- RLS

Optimizada para:

- móvil

- tablet

- escritorio

# ESTRUCTURA GENERAL

## Menú principal

- Inicio

- Trabajos

- Pendientes

- Actividad

- Mensajes

- Recetas

- Bodega

- Admin

# 1. MAPA INTERACTIVO DE BODEGA

La app debe tener un mapa visual completamente interactivo.

NO usar imágenes estáticas.

Usar:

- SVG interactivo

- componentes React

- tiempo real

# ZONAS DE BODEGA

Ejemplo actual:

## Zona Exterior

- DP-1 → DP-36

## Autovaciantes

- AUTO-01 → AUTO-10

## Zona Decanter

- L-01 → L-04

## Nave Interior N

- N-1 → N-12

## Nave Interior D

- D-1 → D-23

Cada depósito debe ser:

- círculo interactivo

- clickable

- táctil

- animable

- con color dinámico

# ESTADOS DE DEPÓSITOS

Cada depósito puede estar:

- Vacío

- Mosto

- Fermentación

- Vino terminado

- En limpieza

- En trasiego

- Incidencia

Colores:

- Vacío → gris

- Mosto → naranja

- Fermentación → verde

- Vino terminado → burdeos

- Limpieza → azul

- Trasiego → amarillo/dorado

- Incidencia → rojo

# INFORMACIÓN DE DEPÓSITO

Al pulsar un depósito:

abrir panel lateral mostrando:

- nombre

- zona

- litros actuales

- capacidad

- porcentaje llenado

- contenido/variedad

- último movimiento

- historial

- tareas activas

- chat relacionado

# 2. PROCESOS ABIERTOS

Todos los trabajos iniciados deben quedar registrados como procesos activos.

Ejemplos:

- trasiego

- limpieza

- vendimia

- embotellado

- producto enológico

Funcionamiento:

- botón iniciar

- estado en proceso

- persistente aunque se cierre la app

- botón verde mientras esté activo

- botón finalizar

Al finalizar:

- guardar histórico

- actualizar mapa

- actualizar litros

- actualizar porcentajes

- mover a actividad/movimientos

# 3. TRASIEGOS EN TIEMPO REAL

Cuando un trasiego esté activo:

- dibujar línea entre depósito origen y destino

- animación fluida

- flujo visual

- tiempo real

Al finalizar:

- actualizar litros origen

- actualizar litros destino

- actualizar porcentajes

- actualizar variedad/contenido

Ejemplo:

Depósito D-18:

- capacidad 40.000L

- trasiego recibido 20.000L

Resultado:

- porcentaje 50%

- contenido: Airén 2024

# 4. NUEVO TRABAJO

Pantalla visual y táctil.

No usar formularios largos.

Mostrar:

- tarjetas grandes

- iconos

- diseño circular/hexagonal

Opciones:

- Trasiego

- Depósitos Vendimia

- Producto Enológico

- Limpieza

- Embotellado

- Incidencia

- Observación

Al seleccionar:

- ocultar menú inicial

- mostrar solo formulario correspondiente

# 5. DEPÓSITOS VENDIMIA

Sistema para indicar depósitos llenándose durante vendimia.

Flujo:

1. seleccionar familia

2. seleccionar depósito

3. iniciar llenado

4. proceso activo

5. finalizar llenado

Mientras está activo:

- animación visual

- color verde

- ondas

- visible en mapa

# 6. TAREAS Y ENÓLOGO

Crear sistema de tareas internas.

Rol:

- Enólogo

El enólogo puede:

- crear tareas

- solicitar trasiegos

- solicitar limpiezas

- solicitar elaboraciones

Las tareas aparecen en:

- Pendientes

- Dashboard

- Mapa

- Notificaciones

Tipos:

- Trasiego

- Limpieza

- Producto enológico

- Embotellado

- Elaboración

- Incidencia

# 7. CHAT INTERNO

Sistema de chat integrado.

Tipos:

- chat general

- grupos

- chat por tarea

- chat por movimiento

Funciones:

- mensajes

- notificaciones

- historial

- mensajes no leídos

# 8. NOTIFICACIONES EN TIEMPO REAL

Notificaciones internas tipo toast.

Ejemplos:

- “Juan inició trasiego D12 → D18”

- “Nueva tarea del enólogo”

- “Limpieza finalizada”

- “Nuevo mensaje”

Usar Supabase Realtime.

# 9. RECETAS Y ELABORACIONES

Sistema reutilizable de recetas.

Cada receta:

- nombre

- familia

- productos utilizados

- dosis

- lote

- observaciones

Permitir:

- reutilizar recetas

- favoritas

- historial

- filtros por familia

# 10. MOVIMIENTOS Y ACTIVIDAD

Pantalla tipo timeline/dashboard.

Permitir:

- editar movimientos

- eliminar movimientos

- auditoría completa

- filtros

- búsqueda

Registrar:

- quién edita

- qué cambia

- fecha/hora

# 11. ROLES Y PERMISOS

Roles:

- Administrador

- Responsable

- Enólogo

- Operario

- personalizados

Sistema granular de permisos.

# 12. MULTI-BODEGA

La app debe soportar varias bodegas.

Cada bodega tendrá:

- usuarios propios

- depósitos propios

- recetas propias

- mapas propios

- tareas propias

Usar:

- organization_id

- bodega_id

Aplicar correctamente:

- RLS

- permisos

- aislamiento de datos

# 13. EXPERIENCIA VISUAL

La app debe sentirse:

- industrial moderna

- visual

- operativa

- elegante

- rápida

NO debe parecer:

- ERP antiguo

- panel administrativo aburrido

Debe parecer:

- centro operativo de bodega

- sistema vivo

- panel en tiempo real

# 14. IMPORTANTE

Prioridades:

1. estabilidad

2. tiempo real

3. UX móvil

4. claridad visual

5. simplicidad operativa

NO añadir complejidad innecesaria.

Todo debe ser rápido y usable en bodega real.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://gestionbodegapuebla.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/2bd8af57-c2af-4f46-8729-ddfa654111d0).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
