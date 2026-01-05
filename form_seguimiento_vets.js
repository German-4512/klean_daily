const SEGUIMIENTOS_API = '/api/seguimientos_vets';
const SEGUIMIENTOS_PROGRESS_API = `${SEGUIMIENTOS_API}/progreso`;

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

function getFieldValue(id) {
    const element = document.getElementById(id);
    if (!element) return null;
    const value = String(element.value || '').trim();
    return value ? value : null;
}

function fillFieldValue(id, value) {
    if (value === null || value === undefined) return;
    const element = document.getElementById(id);
    if (!element) return;
    element.value = value;
}

async function loadSavedProgress(token, ventaConfirmadaId, seguimientoDias) {
    try {
        const response = await fetch(`${SEGUIMIENTOS_API}?venta_confirmada_id=${encodeURIComponent(ventaConfirmadaId)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (!response.ok) return null;
        const normalized = String(seguimientoDias || '').trim().toLowerCase();
        const match = (Array.isArray(data) ? data : []).find((item) =>
            String(item.seguimiento_dias || '').trim().toLowerCase() === normalized
        );
        return match || null;
    } catch (error) {
        console.error('Error al cargar progreso:', error);
        return null;
    }
}

async function saveProgress(token, payload) {
    try {
        const sanitized = { ...payload };
        Object.keys(sanitized).forEach((key) => {
            if (sanitized[key] === null || sanitized[key] === undefined || sanitized[key] === '') {
                delete sanitized[key];
            }
        });
        await fetch(SEGUIMIENTOS_PROGRESS_API, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(sanitized)
        });
    } catch (error) {
        console.error('Error al guardar progreso:', error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
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

    const body = document.body;
    const seguimientoDias = body.getAttribute('data-seguimiento') || '';
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
    const step1ContinueBtn = document.querySelector('#step-1 [data-next]');
    const step1FinalizeBtn = document.querySelector('#step-1 [data-finalize]');
    const contactSelect = document.getElementById('contactar_cliente');
    let currentIndex = 0;
    const resumeProgress = async () => {
        const saved = await loadSavedProgress(token, ventaConfirmadaId, seguimientoDias);
        const hastaAqui = Number(saved?.hasta_aqui) || 0;
        fillFieldValue('contactar_cliente', saved?.contactar_cliente);
        fillFieldValue('satisfaccion_cliente', saved?.satisfaccion_cliente);
        fillFieldValue('efectos_secundarios', saved?.efectos_secundarios);
        fillFieldValue('resultados_observaciones', saved?.resultados_observaciones);
        if (hastaAqui > 0 && String(saved?.estado || '').trim().toLowerCase() !== 'finalizado') {
            currentIndex = Math.min(Math.max(hastaAqui - 1, 0), steps.length - 1);
        }
        showStep(steps, currentIndex);
        updateProgress(currentIndex, steps.length);
        if (step1ContinueBtn && contactSelect) {
            step1ContinueBtn.disabled = contactSelect.value !== 'Ha contestado';
        }
        if (step1FinalizeBtn && contactSelect) {
            const finalizable = contactSelect.value === 'Fallecido' || contactSelect.value === 'Tratamiento Suspendido';
            step1FinalizeBtn.disabled = !finalizable;
        }
    };
    resumeProgress();

    document.querySelectorAll('[data-next]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const step = steps[currentIndex];
            const requiredFields = step.querySelectorAll('select[required], textarea[required]');
            let valid = true;
            requiredFields.forEach((field) => {
                if (!getRequiredValue(field)) {
                    valid = false;
                }
            });
            if (!valid) return;
            if (currentIndex === 0) {
                const contacto = String(contactSelect?.value || '').trim();
                if (contacto !== 'Ha contestado') {
                    alert('Si no ha contestado, usa "Dejar Hasta Aqui".');
                    return;
                }
            }
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
                seguimiento_dias: seguimientoDias,
                hasta_aqui: currentIndex + 1,
                recordatorio_sg: new Date().toISOString(),
                estado: 'En progreso',
                contactar_cliente: getFieldValue('contactar_cliente'),
                satisfaccion_cliente: getFieldValue('satisfaccion_cliente'),
                efectos_secundarios: getFieldValue('efectos_secundarios'),
                resultados_observaciones: getFieldValue('resultados_observaciones')
            };
            saveProgress(token, {
                ...progressPayload
            }).finally(() => {
                window.location.href = 'seguimiento_vets.html';
            });
        });
    });

    if (contactSelect && step1ContinueBtn) {
        contactSelect.addEventListener('change', () => {
            step1ContinueBtn.disabled = contactSelect.value !== 'Ha contestado';
        });
    }
    if (contactSelect && step1FinalizeBtn) {
        contactSelect.addEventListener('change', () => {
            const finalizable = contactSelect.value === 'Fallecido' || contactSelect.value === 'Tratamiento Suspendido';
            step1FinalizeBtn.disabled = !finalizable;
        });
        step1FinalizeBtn.addEventListener('click', async () => {
            if (step1FinalizeBtn.disabled) return;
            const contacto = getRequiredValue(contactSelect);
            if (!contacto) return;
            const payload = {
                venta_confirmada_id: ventaConfirmadaId,
                seguimiento_dias: seguimientoDias,
                contactar_cliente: contacto,
                estado: 'Finalizado',
                recordatorio_sg: null,
                hasta_aqui: 1
            };

            try {
                const response = await fetch(SEGUIMIENTOS_API, {
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
                console.error('Error al guardar seguimiento:', error);
                alert('Error de conexion al guardar.');
            }
        });
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const contactarCliente = getRequiredValue(document.getElementById('contactar_cliente'));
        const satisfaccionCliente = getRequiredValue(document.getElementById('satisfaccion_cliente'));
        const efectosSecundarios = getRequiredValue(document.getElementById('efectos_secundarios'));
        const resultadosObservaciones = getRequiredValue(document.getElementById('resultados_observaciones'));

        if (!contactarCliente || !satisfaccionCliente || !efectosSecundarios || !resultadosObservaciones) {
            return;
        }

        const payload = {
            venta_confirmada_id: ventaConfirmadaId,
            seguimiento_dias: seguimientoDias,
            contactar_cliente: contactarCliente,
            satisfaccion_cliente: satisfaccionCliente,
            efectos_secundarios: efectosSecundarios,
            resultados_observaciones: resultadosObservaciones,
            estado: 'Finalizado',
            recordatorio_sg: null,
            hasta_aqui: steps.length
        };

        try {
            const response = await fetch(SEGUIMIENTOS_API, {
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
            console.error('Error al guardar seguimiento:', error);
            alert('Error de conexion al guardar.');
        }
    });
});
