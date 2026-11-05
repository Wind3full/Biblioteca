# Biblioteca

Sistema de gestión de biblioteca para un centro educativo: catálogo de libros,
usuarios (alumnos/profesores), préstamos, devoluciones e historial.

## Requisitos

- **Node.js**: probado con **v22.23.3 (LTS)**. `better-sqlite3` soporta las versiones
  `20.x` y `>=22`; se recomienda Node 22 LTS.
- **npm**: 10 o superior.

## Instalación

```bash
npm install
```

## Base de datos

Se usa SQLite en el archivo local `library.db` (raíz del proyecto, ignorado por Git).
El esquema (`db/schema.sql`) se aplica automáticamente la primera vez que se importa
`db/index.js`, por lo que no hace falta crearlo a mano.

```bash
npm run db:init    # crea el esquema y muestra tablas, vistas y triggers
npm run db:seed    # inserta datos de ejemplo (solo si la BD está vacía)
npm run db:reset   # elimina y recrea library.db desde cero
```

## Iniciar la aplicación

Estado actual: **capa de base de datos implementada**. El servidor Express (`server.js`)
y el frontend todavía están pendientes, por lo que `npm start` no funcionará hasta
que se añadan.

Una vez exista `server.js`, el arranque previsto es:

```bash
npm start       # producción
npm run dev     # desarrollo con recarga automática (node --watch)
```

La aplicación se servirá en `http://localhost:3000` (puerto pendiente de definir).

## Estructura

```
db/
  schema.sql   Tablas, índices, triggers y vistas
  index.js     Conexión SQLite y creación automática del esquema
  init.js      Inspección de la base de datos
  seed.js      Datos de ejemplo
  reset.js     Recreación de la base de datos
library.db     Base de datos local (generada)
```
