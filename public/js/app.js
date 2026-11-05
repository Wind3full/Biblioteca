// Endpoint base de la API REST (mismo origen que sirve el frontend)
const API_URL = '/api';

/**
 * Wrapper de fetch: envía/recibe JSON y lanza Error con el mensaje { error } del backend
 */
async function api(path, options = {}) {
    const res = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined
    });
    if (res.status === 204) return null;
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error((data && data.error) || `Error HTTP ${res.status}`);
    return data;
}

// Texto visible en los buscadores de préstamo -> id (los <input list> solo devuelven texto)
const loanOptions = { usuarios: new Map(), libros: new Map() };

function showError(err) {
    console.error(err);
    alert(err.message || 'Error inesperado');
}

/**
 * Función principal para obtener y renderizar todos los datos de la biblioteca
 */
async function fetchData() {
    await Promise.all([fetchBooks(), fetchUsers(), fetchLoans(), fetchHistory()]);
}

/**
 * Historial: GET /api/prestamos[?estado=...]  (todos los préstamos, más recientes primero)
 */
const ESTADO_BADGE = {
    activo: 'bg-purple-50 text-purple-700 border-purple-200',
    devuelto: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    perdido: 'bg-rose-50 text-rose-700 border-rose-200',
    cancelado: 'bg-slate-100 text-slate-600 border-slate-200'
};

async function fetchHistory() {
    const tbody = document.getElementById('history-list');
    try {
        const estado = document.getElementById('history-filter').value;
        const loans = await api(`/prestamos${estado ? `?estado=${encodeURIComponent(estado)}` : ''}`);

        if (loans.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="py-4 text-center text-slate-400 italic">No hay préstamos en el historial</td></tr>';
            return;
        }

        tbody.innerHTML = loans.map(p => {
            const estadoTxt = p.retrasado ? 'activo (retrasado)' : p.estado;
            const badge = p.retrasado ? ESTADO_BADGE.perdido : (ESTADO_BADGE[p.estado] || '');
            return `
                <tr class="hover:bg-slate-50">
                    <td class="px-4 py-2 text-slate-400">${p.id}</td>
                    <td class="px-4 py-2 font-medium text-slate-800">${escapeHtml(p.libro)}</td>
                    <td class="px-4 py-2">${escapeHtml(p.usuario)}</td>
                    <td class="px-4 py-2 whitespace-nowrap">${escapeHtml(p.fecha_prestamo)}</td>
                    <td class="px-4 py-2 whitespace-nowrap">${escapeHtml(p.fecha_vencimiento)}</td>
                    <td class="px-4 py-2 whitespace-nowrap">${p.fecha_devolucion ? escapeHtml(p.fecha_devolucion) : '—'}</td>
                    <td class="px-4 py-2"><span class="text-xs font-semibold px-2 py-0.5 rounded border ${badge}">${escapeHtml(estadoTxt)}</span></td>
                </tr>`;
        }).join('');
    } catch (err) {
        console.error('Error al obtener historial:', err);
        tbody.innerHTML = '<tr><td colspan="7" class="py-4 text-center text-rose-500 italic">Error al cargar el historial</td></tr>';
    }
}

document.getElementById('history-filter').addEventListener('change', fetchHistory);

/**
 * Modal de edición genérico.
 * Libros:   PUT /api/libros/:id    Usuarios: PUT /api/usuarios/:id
 */
const CAMPOS_EDICION = {
    libros: [
        { name: 'titulo', label: 'Título', required: true, full: true },
        { name: 'autor', label: 'Autor', required: true },
        { name: 'isbn', label: 'ISBN' },
        { name: 'categoria', label: 'Categoría' },
        { name: 'editorial', label: 'Editorial' },
        { name: 'anio_publicacion', label: 'Año publicación', type: 'number' },
        { name: 'ejemplares_total', label: 'Ejemplares totales', type: 'number', required: true, min: 0 },
        { name: 'ubicacion', label: 'Ubicación' },
        { name: 'portada_url', label: 'URL portada', type: 'url' },
        { name: 'sinopsis', label: 'Sinopsis', type: 'textarea', full: true }
    ],
    usuarios: [
        { name: 'nombre', label: 'Nombre', required: true },
        { name: 'apellidos', label: 'Apellidos' },
        { name: 'email', label: 'Email', type: 'email', required: true, full: true },
        { name: 'telefono', label: 'Teléfono' },
        { name: 'dni', label: 'DNI' },
        { name: 'rol', label: 'Rol', options: ['alumno', 'profesor', 'bibliotecario', 'administrador'] },
        { name: 'estado_membresia', label: 'Membresía', options: ['activa', 'suspendida', 'vencida', 'inactiva'] }
    ]
};

let editing = null; // { recurso, id }

// Lee los campos de un formulario y construye el JSON para POST/PUT
function buildBody(recurso, form) {
    const body = {};
    for (const f of CAMPOS_EDICION[recurso]) {
        let v = form.elements[f.name].value.trim();
        // Vacío -> null (evita choques UNIQUE con '' en isbn/dni)
        if (v === '') v = f.required ? v : (f.name === 'apellidos' ? '' : null);
        else if (f.type === 'number') v = Number(v);
        body[f.name] = v;
    }
    return body;
}

function renderField(f, value) {
    const v = value === null || value === undefined ? '' : value;
    const cls = 'w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500';
    let input;
    if (f.options) {
        input = `<select name="${f.name}" class="${cls}">${f.options.map(o =>
            `<option value="${o}" ${o === v ? 'selected' : ''}>${o}</option>`).join('')}</select>`;
    } else if (f.type === 'textarea') {
        input = `<textarea name="${f.name}" rows="3" class="${cls}">${escapeHtml(v)}</textarea>`;
    } else {
        input = `<input name="${f.name}" type="${f.type || 'text'}" value="${escapeHtml(v)}"
                  ${f.required ? 'required' : ''} ${f.min !== undefined ? `min="${f.min}"` : ''} class="${cls}">`;
    }
    return `<label class="block ${f.full ? 'sm:col-span-2' : ''}">
                <span class="block text-xs font-medium text-slate-600 mb-1">${f.label}${f.required ? ' *' : ''}</span>
                ${input}
            </label>`;
}

async function openEditModal(recurso, id, titulo) {
    try {
        const item = await api(`/${recurso}/${id}`);
        editing = { recurso, id };
        document.getElementById('edit-title').textContent = titulo;
        document.getElementById('edit-fields').innerHTML =
            CAMPOS_EDICION[recurso].map(f => renderField(f, item[f.name])).join('');
        document.getElementById('edit-error').hidden = true;
        document.getElementById('edit-modal').hidden = false;
        document.querySelector('#edit-fields [name]').focus();
    } catch (err) { showError(err); }
}

function closeEditModal() {
    document.getElementById('edit-modal').hidden = true;
    editing = null;
}

const editBook = (id) => openEditModal('libros', id, 'Editar libro');
const editUser = (id) => openEditModal('usuarios', id, 'Editar usuario');

document.getElementById('edit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!editing) return;
    try {
        await api(`/${editing.recurso}/${editing.id}`, { method: 'PUT', body: buildBody(editing.recurso, e.target) });
        closeEditModal();
        fetchData();
    } catch (err) {
        const p = document.getElementById('edit-error');
        p.textContent = err.message;
        p.hidden = false;
    }
});

// Cerrar con Escape o clic fuera del formulario
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeEditModal(); });
document.getElementById('edit-modal').addEventListener('click', (e) => {
    if (e.target.id === 'edit-modal') closeEditModal();
});

/**
 * Libros: GET /api/libros?estado=activo
 * Campos: id, titulo, autor, ejemplares_total, ejemplares_disponibles, ejemplares_prestados...
 */
async function fetchBooks() {
    try {
        const books = await api('/libros?estado=activo');

        const bookList = document.getElementById('book-list');
        const loanBookSelect = document.getElementById('loan-book-options');
        const bookCountBadge = document.getElementById('book-count-badge');

        bookList.innerHTML = '';
        loanBookSelect.innerHTML = '';
        loanOptions.libros.clear();
        bookCountBadge.textContent = books.length;

        if (books.length === 0) {
            bookList.innerHTML = '<li class="py-4 text-center text-slate-400 italic">No hay libros registrados</li>';
            return;
        }

        books.forEach(book => {
            const disp = book.ejemplares_disponibles;
            const stockBadgeColor = disp > 0
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-rose-50 text-rose-700 border-rose-200';

            bookList.innerHTML += `
                <li class="py-3 flex justify-between items-center px-2 rounded-md">
                    <div class="pr-2">
                        <p class="font-medium text-slate-800 line-clamp-1">${escapeHtml(book.titulo)}</p>
                        <p class="text-xs text-slate-500">${escapeHtml(book.autor)}</p>
                    </div>
                    <div class="flex items-center space-x-2">
                        <span class="text-xs font-semibold px-2 py-0.5 rounded border ${stockBadgeColor}">
                            Disp: ${disp}/${book.ejemplares_total}
                        </span>
                        <button onclick="editBook(${book.id})" title="Editar libro" class="text-slate-400 hover:text-indigo-600 transition p-1">
                            ✏️
                        </button>
                        <button onclick="deleteBook(${book.id})" title="Dar de baja" class="text-slate-400 hover:text-rose-600 transition p-1">
                            🗑️
                        </button>
                    </div>
                </li>
            `;

            if (disp > 0) {
                const label = `${book.titulo} — ${book.autor} (#${book.id})`;
                loanOptions.libros.set(label, book.id);
                loanBookSelect.innerHTML += `<option value="${escapeHtml(label)}">Disp: ${disp}</option>`;
            }
        });
    } catch (err) {
        console.error('Error al obtener libros:', err);
    }
}

/**
 * Usuarios: GET /api/usuarios?estado_membresia=activa
 * Campos: id, nombre, apellidos, email, rol, estado_membresia, prestamos_activos
 */
async function fetchUsers() {
    try {
        // Todos menos los dados de baja, para poder editar también suspendidos/vencidos
        const users = (await api('/usuarios')).filter(u => u.estado_membresia !== 'inactiva');

        const userList = document.getElementById('user-list');
        const loanUserSelect = document.getElementById('loan-user-options');
        const userCountBadge = document.getElementById('user-count-badge');

        userList.innerHTML = '';
        loanUserSelect.innerHTML = '';
        loanOptions.usuarios.clear();
        userCountBadge.textContent = users.length;

        if (users.length === 0) {
            userList.innerHTML = '<li class="py-4 text-center text-slate-400 italic">No hay usuarios registrados</li>';
            return;
        }

        users.forEach(user => {
            const fullName = `${user.nombre} ${user.apellidos || ''}`.trim();
            userList.innerHTML += `
                <li class="py-3 flex justify-between items-center px-2 rounded-md">
                    <div class="pr-2">
                        <p class="font-medium text-slate-800">${escapeHtml(fullName)}</p>
                        <p class="text-xs text-slate-500">${escapeHtml(user.email)} · ${escapeHtml(user.rol)} · ${user.prestamos_activos} préstamo(s)${user.estado_membresia !== 'activa' ? ` · <span class="text-amber-600 font-semibold">${escapeHtml(user.estado_membresia)}</span>` : ''}</p>
                    </div>
                    <div class="flex items-center space-x-1">
                        <button onclick="editUser(${user.id})" title="Editar usuario" class="text-slate-400 hover:text-indigo-600 transition p-1">
                            ✏️
                        </button>
                        <button onclick="deleteUser(${user.id})" title="Dar de baja" class="text-slate-400 hover:text-rose-600 transition p-1">
                            🗑️
                        </button>
                    </div>
                </li>
            `;

            // Solo los usuarios con membresía activa pueden pedir préstamos
            if (user.estado_membresia === 'activa') {
                const label = `${fullName} — ${user.email} (#${user.id})`;
                loanOptions.usuarios.set(label, user.id);
                loanUserSelect.innerHTML += `<option value="${escapeHtml(label)}">${escapeHtml(user.rol)}</option>`;
            }
        });
    } catch (err) {
        console.error('Error al obtener usuarios:', err);
    }
}

/**
 * Préstamos activos: GET /api/prestamos?estado=activo
 * Campos (vista_prestamos_detalle): id, libro, usuario, fecha_vencimiento, retrasado, dias_para_vencer...
 */
async function fetchLoans() {
    try {
        const loans = await api('/prestamos?estado=activo');

        const loanList = document.getElementById('loan-list');
        const loanCountBadge = document.getElementById('loan-count-badge');

        loanList.innerHTML = '';
        loanCountBadge.textContent = loans.length;

        if (loans.length === 0) {
            loanList.innerHTML = '<li class="py-4 text-center text-slate-400 italic">No hay préstamos activos</li>';
            return;
        }

        loans.forEach(loan => {
            const vence = loan.retrasado
                ? `<span class="text-rose-600 font-semibold">Vencido (${escapeHtml(loan.fecha_vencimiento)})</span>`
                : `Vence: ${escapeHtml(loan.fecha_vencimiento)}`;
            loanList.innerHTML += `
                <li class="py-3 flex justify-between items-center px-2 rounded-md">
                    <div class="pr-2">
                        <p class="font-medium text-slate-800 line-clamp-1">📖 ${escapeHtml(loan.libro)}</p>
                        <p class="text-xs text-slate-500">👤 ${escapeHtml(loan.usuario)}</p>
                        <p class="text-xs text-slate-500">${vence}</p>
                    </div>
                    <button onclick="returnLoan(${loan.id})"
                            class="bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-semibold px-2.5 py-1 rounded transition shadow-sm flex items-center gap-1">
                        Devolver
                    </button>
                </li>
            `;
        });
    } catch (err) {
        console.error('Error al obtener préstamos:', err);
    }
}

// --- Manejadores de Formularios ---

// Formularios de alta: mismos campos que el modal de edición (CAMPOS_EDICION)
const VALORES_INICIALES = {
    libros: { ejemplares_total: 1 },
    usuarios: { rol: 'alumno', estado_membresia: 'activa' }
};

function renderCreateForm(recurso, containerId) {
    document.getElementById(containerId).innerHTML =
        CAMPOS_EDICION[recurso].map(f => renderField(f, VALORES_INICIALES[recurso][f.name])).join('');
}

// POST /api/libros  y  POST /api/usuarios  con todos los campos del recurso
for (const [formId, recurso, containerId] of [
    ['book-form', 'libros', 'book-form-fields'],
    ['user-form', 'usuarios', 'user-form-fields']
]) {
    renderCreateForm(recurso, containerId);
    document.getElementById(formId).addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            await api(`/${recurso}`, { method: 'POST', body: buildBody(recurso, e.target) });
            renderCreateForm(recurso, containerId); // limpiar y restaurar valores por defecto
            fetchData();
        } catch (err) { showError(err); }
    });
}

// POST /api/prestamos { usuario_id, libro_id }
document.getElementById('loan-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const usuario_id = loanOptions.usuarios.get(document.getElementById('loan-user').value.trim());
    const libro_id = loanOptions.libros.get(document.getElementById('loan-book').value.trim());

    if (!usuario_id) return showError(new Error('Elija un usuario de la lista de sugerencias'));
    if (!libro_id) return showError(new Error('Elija un libro disponible de la lista de sugerencias'));

    try {
        await api('/prestamos', { method: 'POST', body: { usuario_id, libro_id } });
        e.target.reset();
        fetchData();
    } catch (err) { showError(err); }
});

/**
 * Acciones de Devolución y Baja
 */
// POST /api/prestamos/:id/devolver
async function returnLoan(id) {
    try {
        await api(`/prestamos/${id}/devolver`, { method: 'POST', body: {} });
        fetchData();
    } catch (err) { showError(err); }
}

// DELETE /api/libros/:id  (baja lógica: estado = 'baja')
async function deleteBook(id) {
    if (!confirm('¿Deseas dar de baja este libro del catálogo?')) return;
    try {
        await api(`/libros/${id}`, { method: 'DELETE' });
        fetchData();
    } catch (err) { showError(err); }
}

// DELETE /api/usuarios/:id  (baja lógica: estado_membresia = 'inactiva')
async function deleteUser(id) {
    if (!confirm('¿Deseas dar de baja este usuario?')) return;
    try {
        await api(`/usuarios/${id}`, { method: 'DELETE' });
        fetchData();
    } catch (err) { showError(err); }
}

/**
 * Función auxiliar para evitar vulnerabilidades XSS
 */
function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Inicializar datos al cargar la página
fetchData();
