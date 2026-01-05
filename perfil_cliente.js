const API_BASE_URL = 'http://localhost:3001/api/clientes_klean_vet';
const GEO_BASE_URL = 'http://localhost:3001/api/geografia_klean_vet';
const AUTH_BASE_URL = 'http://localhost:3001/api/auth';

let currentClientId = null;
let selectedDepartamento = '';

async function verifyAccess() {
    const token = localStorage.getItem('supabase-session-token');
    if (!token) {
        window.location.href = 'inicio_sesion.html';
        return;
    }

    try {
        const response = await fetch(`${AUTH_BASE_URL}/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            window.location.href = 'inicio_sesion.html';
            return;
        }

        const data = await response.json();
        const role = (data.profile?.rol || '').trim().toLowerCase();
        const estado = (data.profile?.estado || '').trim().toLowerCase();
        const isAdmin = role === 'admin';
        const isCallCenter = role === 'asesor comercial callcenter' && estado === 'activo';
        const isAgenteMayor = role === 'agente mayor' && estado === 'activo';

        if (!isAdmin && !isCallCenter && !isAgenteMayor) {
            window.location.href = 'inicio_sesion.html';
        }
    } catch (error) {
        window.location.href = 'inicio_sesion.html';
    }
}

function normalizeText(value) {
    const text = String(value || '').trim();
    return text.length ? text : null;
}

function normalizeNumber(value) {
    if (value === undefined || value === null || value === '') return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
}

function setStatus(message, type) {
    const statusEl = document.getElementById('status-message');
    if (!statusEl) return;
    if (!message) {
        statusEl.className = 'status-message';
        statusEl.textContent = '';
        return;
    }
    statusEl.textContent = message;
    statusEl.className = `status-message show ${type}`;
}

function fillDatalist(listId, items) {
    const list = document.getElementById(listId);
    if (!list) return;
    list.innerHTML = '';
    items.forEach((item) => {
        const option = document.createElement('option');
        option.value = item;
        list.appendChild(option);
    });
}

async function fetchDepartamentos(search) {
    const token = localStorage.getItem('supabase-session-token');
    if (!token) return [];
    const url = `${GEO_BASE_URL}/departamentos?search=${encodeURIComponent(search || '')}`;
    const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data) ? data : [];
}

async function fetchMunicipios(departamento, search) {
    const token = localStorage.getItem('supabase-session-token');
    if (!token) return [];
    const url = `${GEO_BASE_URL}/municipios?departamento=${encodeURIComponent(departamento || '')}&search=${encodeURIComponent(search || '')}`;
    const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data) ? data : [];
}

async function fetchClienteById(id) {
    const token = localStorage.getItem('supabase-session-token');
    if (!token) return null;
    const response = await fetch(`${API_BASE_URL}/${encodeURIComponent(id)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) return null;
    return response.json();
}

async function fetchClienteByDocumento(documento) {
    const token = localStorage.getItem('supabase-session-token');
    if (!token) return null;
    const response = await fetch(`${API_BASE_URL}/buscar?numero_documento=${encodeURIComponent(documento)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) return null;
    return response.json();
}

async function loadCliente() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const documento = params.get('documento');

    let cliente = null;
    if (id) {
        cliente = await fetchClienteById(id);
    } else if (documento) {
        cliente = await fetchClienteByDocumento(documento);
    }

    if (!cliente) {
        setStatus('No se pudo cargar el cliente.', 'status-error');
        return;
    }

    currentClientId = cliente.id_cliente;
    fillForm(cliente);
}

async function fillForm(cliente) {
    const setValue = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.value = value ?? '';
    };

    setValue('tipo_documento', cliente.tipo_documento);
    setValue('numero_documento', cliente.numero_documento);
    setValue('nombre', cliente.nombre);
    setValue('apellido', cliente.apellido);
    setValue('telefono_celular', cliente.telefono_celular);
    setValue('correo_electronico', cliente.correo_electronico);
    setValue('direccion', cliente.direccion);
    setValue('apartamento', cliente.apartamento);
    setValue('torre', cliente.torre);
    setValue('barrio', cliente.barrio);

    setValue('nombre_mascota', cliente.nombre_mascota);
    setValue('raza', cliente.raza);
    setValue('edad', cliente.edad);
    setValue('unidad_edad', cliente.unidad_edad);
    setValue('peso', cliente.peso);
    setValue('especie', cliente.especie);
    setValue('estado_reproductivo', cliente.estado_reproductivo);
    setValue('sexo', cliente.sexo);
    setValue('fecha_nacimiento', cliente.fecha_nacimiento);

    const departamentoInput = document.getElementById('departamento');
    const municipioInput = document.getElementById('municipio');
    if (departamentoInput) {
        departamentoInput.value = cliente.departamento || '';
        selectedDepartamento = cliente.departamento || '';
    }

    if (municipioInput) {
        municipioInput.disabled = !selectedDepartamento;
        if (selectedDepartamento) {
            const items = await fetchMunicipios(selectedDepartamento, '');
            fillDatalist('municipio-list', items);
        }
        municipioInput.value = cliente.municipio || '';
    }
}

async function handleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const submitButton = form.querySelector('.btn-finalize');
    if (!currentClientId) {
        setStatus('No hay cliente cargado.', 'status-error');
        return;
    }

    if (submitButton) submitButton.disabled = true;
    const token = localStorage.getItem('supabase-session-token');
    if (!token) {
        window.location.href = 'inicio_sesion.html';
        return;
    }

    const payload = {
        tipo_documento: normalizeText(document.getElementById('tipo_documento')?.value),
        numero_documento: normalizeText(document.getElementById('numero_documento')?.value),
        nombre: normalizeText(document.getElementById('nombre')?.value),
        apellido: normalizeText(document.getElementById('apellido')?.value),
        telefono_celular: normalizeText(document.getElementById('telefono_celular')?.value),
        correo_electronico: normalizeText(document.getElementById('correo_electronico')?.value),
        departamento: normalizeText(document.getElementById('departamento')?.value),
        municipio: normalizeText(document.getElementById('municipio')?.value),
        fecha_nacimiento: normalizeText(document.getElementById('fecha_nacimiento')?.value),
        direccion: normalizeText(document.getElementById('direccion')?.value),
        apartamento: normalizeText(document.getElementById('apartamento')?.value),
        torre: normalizeText(document.getElementById('torre')?.value),
        barrio: normalizeText(document.getElementById('barrio')?.value),
        nombre_mascota: normalizeText(document.getElementById('nombre_mascota')?.value),
        raza: normalizeText(document.getElementById('raza')?.value),
        peso: normalizeNumber(document.getElementById('peso')?.value),
        edad: normalizeNumber(document.getElementById('edad')?.value),
        unidad_edad: normalizeText(document.getElementById('unidad_edad')?.value),
        especie: normalizeText(document.getElementById('especie')?.value),
        estado_reproductivo: normalizeText(document.getElementById('estado_reproductivo')?.value),
        sexo: normalizeText(document.getElementById('sexo')?.value)
    };

    try {
        const response = await fetch(`${API_BASE_URL}/${encodeURIComponent(currentClientId)}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json().catch(() => ({}));
        if (response.ok) {
            setStatus('Cliente actualizado correctamente.', 'status-success');
        } else {
            setStatus(result.message || 'No se pudo actualizar el cliente.', 'status-error');
        }
    } catch (error) {
        setStatus('No se pudo conectar con el servidor.', 'status-error');
    } finally {
        if (submitButton) submitButton.disabled = false;
    }
}

function setupTabs() {
    const buttons = Array.from(document.querySelectorAll('.tab-btn'));
    const panels = Array.from(document.querySelectorAll('.tab-panel'));

    buttons.forEach((button) => {
        button.addEventListener('click', () => {
            const target = button.dataset.tab;
            buttons.forEach((btn) => btn.classList.toggle('active', btn === button));
            panels.forEach((panel) => panel.classList.toggle('active', panel.id === `tab-${target}`));
        });
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    verifyAccess();
    setupTabs();

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('supabase-session-token');
            localStorage.removeItem('user-rol');
            localStorage.removeItem('user-estado');
            window.location.href = 'inicio_sesion.html';
        });
    }

    const backPageBtn = document.getElementById('btn-back-page');
    if (backPageBtn) {
        backPageBtn.addEventListener('click', () => window.history.back());
    }

    const numeroDocInput = document.getElementById('numero_documento');
    if (numeroDocInput) {
        numeroDocInput.addEventListener('input', function () {
            this.value = this.value.replace(/[^0-9]/g, '');
        });
    }

    const departamentoInput = document.getElementById('departamento');
    const municipioInput = document.getElementById('municipio');
    let deptoTimer = null;
    let municipioTimer = null;

    if (departamentoInput) {
        departamentoInput.addEventListener('input', () => {
            const value = departamentoInput.value.trim();
            selectedDepartamento = '';
            if (municipioInput) {
                municipioInput.value = '';
                municipioInput.disabled = true;
            }
            clearTimeout(deptoTimer);
            deptoTimer = setTimeout(async () => {
                const items = await fetchDepartamentos(value);
                fillDatalist('departamento-list', items);
            }, 250);
        });

        const loadMunicipiosForDepto = async () => {
            const value = departamentoInput.value.trim();
            if (!value) return;
            selectedDepartamento = value;
            if (municipioInput) {
                municipioInput.disabled = false;
                const items = await fetchMunicipios(selectedDepartamento, '');
                fillDatalist('municipio-list', items);
            }
        };

        departamentoInput.addEventListener('change', loadMunicipiosForDepto);
        departamentoInput.addEventListener('blur', loadMunicipiosForDepto);
    }

    if (municipioInput) {
        municipioInput.addEventListener('input', () => {
            const value = municipioInput.value.trim();
            clearTimeout(municipioTimer);
            municipioTimer = setTimeout(async () => {
                if (!selectedDepartamento) return;
                const items = await fetchMunicipios(selectedDepartamento, value);
                fillDatalist('municipio-list', items);
            }, 250);
        });
    }

    if (departamentoInput) {
        fetchDepartamentos('').then((items) => fillDatalist('departamento-list', items));
    }

    const form = document.getElementById('perfil-form');
    if (form) {
        form.addEventListener('submit', handleSubmit);
    }

    await loadCliente();
});
