'use strict';
// Biblioteca Escolar - API REST (Express)
// La BD (esquema, triggers, vistas) la gestiona db/. Este archivo NO crea tablas
// ni toca ejemplares_disponibles: eso lo hacen los triggers.
const express = require('express');
const cors = require('cors');
const path = require('node:path');
const db = require('./db');

db.pragma('foreign_keys = ON'); // necesario para que ON DELETE RESTRICT funcione

const PORT = process.env.PORT || 3000;
const DIAS_PRESTAMO = Number(process.env.DIAS_PRESTAMO || 14);
const LIMITE_POR_ROL = { alumno: 3, profesor: 10, bibliotecario: 10, administrador: 10 };

class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const wrap = (fn) => (req, res, next) => { try { fn(req, res, next); } catch (e) { next(e); } };
const pick = (obj, keys) => Object.fromEntries(keys.filter(k => obj[k] !== undefined).map(k => [k, obj[k]]));

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => res.json({ ok: true }));

// ============ LIBROS ============
const CAMPOS_LIBRO = ['titulo', 'autor', 'isbn', 'categoria', 'editorial', 'anio_publicacion',
  'ejemplares_total', 'ubicacion', 'sinopsis', 'portada_url', 'estado'];
const getLibro = db.prepare('SELECT * FROM vista_libros WHERE id = ?');

// ?q=texto  ?categoria=  ?estado=activo|baja  ?disponibles=1
app.get('/api/libros', wrap((req, res) => {
  const where = []; const p = {};
  if (req.query.q) { where.push('(titulo LIKE @q OR autor LIKE @q OR isbn LIKE @q)'); p.q = `%${req.query.q}%`; }
  if (req.query.categoria) { where.push('categoria = @categoria'); p.categoria = req.query.categoria; }
  if (req.query.estado) { where.push('estado = @estado'); p.estado = req.query.estado; }
  if (req.query.disponibles === '1') where.push('ejemplares_disponibles > 0');
  const sql = `SELECT * FROM vista_libros ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY titulo`;
  res.json(db.prepare(sql).all(p));
}));

app.get('/api/libros/:id', wrap((req, res) => {
  const l = getLibro.get(req.params.id);
  if (!l) throw new HttpError(404, 'Libro no encontrado');
  res.json(l);
}));

app.post('/api/libros', wrap((req, res) => {
  const d = pick(req.body, CAMPOS_LIBRO);
  if (!d.titulo) throw new HttpError(400, 'titulo es obligatorio');
  d.ejemplares_total = Number(d.ejemplares_total ?? 1);
  if (!Number.isInteger(d.ejemplares_total) || d.ejemplares_total < 0) throw new HttpError(400, 'ejemplares_total inválido');
  d.ejemplares_disponibles = d.ejemplares_total; // al crear, todos disponibles
  const cols = Object.keys(d);
  const r = db.prepare(`INSERT INTO libros (${cols.join(',')}) VALUES (${cols.map(c => '@' + c).join(',')})`).run(d);
  res.status(201).json(getLibro.get(r.lastInsertRowid));
}));

app.put('/api/libros/:id', wrap((req, res) => {
  const l = getLibro.get(req.params.id);
  if (!l) throw new HttpError(404, 'Libro no encontrado');
  const d = pick(req.body, CAMPOS_LIBRO);
  if (d.ejemplares_total !== undefined) {
    d.ejemplares_total = Number(d.ejemplares_total);
    // El trigger hace MAX(0, ...) y ocultaría el error: validamos aquí
    if (!Number.isInteger(d.ejemplares_total) || d.ejemplares_total < l.ejemplares_prestados)
      throw new HttpError(400, `ejemplares_total no puede ser menor que los prestados (${l.ejemplares_prestados})`);
  }
  const cols = Object.keys(d);
  if (!cols.length) throw new HttpError(400, 'Nada que actualizar');
  db.prepare(`UPDATE libros SET ${cols.map(c => `${c}=@${c}`).join(',')} WHERE id=@id`).run({ ...d, id: l.id });
  res.json(getLibro.get(l.id));
}));

// Baja lógica (se conserva el historial). ?definitivo=1 borra si nunca se prestó.
app.delete('/api/libros/:id', wrap((req, res) => {
  const l = getLibro.get(req.params.id);
  if (!l) throw new HttpError(404, 'Libro no encontrado');
  if (l.ejemplares_prestados > 0) throw new HttpError(409, 'No se puede dar de baja: tiene préstamos activos');
  if (req.query.definitivo === '1') {
    db.prepare('DELETE FROM libros WHERE id = ?').run(l.id); // falla con FK si tiene historial
    return res.status(204).end();
  }
  db.prepare(`UPDATE libros SET estado='baja' WHERE id=?`).run(l.id);
  res.json(getLibro.get(l.id));
}));

// ============ USUARIOS ============
const CAMPOS_USUARIO = ['nombre', 'apellidos', 'email', 'telefono', 'dni', 'rol', 'estado_membresia'];
const getUsuario = db.prepare('SELECT * FROM usuarios WHERE id = ?');

// ?q=  ?rol=  ?estado_membresia=
app.get('/api/usuarios', wrap((req, res) => {
  const where = []; const p = {};
  if (req.query.q) { where.push(`(nombre || ' ' || apellidos LIKE @q OR email LIKE @q OR dni LIKE @q)`); p.q = `%${req.query.q}%`; }
  if (req.query.rol) { where.push('rol = @rol'); p.rol = req.query.rol; }
  if (req.query.estado_membresia) { where.push('estado_membresia = @em'); p.em = req.query.estado_membresia; }
  const sql = `SELECT u.*, (SELECT COUNT(*) FROM prestamos p WHERE p.usuario_id=u.id AND p.estado='activo') AS prestamos_activos
               FROM usuarios u ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY apellidos, nombre`;
  res.json(db.prepare(sql).all(p));
}));

app.get('/api/usuarios/:id', wrap((req, res) => {
  const u = getUsuario.get(req.params.id);
  if (!u) throw new HttpError(404, 'Usuario no encontrado');
  res.json(u);
}));

app.get('/api/usuarios/:id/prestamos', wrap((req, res) => {
  if (!getUsuario.get(req.params.id)) throw new HttpError(404, 'Usuario no encontrado');
  res.json(db.prepare('SELECT * FROM vista_prestamos_detalle WHERE usuario_id = ? ORDER BY id DESC').all(req.params.id));
}));

app.post('/api/usuarios', wrap((req, res) => {
  const d = pick(req.body, CAMPOS_USUARIO);
  if (!d.nombre || !d.email) throw new HttpError(400, 'nombre y email son obligatorios');
  const cols = Object.keys(d);
  const r = db.prepare(`INSERT INTO usuarios (${cols.join(',')}) VALUES (${cols.map(c => '@' + c).join(',')})`).run(d);
  res.status(201).json(getUsuario.get(r.lastInsertRowid));
}));

app.put('/api/usuarios/:id', wrap((req, res) => {
  const u = getUsuario.get(req.params.id);
  if (!u) throw new HttpError(404, 'Usuario no encontrado');
  const d = pick(req.body, CAMPOS_USUARIO);
  const cols = Object.keys(d);
  if (!cols.length) throw new HttpError(400, 'Nada que actualizar');
  db.prepare(`UPDATE usuarios SET ${cols.map(c => `${c}=@${c}`).join(',')} WHERE id=@id`).run({ ...d, id: u.id });
  res.json(getUsuario.get(u.id));
}));

// Baja lógica: estado_membresia = 'inactiva'. ?definitivo=1 borra si no tiene historial.
app.delete('/api/usuarios/:id', wrap((req, res) => {
  const u = getUsuario.get(req.params.id);
  if (!u) throw new HttpError(404, 'Usuario no encontrado');
  const activos = db.prepare(`SELECT COUNT(*) n FROM prestamos WHERE usuario_id=? AND estado='activo'`).get(u.id).n;
  if (activos > 0) throw new HttpError(409, 'No se puede dar de baja: tiene préstamos activos');
  if (req.query.definitivo === '1') {
    db.prepare('DELETE FROM usuarios WHERE id = ?').run(u.id);
    return res.status(204).end();
  }
  db.prepare(`UPDATE usuarios SET estado_membresia='inactiva' WHERE id=?`).run(u.id);
  res.json(getUsuario.get(u.id));
}));

// ============ PRÉSTAMOS ============
const getPrestamo = db.prepare('SELECT * FROM vista_prestamos_detalle WHERE id = ?');

// ?estado=activo|devuelto|perdido|cancelado  ?retrasados=1  ?usuario_id=  ?libro_id=
app.get('/api/prestamos', wrap((req, res) => {
  const where = []; const p = {};
  for (const k of ['estado', 'usuario_id', 'libro_id']) if (req.query[k]) { where.push(`${k} = @${k}`); p[k] = req.query[k]; }
  if (req.query.retrasados === '1') where.push('retrasado = 1');
  const sql = `SELECT * FROM vista_prestamos_detalle ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC`;
  res.json(db.prepare(sql).all(p));
}));

app.get('/api/prestamos/vencidos', wrap((req, res) => {
  res.json(db.prepare('SELECT * FROM vista_prestamos_vencidos ORDER BY dias_retraso DESC').all());
}));

app.get('/api/prestamos/:id', wrap((req, res) => {
  const p = getPrestamo.get(req.params.id);
  if (!p) throw new HttpError(404, 'Préstamo no encontrado');
  res.json(p);
}));

// Crear préstamo. Stock y libro activo los valida el trigger; aquí las reglas del usuario.
const crearPrestamo = db.transaction(({ libro_id, usuario_id, dias, observaciones }) => {
  const u = getUsuario.get(usuario_id);
  if (!u) throw new HttpError(404, 'Usuario no encontrado');
  if (u.estado_membresia !== 'activa') throw new HttpError(409, `Membresía ${u.estado_membresia}: no puede pedir préstamos`);

  const s = db.prepare(`
    SELECT COUNT(*) AS activos,
           SUM(date(fecha_vencimiento) < date('now','localtime')) AS retrasados,
           SUM(libro_id = @libro_id) AS mismo_libro
    FROM prestamos WHERE usuario_id = @usuario_id AND estado = 'activo'`).get({ usuario_id, libro_id });
  if (s.retrasados > 0) throw new HttpError(409, 'El usuario tiene préstamos con retraso sin devolver');
  if (s.mismo_libro > 0) throw new HttpError(409, 'El usuario ya tiene este libro prestado');
  const limite = LIMITE_POR_ROL[u.rol] ?? 3;
  if (s.activos >= limite) throw new HttpError(409, `Límite de ${limite} préstamos alcanzado (${u.rol})`);

  return db.prepare(`
    INSERT INTO prestamos (libro_id, usuario_id, fecha_vencimiento, observaciones)
    VALUES (@libro_id, @usuario_id, date('now','localtime', @plazo), @observaciones)`)
    .run({ libro_id, usuario_id, plazo: `+${dias} days`, observaciones: observaciones ?? null }).lastInsertRowid;
});

app.post('/api/prestamos', wrap((req, res) => {
  const libro_id = Number(req.body.libro_id), usuario_id = Number(req.body.usuario_id);
  const dias = Number(req.body.dias ?? DIAS_PRESTAMO);
  if (!libro_id || !usuario_id) throw new HttpError(400, 'libro_id y usuario_id son obligatorios');
  if (!Number.isInteger(dias) || dias < 1 || dias > 90) throw new HttpError(400, 'dias debe estar entre 1 y 90');
  const id = crearPrestamo({ libro_id, usuario_id, dias, observaciones: req.body.observaciones });
  res.status(201).json(getPrestamo.get(id));
}));

// Cerrar préstamo: el trigger libera el ejemplar
function cerrar(estadoFinal) {
  return wrap((req, res) => {
    const p = getPrestamo.get(req.params.id);
    if (!p) throw new HttpError(404, 'Préstamo no encontrado');
    if (p.estado !== 'activo') throw new HttpError(409, `El préstamo ya está ${p.estado}`);
    db.prepare(`UPDATE prestamos SET estado=@estado,
                fecha_devolucion = CASE WHEN @estado='devuelto' THEN date('now','localtime') ELSE fecha_devolucion END,
                observaciones = COALESCE(@obs, observaciones) WHERE id=@id`)
      .run({ estado: estadoFinal, obs: req.body?.observaciones ?? null, id: p.id });
    res.json(getPrestamo.get(p.id));
  });
}
app.post('/api/prestamos/:id/devolver', cerrar('devuelto'));
app.post('/api/prestamos/:id/perdido', cerrar('perdido'));
app.post('/api/prestamos/:id/cancelar', cerrar('cancelado'));

app.post('/api/prestamos/:id/renovar', wrap((req, res) => {
  const dias = Number(req.body?.dias ?? 7);
  if (!Number.isInteger(dias) || dias < 1 || dias > 90) throw new HttpError(400, 'dias debe estar entre 1 y 90');
  const p = getPrestamo.get(req.params.id);
  if (!p) throw new HttpError(404, 'Préstamo no encontrado');
  if (p.estado !== 'activo') throw new HttpError(409, 'Solo se renuevan préstamos activos');
  if (p.retrasado) throw new HttpError(409, 'No se puede renovar un préstamo con retraso');
  db.prepare('UPDATE prestamos SET fecha_vencimiento = date(fecha_vencimiento, ?) WHERE id = ?').run(`+${dias} days`, p.id);
  res.json(getPrestamo.get(p.id));
}));

// ============ DASHBOARD ============
app.get('/api/stats', wrap((req, res) => {
  const n = (sql) => db.prepare(sql).get().n;
  res.json({
    libros: n(`SELECT COUNT(*) n FROM libros WHERE estado='activo'`),
    ejemplares_total: n(`SELECT COALESCE(SUM(ejemplares_total),0) n FROM libros WHERE estado='activo'`),
    ejemplares_disponibles: n(`SELECT COALESCE(SUM(ejemplares_disponibles),0) n FROM libros WHERE estado='activo'`),
    usuarios_activos: n(`SELECT COUNT(*) n FROM usuarios WHERE estado_membresia='activa'`),
    prestamos_activos: n(`SELECT COUNT(*) n FROM prestamos WHERE estado='activo'`),
    prestamos_vencidos: n('SELECT COUNT(*) n FROM vista_prestamos_vencidos'),
  });
}));

// ============ ERRORES ============
app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));
app.use((err, req, res, next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido' });
  const code = err.code || '';
  if (code === 'SQLITE_CONSTRAINT_TRIGGER') return res.status(409).json({ error: err.message }); // RAISE de los triggers
  if (code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: 'Ya existe un registro con ese ISBN, email o DNI' });
  if (code === 'SQLITE_CONSTRAINT_FOREIGNKEY') return res.status(409).json({ error: 'Tiene registros relacionados (historial de préstamos)' });
  if (code === 'SQLITE_CONSTRAINT_CHECK') return res.status(400).json({ error: 'Valor no permitido (rol, estado, fechas o ejemplares)' });
  if (code === 'SQLITE_CONSTRAINT_NOTNULL') return res.status(400).json({ error: 'Falta un campo obligatorio' });
  console.error(err);
  res.status(500).json({ error: 'Error interno' });
});

app.listen(PORT, () => console.log(`Biblioteca API en http://localhost:${PORT}`));