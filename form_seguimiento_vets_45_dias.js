const SEGUIMIENTOS_45_API = '/api/seguimientos_vets_45';
const SEGUIMIENTOS_45_PROGRESS_API = `${SEGUIMIENTOS_45_API}/progreso`;

function getRequiredValue(element) {
    const value = String(element.value || '').trim();
    if (!value) {
        element.classList.add('input-error');
        return null;
    }
    element.classList.remove('input-error');
    return value;
}

function updateProgress(currentIndex, totalSteps) {
    const progressFill = document.getElementById('progress-fill');
    const dots = document.querySelectorAll('.step-dot');
    const percent = ((currentIndex + 1) / totalSteps) * 100;
    progressFill.style.width = `${percent}%`;
    dots.forEach((dot, index) => {
        dot.classList.toggle('active', index <= currentIndex);
    });
}

function showStep(steps, index) {
    steps.forEach((step, idx) => {
        step.classList.toggle('active', idx === index);
    });
}

function fillFieldValue(id, value) {
    if (value === null || value === undefined) return;
    const element = document.getElementById(id);
    if (!element) return;
    element.value = value;
}

function getFieldValue(id) {
    const element = document.getElementById(id);
    if (!element) return null;
    const value = String(element.value || '').trim();
    return value ? value : null;
}

async function saveProgress(token, payload) {
    try {
        const sanitized = { ...payload };
        Object.keys(sanitized).forEach((key) => {
            if (sanitized[key] === null || sanitized[key] === undefined || sanitized[key] === '') {
                delete sanitized[key];
            }
        });
        await fetch(SEGUIMIENTOS_45_PROGRESS_API, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(sanitized)
        });
    } catch (error) {
        console.error('Error al guardar progreso 45 dias:', error);
    }
}

async function loadSavedData(token, ventaConfirmadaId) {
    try {
        const response = await fetch(`${SEGUIMIENTOS_45_API}?venta_confirmada_id=${encodeURIComponent(ventaConfirmadaId)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (!response.ok) return null;
        return Array.isArray(data) && data.length ? data[0] : null;
    } catch (error) {
        console.error('Error al cargar seguimiento 45 dias:', error);
        return null;
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('supabase-session-token');
    if (!token) {
        window.location.href = 'inicio_sesion.html';
        return;
    }

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (event) => {
            event.preventDefault();
            localStorage.removeItem('supabase-session-token');
            localStorage.removeItem('user-rol');
            localStorage.removeItem('user-estado');
            window.location.href = 'inicio_sesion.html';
        });
    }

    const backBtn = document.getElementById('btn-back-page');
    if (backBtn) {
        backBtn.addEventListener('click', () => window.history.back());
    }

    const form = document.getElementById('seguimiento-form');
    const ventaConfirmadaIdInput = document.getElementById('venta_confirmada_id');
    const params = new URLSearchParams(window.location.search);
    const ventaConfirmadaId = params.get('venta_confirmada_id');

    if (!ventaConfirmadaId) {
        alert('Falta el id de la venta confirmada.');
        window.location.href = 'seguimiento_vets.html';
        return;
    }

    ventaConfirmadaIdInput.value = ventaConfirmadaId;

    const steps = Array.from(document.querySelectorAll('.form-step'));
    let currentIndex = 0;
    showStep(steps, currentIndex);
    updateProgress(currentIndex, steps.length);

    const saved = await loadSavedData(token, ventaConfirmadaId);
    if (saved) {
        fillFieldValue('contacto_estado', saved.contacto_estado);
        fillFieldValue('contacto_detalle', saved.contacto_detalle);
        fillFieldValue('csat_puntaje', saved.csat_puntaje);
        fillFieldValue('csat_justificacion', saved.csat_justificacion);
        fillFieldValue('engagement', saved.engagement);
        fillFieldValue('uso_producto', saved.uso_producto);
        fillFieldValue('probabilidad_recompra', saved.probabilidad_recompra);
        fillFieldValue('valor_agregado', saved.valor_agregado);
        fillFieldValue('observaciones', saved.observaciones);
        fillFieldValue('proximo_contacto', saved.proximo_contacto);
        const hastaAqui = Number(saved.hasta_aqui) || 0;
        if (hastaAqui > 0 && String(saved.estado || '').trim().toLowerCase() !== 'finalizado') {
            currentIndex = Math.min(Math.max(hastaAqui - 1, 0), steps.length - 1);
            showStep(steps, currentIndex);
            updateProgress(currentIndex, steps.length);
        }
    }

    document.querySelectorAll('[data-next]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const step = steps[currentIndex];
            const requiredFields = step.querySelectorAll('select[required], textarea[required], input[required]');
            let valid = true;
            requiredFields.forEach((field) => {
                if (!getRequiredValue(field)) {
                    valid = false;
                }
            });
            if (!valid) return;
            currentIndex = Math.min(currentIndex + 1, steps.length - 1);
            showStep(steps, currentIndex);
            updateProgress(currentIndex, steps.length);
        });
    });

    document.querySelectorAll('[data-prev]').forEach((btn) => {
        btn.addEventListener('click', () => {
            currentIndex = Math.max(currentIndex - 1, 0);
            showStep(steps, currentIndex);
            updateProgress(currentIndex, steps.length);
        });
    });

    document.querySelectorAll('[data-reminder]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const progressPayload = {
                venta_confirmada_id: ventaConfirmadaId,
                hasta_aqui: currentIndex + 1,
                recordatorio_sg: new Date().toISOString(),
                estado: 'En progreso',
                contacto_estado: getFieldValue('contacto_estado'),
                contacto_detalle: getFieldValue('contacto_detalle'),
                csat_puntaje: getFieldValue('csat_puntaje'),
                csat_justificacion: getFieldValue('csat_justificacion'),
                engagement: getFieldValue('engagement'),
                uso_producto: getFieldValue('uso_producto'),
                probabilidad_recompra: getFieldValue('probabilidad_recompra'),
                valor_agregado: getFieldValue('valor_agregado'),
                observaciones: getFieldValue('observaciones'),
                proximo_contacto: getFieldValue('proximo_contacto')
            };
            saveProgress(token, progressPayload).finally(() => {
                window.location.href = 'seguimiento_vets.html';
            });
        });
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const contactoEstado = getRequiredValue(document.getElementById('contacto_estado'));
        const contactoDetalle = getRequiredValue(document.getElementById('contacto_detalle'));
        const csatPuntaje = getRequiredValue(document.getElementById('csat_puntaje'));
        const csatJustificacion = getRequiredValue(document.getElementById('csat_justificacion'));
        const engagement = getRequiredValue(document.getElementById('engagement'));
        const usoProducto = getRequiredValue(document.getElementById('uso_producto'));
        const probabilidadRecompra = getRequiredValue(document.getElementById('probabilidad_recompra'));
        const valorAgregado = getRequiredValue(document.getElementById('valor_agregado'));
        const observaciones = getRequiredValue(document.getElementById('observaciones'));
        const proximoContacto = getRequiredValue(document.getElementById('proximo_contacto'));

        if (!contactoEstado || !contactoDetalle || !csatPuntaje || !csatJustificacion
            || !engagement || !usoProducto || !probabilidadRecompra || !valorAgregado
            || !observaciones || !proximoContacto) {
            return;
        }

        const payload = {
            venta_confirmada_id: ventaConfirmadaId,
            contacto_estado: contactoEstado,
            contacto_detalle: contactoDetalle,
            csat_puntaje: csatPuntaje,
            csat_justificacion: csatJustificacion,
            engagement,
            uso_producto: usoProducto,
            probabilidad_recompra: probabilidadRecompra,
            valor_agregado: valorAgregado,
            observaciones,
            proximo_contacto: proximoContacto,
            estado: 'Finalizado',
            recordatorio_sg: null,
            hasta_aqui: steps.length
        };

        try {
            const response = await fetch(SEGUIMIENTOS_45_API, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            if (!response.ok) {
                alert(result.message || 'No se pudo guardar el seguimiento.');
                return;
            }

            window.location.href = 'seguimiento_vets.html';
        } catch (error) {
            console.error('Error al guardar seguimiento 45 dias:', error);
            alert('Error de conexion al guardar.');
        }
    });
});
