const API_BASE_URL = 'http://localhost:3001/api/clientes_klean_vet';
const GEO_BASE_URL = 'http://localhost:3001/api/geografia_klean_vet';
const AUTH_BASE_URL = 'http://localhost:3001/api/auth';
let asesorNombre = '';

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
        asesorNombre = String(data.profile?.nombre_apellido || data.profile?.email || '').trim();
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

function setResult(message, type) {
    const resultEl = document.getElementById('search-result');
    if (!resultEl) return;
    resultEl.textContent = message;
    resultEl.className = `search-result show ${type}`;
}

function showForm(shouldShow) {
    const form = document.getElementById('registro-form');
    if (!form) return;
    form.hidden = !shouldShow;
}

function lockSearch(locked) {
    const searchInput = document.getElementById('search-num-doc');
    const searchButton = document.getElementById('btn-search');
    const viewProfileButton = document.getElementById('btn-view-profile');
    if (searchInput) searchInput.disabled = locked;
    if (searchButton) searchButton.disabled = locked;
    if (viewProfileButton) viewProfileButton.disabled = locked;
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

async function handleSearch() {
    const searchInput = document.getElementById('search-num-doc');
    const searchValue = normalizeText(searchInput?.value);

    if (!searchValue) {
        setResult('Ingresa un numero de documento valido.', 'result-warning');
        showForm(false);
        return;
    }

    const token = localStorage.getItem('supabase-session-token');
    if (!token) {
        window.location.href = 'inicio_sesion.html';
        return;
    }

    lockSearch(true);
    setResult('Buscando cliente...', 'result-warning');
    let foundClient = null;

    try {
        const response = await fetch(`${API_BASE_URL}/buscar?numero_documento=${encodeURIComponent(searchValue)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const data = await response.json();
            foundClient = data;
            const name = [data.nombre, data.apellido].filter(Boolean).join(' ');
            const contact = data.telefono_celular ? `Tel: ${data.telefono_celular}` : '';
            const detail = [name, contact].filter(Boolean).join(' | ');
            setResult(`Cliente registrado. ${detail}`, 'result-success');
            showForm(false);
        } else if (response.status === 404) {
            setResult('Cliente no registrado. Completa el formulario para registrarlo.', 'result-warning');
            showForm(true);
            const numeroDocField = document.getElementById('numero_documento');
            if (numeroDocField) numeroDocField.value = searchValue;
        } else {
            const errorData = await response.json().catch(() => ({}));
            setResult(errorData.message || 'No se pudo validar el cliente.', 'result-error');
            showForm(false);
        }
    } catch (error) {
        setResult('No se pudo conectar con el servidor.', 'result-error');
        showForm(false);
    } finally {
        lockSearch(false);
        const viewProfileButton = document.getElementById('btn-view-profile');
        if (viewProfileButton) {
            if (foundClient?.id_cliente) {
                viewProfileButton.dataset.clienteId = String(foundClient.id_cliente);
                viewProfileButton.disabled = false;
            } else {
                viewProfileButton.dataset.clienteId = '';
                viewProfileButton.disabled = true;
            }
        }
    }
}

async function handleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const submitButton = form.querySelector('.btn-finalize');
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
        asesor: asesorNombre,
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
        const response = await fetch(API_BASE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json().catch(() => ({}));

        if (response.ok) {
            setResult('Cliente registrado correctamente.', 'result-success');
            showForm(false);
            form.reset();
        } else {
            setResult(result.message || 'No se pudo registrar el cliente.', 'result-error');
        }
    } catch (error) {
        setResult('No se pudo conectar con el servidor.', 'result-error');
    } finally {
        if (submitButton) submitButton.disabled = false;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    verifyAccess();

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

    const searchInput = document.getElementById('search-num-doc');
    if (searchInput) {
        searchInput.addEventListener('input', function () {
            this.value = this.value.replace(/[^0-9]/g, '');
            const viewProfileButton = document.getElementById('btn-view-profile');
            if (viewProfileButton) {
                viewProfileButton.dataset.clienteId = '';
                viewProfileButton.disabled = true;
            }
        });
    }

    const numeroDocInput = document.getElementById('numero_documento');
    if (numeroDocInput) {
        numeroDocInput.addEventListener('input', function () {
            this.value = this.value.replace(/[^0-9]/g, '');
        });
    }

    const searchButton = document.getElementById('btn-search');
    if (searchButton) {
        searchButton.addEventListener('click', handleSearch);
    }

    if (searchInput) {
        searchInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                handleSearch();
            }
        });
    }

    const form = document.getElementById('registro-form');
    if (form) {
        form.addEventListener('submit', handleSubmit);
    }

    const clearButton = document.getElementById('btn-clear-form');
    if (clearButton && form) {
        clearButton.addEventListener('click', () => form.reset());
    }

    const viewProfileButton = document.getElementById('btn-view-profile');
    if (viewProfileButton) {
        viewProfileButton.addEventListener('click', () => {
            const clienteId = viewProfileButton.dataset.clienteId;
            if (!clienteId) return;
            window.location.href = `perfil_cliente.html?id=${encodeURIComponent(clienteId)}`;
        });
    }

    const departamentoInput = document.getElementById('departamento');
    const municipioInput = document.getElementById('municipio');
    let deptoTimer = null;
    let municipioTimer = null;
    let selectedDepartamento = '';

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
});
