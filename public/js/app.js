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

function showError(err) {
    console.error(err);
    alert(err.message || 'Error inesperado');
}

/**
 * Función principal para obtener y renderizar todos los datos de la biblioteca
 */
async function fetchData() {
    await Promise.all([fetchBooks(), fetchUsers(), fetchLoans()]);
}

/**
 * Libros: GET /api/libros?estado=activo
 * Campos: id, titulo, autor, ejemplares_total, ejemplares_disponibles, ejemplares_prestados...
 */
async function fetchBooks() {
    try {
        const books = await api('/libros?estado=activo');

        const bookList = document.getElementById('book-list');
        const loanBookSelect = document.getElementById('loan-book');
        const bookCountBadge = document.getElementById('book-count-badge');

        bookList.innerHTML = '';
        loanBookSelect.innerHTML = '<option value="">Seleccione Libro</option>';
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
                        <button onclick="deleteBook(${book.id})" title="Dar de baja" class="text-slate-400 hover:text-rose-600 transition p-1">
                            🗑️
                        </button>
                    </div>
                </li>
            `;

            if (disp > 0) {
                loanBookSelect.innerHTML += `
                    <option value="${book.id}">${escapeHtml(book.titulo)} (Disp: ${disp})</option>
                `;
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
        const users = await api('/usuarios?estado_membresia=activa');

        const userList = document.getElementById('user-list');
        const loanUserSelect = document.getElementById('loan-user');
        const userCountBadge = document.getElementById('user-count-badge');

        userList.innerHTML = '';
        loanUserSelect.innerHTML = '<option value="">Seleccione Usuario</option>';
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
                        <p class="text-xs text-slate-500">${escapeHtml(user.email)} · ${escapeHtml(user.rol)} · ${user.prestamos_activos} préstamo(s)</p>
                    </div>
                    <button onclick="deleteUser(${user.id})" title="Dar de baja" class="text-slate-400 hover:text-rose-600 transition p-1">
                        🗑️
                    </button>
                </li>
            `;

            loanUserSelect.innerHTML += `
                <option value="${user.id}">${escapeHtml(fullName)}</option>
            `;
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

// POST /api/libros { titulo, autor, ejemplares_total }
document.getElementById('book-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const titulo = document.getElementById('book-title').value.trim();
    const autor = document.getElementById('book-author').value.trim();
    const ejemplares_total = parseInt(document.getElementById('book-stock').value, 10);

    if (!titulo || !autor || isNaN(ejemplares_total)) return;

    try {
        await api('/libros', { method: 'POST', body: { titulo, autor, ejemplares_total } });
        e.target.reset();
        fetchData();
    } catch (err) { showError(err); }
});

// POST /api/usuarios { nombre, email }
document.getElementById('user-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = document.getElementById('user-name').value.trim();
    const email = document.getElementById('user-email').value.trim();

    if (!nombre || !email) return;

    try {
        await api('/usuarios', { method: 'POST', body: { nombre, email } });
        e.target.reset();
        fetchData();
    } catch (err) { showError(err); }
});

// POST /api/prestamos { usuario_id, libro_id }
document.getElementById('loan-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const usuario_id = parseInt(document.getElementById('loan-user').value, 10);
    const libro_id = parseInt(document.getElementById('loan-book').value, 10);

    if (!usuario_id || !libro_id) return;

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
