// Definimos la URL base de nuestro Backend
const API_BASE_URL = '/api/users';
const VETERINARIOS_API = '/api/ventas_tutores/veterinarios';
let selectedUserId = null; // Almacena el ID del usuario seleccionado en la tabla
let cachedVeterinarios = null;

// ---------------------------------------------
// I. FUNCIONALIDADES DE RENDERIZADO Y CARGA
// ---------------------------------------------

/**
 * Carga la lista de usuarios desde el Backend y la renderiza.
 */
async function loadUsers() {
    const container = document.getElementById('user-table-container');
    container.innerHTML = '<p>Cargando usuarios...</p>';

    // Obtener el token de sesión
    const token = localStorage.getItem('supabase-session-token');

    try {
        const response = await fetch(API_BASE_URL, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                // Enviar el token para autenticar la petición (Backend debe verificarlo)
                'Authorization': `Bearer ${token}` 
            },
        });

        if (!response.ok) {
            // Si el token es inválido o no es administrador (ej. 401, 403)
            throw new Error(`Error ${response.status}: No autorizado o error al cargar usuarios.`);
        }

        const users = await response.json();
        
        if (users.length === 0) {
            container.innerHTML = '<p>No hay usuarios registrados.</p>';
        } else {
            // Renderiza la tabla con los datos obtenidos
            renderUserTable(users);
        }

    } catch (error) {
        console.error('Error al cargar usuarios:', error);
        container.innerHTML = `<p style="color: red;">Error al cargar datos: ${error.message}</p>`;
        
        // Si hay error de autorización, redirigir al login
        if (error.message.includes('401') || error.message.includes('No autorizado')) {
             handleLogout();
        }
    }
}

/**
 * Genera y renderiza la tabla de usuarios en el DOM.
 * Incluye las columnas: ID, Nombre, Usuario (Email), Rol, Estado.
 * @param {Array<Object>} users - Lista de objetos de usuario.
 */
function renderUserTable(users) {
    const container = document.getElementById('user-table-container');
    
    // Si no hay usuarios, detenemos y mostramos un mensaje
    if (users.length === 0) {
        container.innerHTML = '<p>No hay usuarios registrados.</p>';
        return;
    }

    let html = '<table>';
    html += '<thead><tr><th>ID</th><th>Nombre</th><th>Usuario (Email)</th><th>Rol</th><th>Estado</th></tr></thead>';
    html += '<tbody>';

    users.forEach(user => {
        // Usamos la función selectUser en el evento onclick para permitir la selección de fila
        html += `<tr data-id="${user.id}" onclick="selectUser('${user.id}')" class="${user.id === selectedUserId ? 'selected' : ''}">`;
        html += `<td>${user.id ? user.id.substring(0, 4) + '...' : 'N/A'}</td>`; 
        html += `<td>${user.nombre_apellido || 'N/A'}</td>`;
        html += `<td>${user.email || 'N/A'}</td>`; // Asumimos que el campo 'usuario' es el email
        html += `<td>${user.rol || 'N/A'}</td>`;
        html += `<td>${user.estado || 'N/A'}</td>`;
        html += '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

/**
 * Función que se ejecuta al hacer clic en una fila de la tabla.
 * Marca la fila y almacena el ID para acciones CRUD.
 * @param {string} userId - ID del usuario seleccionado.
 */
function selectUser(userId) {
    // Si se hace clic en la misma fila, deseleccionamos
    if (selectedUserId === userId) {
        selectedUserId = null;
        const selectedRow = document.querySelector('tr.selected');
        if (selectedRow) selectedRow.classList.remove('selected');
        document.getElementById('user-form').reset();
        document.getElementById('contrasena').value = ''; // Asegurar que la contraseña esté vacía al deseleccionar
        document.getElementById('contrasena').setAttribute('required', 'required'); // Volver a modo CREAR
        const rolSelect = document.getElementById('rol');
        const medicoSelect = document.getElementById('medico-veterinario');
        updateMedicoField(rolSelect.value, '', medicoSelect);
        return;
    }
    
    // 1. Desmarcar la fila previamente seleccionada
    const prevRow = document.querySelector(`tr.selected`);
    if (prevRow) prevRow.classList.remove('selected');
    
    // 2. Marcar la nueva fila
    const newRow = document.querySelector(`tr[data-id="${userId}"]`);
    if (newRow) newRow.classList.add('selected');

    // 3. Almacenar el ID seleccionado globalmente
    selectedUserId = userId;

    // 4. Cargar los datos del usuario seleccionado en el formulario para la edición
    loadUserToForm(userId);
}

// ==========================================================
// ⭐️ NUEVA FUNCIÓN CLAVE: Cargar datos para edición (GET)
// ==========================================================
/**
 * Llama al Backend (GET /api/users/:id) para obtener los datos de un usuario 
 * y los rellena en el formulario.
 * @param {string} userId - ID del usuario a cargar.
 */
async function loadUserToForm(userId) {
    const token = localStorage.getItem('supabase-session-token');
    const nombreApellidoInput = document.getElementById('nombre-apellido');
    const usuarioInput = document.getElementById('usuario');
    const rolSelect = document.getElementById('rol');
    const medicoSelect = document.getElementById('medico-veterinario');
    const estadoSelect = document.getElementById('estado');
    const contrasenaInput = document.getElementById('contrasena');
    
    try {
        const response = await fetch(`${API_BASE_URL}/${userId}`, {
            method: 'GET',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json' 
            },
        });

        if (!response.ok) {
            throw new Error(`Error ${response.status}: No se pudo obtener el usuario.`);
        }

        const user = await response.json();
        
        // Rellenar el formulario con los datos
        nombreApellidoInput.value = user.nombre_apellido || '';
        usuarioInput.value = user.email || ''; 
        rolSelect.value = user.rol || '';
        estadoSelect.value = user.estado || '';
        await updateMedicoField(user.rol || '', user.medico_veterinario || '', medicoSelect);
        
        // La contraseña SIEMPRE se deja vacía al cargar para NO exponerla, 
        // y se hace OPCIONAL para la modificación.
        contrasenaInput.value = ''; 
        contrasenaInput.removeAttribute('required'); // Permite que se envíe el formulario sin cambiar la contraseña
        
        alert(`Datos del usuario ${userId.substring(0, 8)}... cargados en el formulario para edición.`);

    } catch (error) {
        console.error('Error al cargar datos del usuario para el formulario:', error);
        alert(`Error al cargar datos: ${error.message}.`);
        selectedUserId = null; // Limpiar selección si falla
    }
}

// ---------------------------------------------
// II. MANEJO DE ACCIONES CRUD
// ---------------------------------------------

/**
 * Maneja el envío del formulario. Se bifurca si estamos CREANDO (selectedUserId es null)
 * o MODIFICANDO (selectedUserId tiene valor).
 */
async function handleFormSubmit(event) {
    event.preventDefault();
    
    const nombreApellidoInput = document.getElementById('nombre-apellido');
    const usuarioInput = document.getElementById('usuario');
    const rolSelect = document.getElementById('rol');
    const medicoSelect = document.getElementById('medico-veterinario');
    const estadoSelect = document.getElementById('estado');
    const contrasenaInput = document.getElementById('contrasena');
    const roleValue = rolSelect.value || '';
    const isVetRole = normalizeRole(roleValue) === 'veterinario';
    const medicoValue = isVetRole ? (medicoSelect.value || '') : '';

    if (isVetRole && !medicoValue) {
        alert('Debes seleccionar el Medico Veterinario.');
        return;
    }

    const data = {
        nombre_apellido: nombreApellidoInput.value,
        email: usuarioInput.value, 
        password: contrasenaInput.value,
        rol: roleValue,
        estado: estadoSelect.value,
        medico_veterinario: isVetRole ? medicoValue : null
    };
    
    if (selectedUserId) {
        // Si hay un ID seleccionado, MODIFICAMOS (UPDATE)
        await handleUpdate(selectedUserId, data); 
    } else {
        // Si NO hay ID seleccionado, CREAMOS
        await handleCreate(data);
    }
}

/**
 * Envía la petición POST para crear un nuevo usuario.
 */
async function handleCreate(data) {
    if (!data.password) {
        return alert('La contraseña es obligatoria para la creación de un usuario.');
    }
    
    // ... (CÓDIGO DE handleCreate SIN CAMBIOS) ...
    const token = localStorage.getItem('supabase-session-token');
    
    try {
        const response = await fetch(API_BASE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify(data),
        });

        const result = await response.json();

        if (response.ok) {
            alert('✅ Usuario Creado exitosamente.');
            document.getElementById('user-form').reset(); 
            const rolSelect = document.getElementById('rol');
            const medicoSelect = document.getElementById('medico-veterinario');
            updateMedicoField(rolSelect.value, '', medicoSelect);
            loadUsers(); 
        } else {
            alert(`❌ Error al crear: ${result.message || result.error || 'Error desconocido'}`);
        }
    } catch (error) {
        console.error('Error de red al crear:', error);
        alert('Error de conexión con el servidor.');
    }
}

// ==========================================================
// ⭐️ NUEVA FUNCIÓN CLAVE: Actualizar usuario (PUT)
// ==========================================================
/**
 * Envía la petición PUT para actualizar un usuario existente.
 */
async function handleUpdate(userId, data) {
    const token = localStorage.getItem('supabase-session-token');

    // 1. Limpiar el objeto de datos: 
    // Si la contraseña está vacía, la eliminamos del objeto para que el Backend no la actualice.
    if (!data.password || data.password.trim() === '') {
        delete data.password;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/${userId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data),
        });

        const result = await response.json();

        if (response.ok) {
            alert(`✅ Usuario ${userId.substring(0, 8)}... MODIFICADO exitosamente.`);
            
            // Limpiar y resetear
            selectedUserId = null; 
            document.getElementById('user-form').reset();
            document.getElementById('contrasena').setAttribute('required', 'required'); // Volver a requerir la contraseña para el modo CREAR
            const rolSelect = document.getElementById('rol');
            const medicoSelect = document.getElementById('medico-veterinario');
            updateMedicoField(rolSelect.value, '', medicoSelect);
            
            loadUsers(); // Recargar la lista
        } else {
            alert(`❌ Error al modificar: ${result.message || result.error || 'Error desconocido'}`);
        }

    } catch (error) {
        console.error('Error de red al modificar:', error);
        alert('Error de conexión con el servidor.');
    }
}


/**
 * Maneja la acción de ELIMINAR (DELETE /api/users/:id).
 */
async function handleDelete() {
    if (!selectedUserId) {
        return alert('Debe seleccionar un usuario de la lista para ELIMINAR.');
    }
    
    if (!confirm(`¿Está seguro que desea eliminar al usuario con ID ${selectedUserId.substring(0, 8)}...? Esta acción es irreversible.`)) {
        return;
    }

    const token = localStorage.getItem('supabase-session-token');

    try {
        const response = await fetch(`${API_BASE_URL}/${selectedUserId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` },
        });

        const result = await response.json();

        if (response.ok) {
            alert('🗑️ Usuario Eliminado exitosamente.');
            selectedUserId = null; // Limpiar selección
            document.getElementById('user-form').reset();
            const rolSelect = document.getElementById('rol');
            const medicoSelect = document.getElementById('medico-veterinario');
            updateMedicoField(rolSelect.value, '', medicoSelect);
            loadUsers(); // Recargar la lista
        } else {
            alert(`❌ Error al eliminar: ${result.message || result.error || 'Error desconocido'}`);
        }
    } catch (error) {
        console.error('Error de red al eliminar:', error);
        alert('Error de conexión con el servidor.');
    }
}

/**
 * Maneja la acción de MODIFICAR (PUT /api/users/:id).
 * Al hacer clic en este botón, forzamos el envío del formulario.
 */
function handleModifyButtonClick() {
    if (!selectedUserId) {
        return alert('Debe seleccionar un usuario de la lista y cargar sus datos para MODIFICAR.');
    }
    
    // Al hacer clic en el botón MODIFICAR, simulamos el submit del formulario
    // para que la función handleFormSubmit se encargue de la lógica de PUT.
    document.getElementById('user-form').dispatchEvent(new Event('submit', { cancelable: true }));
}

function normalizeRole(value) {
    return String(value || '').trim().toLowerCase();
}

async function loadVeterinarios() {
    if (cachedVeterinarios) return cachedVeterinarios;
    const token = localStorage.getItem('supabase-session-token');

    try {
        const response = await fetch(VETERINARIOS_API, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'No se pudo cargar medicos veterinarios.');
        }
        cachedVeterinarios = Array.isArray(data) ? data : [];
        return cachedVeterinarios;
    } catch (error) {
        console.error('Error al cargar medicos veterinarios:', error);
        cachedVeterinarios = [];
        return cachedVeterinarios;
    }
}

async function updateMedicoField(roleValue, selectedValue, medicoSelect) {
    const normalized = normalizeRole(roleValue);
    const isVetRole = normalized === 'veterinario';

    if (!medicoSelect) return;

    if (!isVetRole) {
        medicoSelect.value = '';
        medicoSelect.required = false;
        medicoSelect.disabled = true;
        medicoSelect.classList.add('is-hidden');
        return;
    }

    medicoSelect.disabled = false;
    medicoSelect.required = true;
    medicoSelect.classList.remove('is-hidden');

    const veterinarios = await loadVeterinarios();
    medicoSelect.innerHTML = '<option value="" disabled>Medico Veterinario</option>';
    if (!selectedValue) {
        medicoSelect.options[0].selected = true;
    }

    veterinarios.forEach((name) => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        if (selectedValue && name === selectedValue) {
            option.selected = true;
        }
        medicoSelect.appendChild(option);
    });

    if (selectedValue && medicoSelect.value !== selectedValue) {
        const option = document.createElement('option');
        option.value = selectedValue;
        option.textContent = selectedValue;
        option.selected = true;
        medicoSelect.appendChild(option);
    }
}


/**
 * Maneja el Cierre de Sesión (Logout)
 */
function handleLogout() {
    localStorage.removeItem('supabase-session-token');
    alert('Sesión cerrada. Redirigiendo al login.');
    // Redirige al usuario a la página de inicio de sesión
    window.location.href = 'inicio_sesion.html'; 
}


// ---------------------------------------------
// III. INICIALIZACIÓN
// ---------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Verificación básica de sesión (Frontend)
    if (!localStorage.getItem('supabase-session-token')) {
        alert('Sesión expirada o no iniciada. Redirigiendo al login.');
        window.location.href = 'inicio_sesion.html';
        return;
    }

    // 2. Cargar datos
    loadUsers();

    // 3. Asignar Event Listeners a Formulario y Botones
    
    // CREAR/MODIFICAR: Maneja el submit del formulario
    const userForm = document.getElementById('user-form');
    userForm.addEventListener('submit', handleFormSubmit); // handleFormSubmit ahora maneja CREATE y UPDATE
    const rolSelect = document.getElementById('rol');
    const medicoSelect = document.getElementById('medico-veterinario');
    rolSelect.addEventListener('change', () => updateMedicoField(rolSelect.value, '', medicoSelect));

    // MODIFICAR: Botón de acción (solo dispara el submit si hay un usuario seleccionado)
    const btnModify = document.getElementById('btn-modify');
    btnModify.addEventListener('click', handleModifyButtonClick); // Llama a la nueva función

    // ELIMINAR: Botón de acción
    const btnDelete = document.getElementById('btn-delete');
    btnDelete.addEventListener('click', handleDelete);
    
    // CERRAR SESIÓN
    const logoutBtn = document.getElementById('logout-btn');
    logoutBtn.addEventListener('click', handleLogout);
    
    // Asegurarse de que el campo contraseña sea requerido por defecto para la creación.
    document.getElementById('contrasena').setAttribute('required', 'required');
});
