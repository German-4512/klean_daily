const SEGUIMIENTOS_30_API = '/api/seguimientos_vets';
const SEGUIMIENTOS_45_API = '/api/seguimientos_vets_45';
const AUTH_BASE_URL = '/api/auth';

let seguimientos30 = [];
let seguimientos45 = [];
let currentSegment = '30';

function normalizeValue(value) {
    return String(value || '').trim();
}

function groupBy(items, field) {
    const counts = new Map();
    items.forEach((item) => {
        const raw = item[field];
        const label = normalizeValue(raw) || 'Sin dato';
        counts.set(label, (counts.get(label) || 0) + 1);
    });
    return counts;
}

function buildSortedCounts(map) {
    return Array.from(map.entries())
        .sort((a, b) => b[1] - a[1]);
}

function renderBarList(containerId, counts, highlight = false) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    if (!counts.length) {
        const empty = document.createElement('div');
        empty.className = 'bar-item';
        empty.textContent = 'Sin registros';
        container.appendChild(empty);
        return;
    }

    const maxValue = Math.max(...counts.map(([, value]) => value), 1);
    counts.forEach(([label, value]) => {
        const item = document.createElement('div');
        item.className = 'bar-item';

        const text = document.createElement('div');
        text.className = 'bar-label';
        text.textContent = label;

        const valueEl = document.createElement('div');
        valueEl.className = 'bar-value';
        valueEl.textContent = String(value);

        const track = document.createElement('div');
        track.className = 'bar-track';

        const fill = document.createElement('div');
        fill.className = 'bar-fill';
        if (highlight) {
            fill.style.background = 'linear-gradient(120deg, #ff7a45, #ffc5b0)';
        }
        fill.style.width = `${Math.round((value / maxValue) * 100)}%`;

        track.appendChild(fill);
        item.appendChild(text);
        item.appendChild(valueEl);
        item.appendChild(track);
        container.appendChild(item);
    });
}

function renderNotes(list, field) {
    const container = document.getElementById('notes-list');
    if (!container) return;
    container.innerHTML = '';
    const notes = list
        .map((item) => ({
            text: normalizeValue(item[field]),
            createdAt: item.created_at || item.updated_at || null
        }))
        .filter((item) => item.text);

    notes.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    const sliced = notes.slice(0, 6);

    if (!sliced.length) {
        const empty = document.createElement('li');
        empty.className = 'note-empty';
        empty.textContent = 'Sin observaciones registradas.';
        container.appendChild(empty);
        return;
    }

    sliced.forEach((note) => {
        const item = document.createElement('li');
        item.textContent = note.text;
        container.appendChild(item);
    });
}

function setMetric(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = String(value);
}

function updateMetrics(data) {
    const total = data.length;
    const finalizados = data.filter((item) => normalizeValue(item.estado).toLowerCase() === 'finalizado').length;
    const enProgreso = data.filter((item) => normalizeValue(item.estado).toLowerCase() === 'en progreso').length;
    const conRecordatorio = data.filter((item) => item.recordatorio_sg).length;

    setMetric('metric-total', total);
    setMetric('metric-finalizados', finalizados);
    setMetric('metric-progreso', enProgreso);
    setMetric('metric-recordatorio', conRecordatorio);
}

function togglePanels(segment) {
    const show45 = segment === '45';
    const toggle = (id, visible) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.toggle('is-hidden', !visible);
    };
    toggle('panel-detalle', show45);
    toggle('panel-engagement', show45);
    toggle('panel-uso', show45);
    toggle('panel-recompra', show45);
    toggle('panel-valor', show45);
}

function renderSegment() {
    const data = currentSegment === '45' ? seguimientos45 : seguimientos30;
    updateMetrics(data);
    togglePanels(currentSegment);

    if (currentSegment === '45') {
        renderBarList('chart-contacto', buildSortedCounts(groupBy(data, 'contacto_estado')), true);
        renderBarList('chart-detalle', buildSortedCounts(groupBy(data, 'contacto_detalle')));
        renderBarList('chart-satisfaccion', buildSortedCounts(groupBy(data, 'csat_puntaje')));
        renderBarList('chart-engagement', buildSortedCounts(groupBy(data, 'engagement')));
        renderBarList('chart-uso', buildSortedCounts(groupBy(data, 'uso_producto')));
        renderBarList('chart-recompra', buildSortedCounts(groupBy(data, 'probabilidad_recompra')));
        renderBarList('chart-valor', buildSortedCounts(groupBy(data, 'valor_agregado')));
        renderNotes(data, 'observaciones');
    } else {
        renderBarList('chart-contacto', buildSortedCounts(groupBy(data, 'contactar_cliente')), true);
        renderBarList('chart-satisfaccion', buildSortedCounts(groupBy(data, 'satisfaccion_cliente')));
        renderNotes(data, 'resultados_observaciones');
        renderBarList('chart-detalle', [], false);
        renderBarList('chart-engagement', [], false);
        renderBarList('chart-uso', [], false);
        renderBarList('chart-recompra', [], false);
        renderBarList('chart-valor', [], false);
    }
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
        if (role !== 'invitado') {
            window.location.href = 'inicio_sesion.html';
            return null;
        }

        return token;
    } catch (error) {
        window.location.href = 'inicio_sesion.html';
        return null;
    }
}

async function loadData(token) {
    const [resp30, resp45] = await Promise.all([
        fetch(SEGUIMIENTOS_30_API, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(SEGUIMIENTOS_45_API, { headers: { 'Authorization': `Bearer ${token}` } })
    ]);

    const data30 = await resp30.json();
    const data45 = await resp45.json();

    if (!resp30.ok) {
        console.error('Error al cargar seguimientos 30 dias:', data30);
        seguimientos30 = [];
    } else {
        seguimientos30 = Array.isArray(data30) ? data30 : [];
    }

    if (!resp45.ok) {
        console.error('Error al cargar seguimientos 45 dias:', data45);
        seguimientos45 = [];
    } else {
        seguimientos45 = Array.isArray(data45) ? data45 : [];
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const token = await verifyAccess();
    if (!token) return;

    document.getElementById('logout-btn').addEventListener('click', (event) => {
        event.preventDefault();
        localStorage.removeItem('supabase-session-token');
        localStorage.removeItem('user-rol');
        localStorage.removeItem('user-estado');
        window.location.href = 'inicio_sesion.html';
    });

    document.getElementById('btn-back').addEventListener('click', () => {
        window.location.href = 'invitado_kv.html';
    });

    const segmentButtons = Array.from(document.querySelectorAll('.segment-btn'));
    segmentButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            currentSegment = btn.getAttribute('data-segment') || '30';
            segmentButtons.forEach((item) => item.classList.toggle('active', item === btn));
            renderSegment();
        });
    });

    await loadData(token);
    renderSegment();
});
