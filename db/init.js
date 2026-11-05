'use strict';

const db = require('./index');

const objetos = db
  .prepare(`
    SELECT type, name
      FROM sqlite_master
     WHERE type IN ('table', 'view', 'trigger', 'index')
       AND name NOT LIKE 'sqlite_%'
       AND name NOT LIKE 'idx_%'
     ORDER BY type, name
  `)
  .all();

console.log('Base de datos:', db.DB_PATH);
console.log('SQLite:', db.prepare('SELECT sqlite_version() AS v').get().v);
console.table(objetos);

const conteos = {
  usuarios: db.prepare('SELECT COUNT(*) AS n FROM usuarios').get().n,
  libros: db.prepare('SELECT COUNT(*) AS n FROM libros').get().n,
  prestamos: db.prepare('SELECT COUNT(*) AS n FROM prestamos').get().n
};

console.log('Registros:', conteos);
