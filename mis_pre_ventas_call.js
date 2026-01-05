const API_BASE_URL = 'http://localhost:3001/api/preventascall';
const AUTH_BASE_URL = 'http://localhost:3001/api/auth';

function formatDateTime(value) {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (isNaN(date.getTime())) return value;
    return date.toLocaleString();
}

function normalizeStatus(value) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z]/g, '');
}

async function verifyAccess() {
    const token = localStorage.getItem('supabase-session-token');
    if (!token) {
        window.location.href = 'inicio_sesion.html';
        return null;
    }

    try {
        const response = await fetch(`${AUTH_BASE_URL}/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            window.location.href = 'inicio_sesion.html';
            return null;
        }

        const data = await response.json();
        const role = (data.profile?.rol || '').trim().toLowerCase();
        const estado = (data.profile?.estado || '').trim().toLowerCase();
        const isAdmin = role === 'admin';
        const isCallCenter = role === 'asesor comercial callcenter' && estado === 'activo';

        if (!isAdmin && !isCallCenter) {
            window.location.href = 'inicio_sesion.html';
            return null;
        }

        return token;
    } catch (error) {
        window.location.href = 'inicio_sesion.html';
        return null;
    }
}

async function loadPreventas({ token, preset, date }) {
    const tbody = document.getElementById('preventas-body');
    tbody.innerHTML = '<tr><td colspan="7" class="table-empty">Cargando preventas...</td></tr>';

    const params = new URLSearchParams();
    if (preset) params.append('preset', preset);
    if (date) params.append('date', date);

    try {
        const response = await fetch(`${API_BASE_URL}?${params.toString()}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();
        if (!response.ok) {
            tbody.innerHTML = `<tr><td colspan="7" class="table-empty">Error: ${data.message || 'No se pudo cargar.'}</td></tr>`;
            return;
        }

        if (!data.length) {
            tbody.innerHTML = '<tr><td colspan="7" class="table-empty">No hay registros.</td></tr>';
            return;
        }

        const rows = data.map((item) => {
            const statusText = item.estado_preventa || 'Pendiente Confirmar';
            const statusClass = normalizeStatus(statusText) === 'confirmada' || normalizeStatus(statusText) === 'confirmado'
                ? 'status-confirmed'
                : 'status-pending';
            return `
            <tr>
                <td>${formatDateTime(item.fechapreventa)}</td>
                <td>${formatDateTime(item.fechaatencion)}</td>
                <td>${item.nombre_paciente || 'N/A'}</td>
                <td>${item.nombre_tutor || 'N/A'}</td>
                <td>${item.tel_contacto || 'N/A'}</td>
                <td>${item.notas || ''}</td>
                <td><span class="${statusClass}">${statusText}</span></td>
            </tr>
            `;
        }).join('');

        tbody.innerHTML = rows;
    } catch (error) {
        console.error('Error al cargar preventas:', error);
        tbody.innerHTML = '<tr><td colspan="7" class="table-empty">Error de conexión.</td></tr>';
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const token = await verifyAccess();
    if (!token) return;

    const backBtn = document.getElementById('btn-back');
    backBtn.addEventListener('click', () => window.history.back());

    const logoutBtn = document.getElementById('logout-btn');
    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('supabase-session-token');
        localStorage.removeItem('user-rol');
        localStorage.removeItem('user-estado');
        window.location.href = 'inicio_sesion.html';
    });

    const dateInput = document.getElementById('filter-date');
    const btnApply = document.getElementById('btn-filter-date');
    const btnClear = document.getElementById('btn-clear');
    const presetButtons = document.querySelectorAll('[data-preset]');

    function setActivePreset(activeButton) {
        presetButtons.forEach((btn) => btn.classList.remove('active'));
        if (activeButton) activeButton.classList.add('active');
    }

    btnApply.addEventListener('click', () => {
        const date = dateInput.value;
        setActivePreset(null);
        loadPreventas({ token, date });
    });

    btnClear.addEventListener('click', () => {
        dateInput.value = '';
        setActivePreset(null);
        loadPreventas({ token });
    });

    presetButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            const preset = btn.getAttribute('data-preset');
            setActivePreset(btn);
            dateInput.value = '';
            loadPreventas({ token, preset });
        });
    });

    loadPreventas({ token });
});
