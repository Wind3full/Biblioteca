'use strict';

const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'library.db');

for (const archivo of [DB_PATH, `${DB_PATH}-wal`, `${DB_PATH}-shm`]) {
  if (fs.existsSync(archivo)) {
    fs.unlinkSync(archivo);
  }
}

const db = require('./index');
db.prepare('SELECT 1').get();

console.log('Base de datos recreada en:', DB_PATH);
