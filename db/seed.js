'use strict';

const db = require('./index');

const totalUsuarios = db.prepare('SELECT COUNT(*) AS n FROM usuarios').get().n;
const totalLibros = db.prepare('SELECT COUNT(*) AS n FROM libros').get().n;

if (totalUsuarios > 0 || totalLibros > 0) {
  console.log('La base de datos ya contiene datos. No se inserta el seed.');
  process.exit(0);
}

const insertarUsuario = db.prepare(`
  INSERT INTO usuarios (nombre, apellidos, email, telefono, dni, rol, estado_membresia)
  VALUES (@nombre, @apellidos, @email, @telefono, @dni, @rol, @estado_membresia)
`);

const insertarLibro = db.prepare(`
  INSERT INTO libros (titulo, autor, isbn, categoria, editorial, anio_publicacion,
                      ejemplares_total, ejemplares_disponibles, ubicacion, sinopsis)
  VALUES (@titulo, @autor, @isbn, @categoria, @editorial, @anio_publicacion,
          @ejemplares_total, @ejemplares_total, @ubicacion, @sinopsis)
`);

const insertarPrestamo = db.prepare(`
  INSERT INTO prestamos (libro_id, usuario_id, fecha_prestamo, fecha_vencimiento, estado, observaciones)
  VALUES (@libro_id, @usuario_id, @fecha_prestamo, @fecha_vencimiento, 'activo', @observaciones)
`);

const seed = db.transaction(() => {
  const usuarios = [
    { nombre: 'Ana', apellidos: 'García López', email: 'ana.garcia@colegio.edu', telefono: '600111222', dni: '11111111A', rol: 'alumno', estado_membresia: 'activa' },
    { nombre: 'Carlos', apellidos: 'Pérez Ruiz', email: 'carlos.perez@colegio.edu', telefono: '600333444', dni: '22222222B', rol: 'profesor', estado_membresia: 'activa' },
    { nombre: 'Lucía', apellidos: 'Martín Soto', email: 'lucia.martin@colegio.edu', telefono: '600555666', dni: '33333333C', rol: 'alumno', estado_membresia: 'activa' },
    { nombre: 'Javier', apellidos: 'Torres Díaz', email: 'javier.torres@colegio.edu', telefono: '600777888', dni: '44444444D', rol: 'bibliotecario', estado_membresia: 'activa' },
    { nombre: 'Marta', apellidos: 'Sanz Gil', email: 'marta.sanz@colegio.edu', telefono: '600999000', dni: '55555555E', rol: 'alumno', estado_membresia: 'suspendida' }
  ];

  const libros = [
    { titulo: 'Cien años de soledad', autor: 'Gabriel García Márquez', isbn: '9780307474728', categoria: 'Novela', editorial: 'Sudamericana', anio_publicacion: 1967, ejemplares_total: 3, ubicacion: 'N-01', sinopsis: 'La historia de la familia Buendía en Macondo.' },
    { titulo: 'El principito', autor: 'Antoine de Saint-Exupéry', isbn: '9780156012195', categoria: 'Infantil', editorial: 'Salamandra', anio_publicacion: 1943, ejemplares_total: 5, ubicacion: 'I-04', sinopsis: 'Un piloto perdido en el desierto conoce a un pequeño príncipe.' },
    { titulo: 'Don Quijote de la Mancha', autor: 'Miguel de Cervantes', isbn: '9788420412145', categoria: 'Clásico', editorial: 'Alfaguara', anio_publicacion: 1605, ejemplares_total: 4, ubicacion: 'C-02', sinopsis: 'Las aventuras del ingenioso hidalgo y su escudero Sancho Panza.' },
    { titulo: 'Introducción a los algoritmos', autor: 'Thomas H. Cormen', isbn: '9780262033848', categoria: 'Informática', editorial: 'MIT Press', anio_publicacion: 2009, ejemplares_total: 2, ubicacion: 'T-07', sinopsis: 'Manual de referencia sobre diseño y análisis de algoritmos.' },
    { titulo: 'Breve historia del tiempo', autor: 'Stephen Hawking', isbn: '9780553380163', categoria: 'Ciencia', editorial: 'Crítica', anio_publicacion: 1988, ejemplares_total: 2, ubicacion: 'T-12', sinopsis: 'Del Big Bang a los agujeros negros.' }
  ];

  const idsUsuarios = usuarios.map((u) => insertarUsuario.run(u).lastInsertRowid);
  const idsLibros = libros.map((l) => insertarLibro.run(l).lastInsertRowid);

  insertarPrestamo.run({
    libro_id: idsLibros[1],
    usuario_id: idsUsuarios[0],
    fecha_prestamo: db.prepare("SELECT date('now','localtime','-7 days') AS d").get().d,
    fecha_vencimiento: db.prepare("SELECT date('now','localtime','+7 days') AS d").get().d,
    observaciones: 'Préstamo de ejemplo vigente'
  });

  insertarPrestamo.run({
    libro_id: idsLibros[0],
    usuario_id: idsUsuarios[2],
    fecha_prestamo: db.prepare("SELECT date('now','localtime','-30 days') AS d").get().d,
    fecha_vencimiento: db.prepare("SELECT date('now','localtime','-16 days') AS d").get().d,
    observaciones: 'Préstamo de ejemplo con retraso'
  });

  return { usuarios: idsUsuarios.length, libros: idsLibros.length, prestamos: 2 };
});

const resultado = seed();
console.log('Seed insertado:', resultado);
