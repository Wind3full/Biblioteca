-- ============================================================
-- Sistema de Gestión de Biblioteca Escolar
-- Esquema SQLite
-- ============================================================

-- ------------------------------------------------------------
-- USUARIOS (alumnos, profesores, bibliotecarios, administradores)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre            TEXT    NOT NULL,
  apellidos         TEXT    NOT NULL DEFAULT '',
  email             TEXT    NOT NULL UNIQUE,
  telefono          TEXT,
  dni               TEXT    UNIQUE,
  rol               TEXT    NOT NULL DEFAULT 'alumno'
                    CHECK (rol IN ('alumno', 'profesor', 'bibliotecario', 'administrador')),
  estado_membresia  TEXT    NOT NULL DEFAULT 'activa'
                    CHECK (estado_membresia IN ('activa', 'suspendida', 'vencida', 'inactiva')),
  fecha_alta        TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  created_at        TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at        TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- ------------------------------------------------------------
-- LIBROS
-- ejemplares_disponibles se mantiene automáticamente mediante
-- los triggers definidos más abajo.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS libros (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  titulo                 TEXT    NOT NULL,
  autor                  TEXT    NOT NULL DEFAULT '',
  isbn                   TEXT    UNIQUE,
  categoria              TEXT,
  editorial              TEXT,
  anio_publicacion       INTEGER
                         CHECK (anio_publicacion IS NULL OR anio_publicacion BETWEEN 0 AND 9999),
  ejemplares_total       INTEGER NOT NULL DEFAULT 1
                         CHECK (ejemplares_total >= 0),
  ejemplares_disponibles INTEGER NOT NULL DEFAULT 1
                         CHECK (ejemplares_disponibles >= 0),
  ubicacion              TEXT,
  sinopsis               TEXT,
  portada_url            TEXT,
  estado                 TEXT    NOT NULL DEFAULT 'activo'
                         CHECK (estado IN ('activo', 'baja')),
  created_at             TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at             TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  CHECK (ejemplares_disponibles <= ejemplares_total)
);

-- ------------------------------------------------------------
-- PRÉSTAMOS
-- Una fila por préstamo. El historial completo son todas las
-- filas; los préstamos abiertos son estado = 'activo'.
-- 'retrasado' NO se almacena: se calcula con la vista
-- vista_prestamos_vencidos a partir de fecha_vencimiento.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS prestamos (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  libro_id          INTEGER NOT NULL,
  usuario_id        INTEGER NOT NULL,
  fecha_prestamo    TEXT    NOT NULL DEFAULT (date('now', 'localtime')),
  fecha_vencimiento TEXT    NOT NULL,
  fecha_devolucion  TEXT,
  estado            TEXT    NOT NULL DEFAULT 'activo'
                    CHECK (estado IN ('activo', 'devuelto', 'perdido', 'cancelado')),
  observaciones     TEXT,
  created_at        TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at        TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (libro_id)   REFERENCES libros(id)   ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CHECK (fecha_vencimiento >= fecha_prestamo),
  CHECK (fecha_devolucion IS NULL OR fecha_devolucion >= fecha_prestamo),
  CHECK (estado <> 'devuelto' OR fecha_devolucion IS NOT NULL)
);

-- ------------------------------------------------------------
-- ÍNDICES
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_libros_titulo         ON libros (titulo);
CREATE INDEX IF NOT EXISTS idx_libros_autor          ON libros (autor);
CREATE INDEX IF NOT EXISTS idx_libros_categoria      ON libros (categoria);
CREATE INDEX IF NOT EXISTS idx_libros_estado         ON libros (estado);

CREATE INDEX IF NOT EXISTS idx_usuarios_rol          ON usuarios (rol);
CREATE INDEX IF NOT EXISTS idx_usuarios_membresia    ON usuarios (estado_membresia);

CREATE INDEX IF NOT EXISTS idx_prestamos_libro       ON prestamos (libro_id);
CREATE INDEX IF NOT EXISTS idx_prestamos_usuario     ON prestamos (usuario_id);
CREATE INDEX IF NOT EXISTS idx_prestamos_estado      ON prestamos (estado);
CREATE INDEX IF NOT EXISTS idx_prestamos_vencimiento ON prestamos (fecha_vencimiento);

-- ------------------------------------------------------------
-- TRIGGERS: updated_at automático
-- (recursive_triggers está desactivado por defecto, por lo que
--  estas actualizaciones no vuelven a disparar los triggers)
-- ------------------------------------------------------------
CREATE TRIGGER IF NOT EXISTS trg_usuarios_updated_at
AFTER UPDATE ON usuarios
FOR EACH ROW
BEGIN
  UPDATE usuarios
     SET updated_at = datetime('now', 'localtime')
   WHERE id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_libros_updated_at
AFTER UPDATE ON libros
FOR EACH ROW
BEGIN
  UPDATE libros
     SET updated_at = datetime('now', 'localtime')
   WHERE id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_prestamos_updated_at
AFTER UPDATE ON prestamos
FOR EACH ROW
BEGIN
  UPDATE prestamos
     SET updated_at = datetime('now', 'localtime')
   WHERE id = OLD.id;
END;

-- ------------------------------------------------------------
-- TRIGGERS: disponibilidad de ejemplares
-- Reglas:
--   * Un préstamo 'activo' ocupa un ejemplar.
--   * Al pasar a devuelto/perdido/cancelado se libera.
--   * No se puede prestar un libro agotado o dado de baja.
-- ------------------------------------------------------------
CREATE TRIGGER IF NOT EXISTS trg_prestamos_validar_insert
BEFORE INSERT ON prestamos
FOR EACH ROW
WHEN NEW.estado = 'activo'
BEGIN
  SELECT CASE
    WHEN (SELECT estado FROM libros WHERE id = NEW.libro_id) <> 'activo'
      THEN RAISE(ABORT, 'El libro no está activo o no existe')
    WHEN (SELECT ejemplares_disponibles FROM libros WHERE id = NEW.libro_id) <= 0
      THEN RAISE(ABORT, 'No hay ejemplares disponibles para este libro')
  END;
END;

CREATE TRIGGER IF NOT EXISTS trg_prestamos_ocupar_ejemplar
AFTER INSERT ON prestamos
FOR EACH ROW
WHEN NEW.estado = 'activo'
BEGIN
  UPDATE libros
     SET ejemplares_disponibles = ejemplares_disponibles - 1
   WHERE id = NEW.libro_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_prestamos_validar_update
BEFORE UPDATE OF estado, libro_id ON prestamos
FOR EACH ROW
WHEN NEW.estado = 'activo'
BEGIN
  SELECT CASE
    WHEN NEW.libro_id <> OLD.libro_id
      THEN RAISE(ABORT, 'No se puede cambiar el libro de un préstamo')
    WHEN OLD.estado <> 'activo'
      AND (SELECT ejemplares_disponibles FROM libros WHERE id = NEW.libro_id) <= 0
      THEN RAISE(ABORT, 'No hay ejemplares disponibles para reactivar el préstamo')
  END;
END;

CREATE TRIGGER IF NOT EXISTS trg_prestamos_liberar_ejemplar
AFTER UPDATE OF estado ON prestamos
FOR EACH ROW
WHEN OLD.estado = 'activo' AND NEW.estado <> 'activo'
BEGIN
  UPDATE libros
     SET ejemplares_disponibles = ejemplares_disponibles + 1
   WHERE id = NEW.libro_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_prestamos_reactivar_ejemplar
AFTER UPDATE OF estado ON prestamos
FOR EACH ROW
WHEN OLD.estado <> 'activo' AND NEW.estado = 'activo'
BEGIN
  UPDATE libros
     SET ejemplares_disponibles = ejemplares_disponibles - 1
   WHERE id = NEW.libro_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_prestamos_borrado
AFTER DELETE ON prestamos
FOR EACH ROW
WHEN OLD.estado = 'activo'
BEGIN
  UPDATE libros
     SET ejemplares_disponibles = ejemplares_disponibles + 1
   WHERE id = OLD.libro_id;
END;

-- ------------------------------------------------------------
-- TRIGGERS: al cambiar ejemplares_total se ajusta la
-- disponibilidad con el mismo delta.
-- ------------------------------------------------------------
CREATE TRIGGER IF NOT EXISTS trg_libros_ajustar_disponibles
AFTER UPDATE OF ejemplares_total ON libros
FOR EACH ROW
WHEN NEW.ejemplares_total <> OLD.ejemplares_total
BEGIN
  UPDATE libros
     SET ejemplares_disponibles = MAX(
           0,
           ejemplares_disponibles + (NEW.ejemplares_total - OLD.ejemplares_total)
         )
   WHERE id = NEW.id;
END;

-- ------------------------------------------------------------
-- VISTAS
-- ------------------------------------------------------------
CREATE VIEW IF NOT EXISTS vista_libros AS
SELECT
  l.*,
  (l.ejemplares_total - l.ejemplares_disponibles) AS ejemplares_prestados
FROM libros l;

CREATE VIEW IF NOT EXISTS vista_prestamos_vencidos AS
SELECT
  p.*,
  u.nombre || ' ' || u.apellidos AS usuario,
  u.email                        AS usuario_email,
  l.titulo                       AS libro,
  CAST(julianday('now', 'localtime') - julianday(p.fecha_vencimiento) AS INTEGER) AS dias_retraso
FROM prestamos p
JOIN usuarios u ON u.id = p.usuario_id
JOIN libros   l ON l.id = p.libro_id
WHERE p.estado = 'activo'
  AND date(p.fecha_vencimiento) < date('now', 'localtime');

CREATE VIEW IF NOT EXISTS vista_prestamos_detalle AS
SELECT
  p.*,
  u.nombre || ' ' || u.apellidos AS usuario,
  u.email                        AS usuario_email,
  u.rol                          AS usuario_rol,
  l.titulo                       AS libro,
  l.autor                        AS libro_autor,
  l.isbn                         AS libro_isbn,
  CASE
    WHEN p.estado = 'activo' AND date(p.fecha_vencimiento) < date('now', 'localtime')
      THEN 1 ELSE 0
  END                            AS retrasado,
  CASE
    WHEN p.estado = 'activo'
      THEN CAST(julianday(p.fecha_vencimiento) - julianday('now', 'localtime') AS INTEGER)
    ELSE NULL
  END                            AS dias_para_vencer
FROM prestamos p
JOIN usuarios u ON u.id = p.usuario_id
JOIN libros   l ON l.id = p.libro_id;
