// Endpoint base de la API REST
const API_URL = 'http://localhost:3000/api';

/**
 * Función principal para obtener y renderizar todos los datos de la biblioteca
 */
async function fetchData() {
    try {
        await Promise.all([
            fetchBooks(),
            fetchUsers(),
            fetchLoans()
        ]);
    } catch (error) {
        console.error("Error al sincronizar con el backend:", error);
    }
}

/**
 * Obtener y renderizar la lista de Libros
 */
async function fetchBooks() {
    try {
        const res = await fetch(`${API_URL}/books`);
        const books = await res.json();
        
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
            const stockBadgeColor = book.stock > 0 
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                : 'bg-rose-50 text-rose-700 border-rose-200';
            
            bookList.innerHTML += `
                <li class="py-3 flex justify-between items-center px-2 rounded-md">
                    <div class="pr-2">
                        <p class="font-medium text-slate-800 line-clamp-1">${escapeHtml(book.title)}</p>
                        <p class="text-xs text-slate-500">${escapeHtml(book.author)}</p>
                    </div>
                    <div class="flex items-center space-x-2">
                        <span class="text-xs font-semibold px-2 py-0.5 rounded border ${stockBadgeColor}">
                            Stock: ${book.stock}
                        </span>
                        <button onclick="deleteBook(${book.id})" title="Eliminar libro" class="text-slate-400 hover:text-rose-600 transition p-1">
                            🗑️
                        </button>
                    </div>
                </li>
            `;

            if (book.stock > 0) {
                loanBookSelect.innerHTML += `
                    <option value="${book.id}">${escapeHtml(book.title)} (Disp: ${book.stock})</option>
                `;
            }
        });
    } catch (err) {
        console.error("Error al obtener libros:", err);
    }
}

/**
 * Obtener y renderizar la lista de Usuarios
 */
async function fetchUsers() {
    try {
        const res = await fetch(`${API_URL}/users`);
        const users = await res.json();
        
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
            userList.innerHTML += `
                <li class="py-3 flex justify-between items-center px-2 rounded-md">
                    <div class="pr-2">
                        <p class="font-medium text-slate-800">${escapeHtml(user.name)}</p>
                        <p class="text-xs text-slate-500">${escapeHtml(user.email)}</p>
                    </div>
                    <button onclick="deleteUser(${user.id})" title="Eliminar usuario" class="text-slate-400 hover:text-rose-600 transition p-1">
                        🗑️
                    </button>
                </li>
            `;

            loanUserSelect.innerHTML += `
                <option value="${user.id}">${escapeHtml(user.name)}</option>
            `;
        });
    } catch (err) {
        console.error("Error al obtener usuarios:", err);
    }
}

/**
 * Obtener y renderizar la lista de Préstamos Activos
 */
async function fetchLoans() {
    try {
        const res = await fetch(`${API_URL}/loans`);
        const loans = await res.json();
        
        const loanList = document.getElementById('loan-list');
        const loanCountBadge = document.getElementById('loan-count-badge');
        
        loanList.innerHTML = '';
        loanCountBadge.textContent = loans.length;

        if (loans.length === 0) {
            loanList.innerHTML = '<li class="py-4 text-center text-slate-400 italic">No hay préstamos activos</li>';
            return;
        }

        loans.forEach(loan => {
            loanList.innerHTML += `
                <li class="py-3 flex justify-between items-center px-2 rounded-md">
                    <div class="pr-2">
                        <p class="font-medium text-slate-800 line-clamp-1">📖 ${escapeHtml(loan.book_title || 'Libro ID: ' + loan.book_id)}</p>
                        <p class="text-xs text-slate-500">👤 ${escapeHtml(loan.user_name || 'Usuario ID: ' + loan.user_id)}</p>
                    </div>
                    <button onclick="returnLoan(${loan.id})" 
                            class="bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-semibold px-2.5 py-1 rounded transition shadow-sm flex items-center gap-1">
                        Devolver
                    </button>
                </li>
            `;
        });
    } catch (err) {
        console.error("Error al obtener préstamos:", err);
    }
}

// --- Manejadores de Formularios ---

document.getElementById('book-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('book-title').value.trim();
    const author = document.getElementById('book-author').value.trim();
    const stock = parseInt(document.getElementById('book-stock').value);

    if (!title || !author || isNaN(stock)) return;

    await fetch(`${API_URL}/books`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, author, stock })
    });

    e.target.reset();
    fetchData();
});

document.getElementById('user-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('user-name').value.trim();
    const email = document.getElementById('user-email').value.trim();

    if (!name || !email) return;

    await fetch(`${API_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email })
    });

    e.target.reset();
    fetchData();
});

document.getElementById('loan-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const userId = parseInt(document.getElementById('loan-user').value);
    const bookId = parseInt(document.getElementById('loan-book').value);

    if (!userId || !bookId) return;

    await fetch(`${API_URL}/loans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, book_id: bookId })
    });

    e.target.reset();
    fetchData();
});

/**
 * Acciones de Devolución y Eliminación
 */
async function returnLoan(id) {
    await fetch(`${API_URL}/loans/${id}`, { method: 'DELETE' });
    fetchData();
}

async function deleteBook(id) {
    if (confirm('¿Deseas eliminar este libro del catálogo?')) {
        await fetch(`${API_URL}/books/${id}`, { method: 'DELETE' });
        fetchData();
    }
}

async function deleteUser(id) {
    if (confirm('¿Deseas eliminar este usuario?')) {
        await fetch(`${API_URL}/users/${id}`, { method: 'DELETE' });
        fetchData();
    }
}

/**
 * Función auxiliar para evitar vulnerabilidades XSS
 */
function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Inicializar datos al cargar la página
fetchData();