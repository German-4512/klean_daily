// form_call.js
const API_BASE_URL = '/api/preventascall';
const AUTH_BASE_URL = '/api/auth';

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

function getRoleRedirect() {
    const role = (localStorage.getItem('user-rol') || '').trim().toLowerCase();
    if (role === 'agente mayor') return 'rendimiento_dia.html';
    if (role === 'asesor comercial callcenter') return 'agentes_call.html';
    if (role === 'admin') return 'admin.html';
    return 'inicio_sesion.html';
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

    const numDocInput = document.getElementById('num_doc');
    if (numDocInput) {
        numDocInput.addEventListener('input', function () {
            this.value = this.value.replace(/[^0-9]/g, '');
        });
    }

    const steps = Array.from(document.querySelectorAll('.form-step'));
    const stepDots = Array.from(document.querySelectorAll('.step-dot'));
    const progressFill = document.getElementById('progress-fill');
    let currentIndex = steps.findIndex((step) => step.classList.contains('active'));
    if (currentIndex < 0) currentIndex = 0;

    function updateStep(index) {
        currentIndex = index;
        steps.forEach((step, idx) => {
            step.classList.toggle('active', idx === currentIndex);
        });
        stepDots.forEach((dot, idx) => {
            dot.classList.toggle('active', idx <= currentIndex);
        });
        if (progressFill) {
            const percent = ((currentIndex + 1) / steps.length) * 100;
            progressFill.style.width = `${percent}%`;
        }
    }

    function validateStep(index) {
        const currentStep = steps[index];
        if (currentStep && currentStep.id === 'step-3') {
            const productSelects = Array.from(currentStep.querySelectorAll('select[id^="produc_"]'));
            const qtyInputs = Array.from(currentStep.querySelectorAll('input[id^="cant_"]'));
            let hasValidPair = false;
            let hasErrors = false;

            productSelects.forEach((select, idx) => {
                const qtyInput = qtyInputs[idx];
                const productValue = (select?.value || '').trim();
                const qtyValue = qtyInput?.value ?? '';
                const qtyNumber = Number(qtyValue);
                const hasQty = qtyValue !== '' && Number.isFinite(qtyNumber) && qtyNumber > 0;

                const productValid = Boolean(productValue);
                select.classList.toggle('input-error', !productValid && hasQty);
                if (qtyInput) {
                    qtyInput.classList.toggle('input-error', productValid && !hasQty);
                }

                if (productValid && !hasQty) {
                    hasErrors = true;
                } else if (!productValid && hasQty) {
                    hasErrors = true;
                } else if (productValid && hasQty) {
                    hasValidPair = true;
                }
            });

            if (!hasValidPair) {
                alert('Debes indicar al menos 1 producto y su cantidad.');
                return false;
            }

            if (hasErrors) {
                alert('Si eliges un producto debes indicar su cantidad (mayor a 0).');
                return false;
            }

            return true;
        }

        const inputs = currentStep.querySelectorAll('input[required], select[required]');
        let allValid = true;
        inputs.forEach((input) => {
            const isValid = Boolean(input.value);
            input.classList.toggle('input-error', !isValid);
            if (!isValid) allValid = false;
        });
        if (!allValid) {
            alert('Por favor completa los campos obligatorios.');
        }
        return allValid;
    }

    function goNext(skipValidation) {
        if (!skipValidation && !validateStep(currentIndex)) return;
        if (currentIndex < steps.length - 1) {
            updateStep(currentIndex + 1);
        }
    }

    function goPrev() {
        if (currentIndex > 0) {
            updateStep(currentIndex - 1);
        }
    }

    document.querySelectorAll('[data-next]').forEach((btn) => {
        btn.addEventListener('click', () => goNext(false));
    });

    document.querySelectorAll('[data-skip]').forEach((btn) => {
        btn.addEventListener('click', () => goNext(true));
    });

    document.querySelectorAll('[data-prev]').forEach((btn) => {
        btn.addEventListener('click', goPrev);
    });

    updateStep(currentIndex);
});

// Envío final
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('pre-venta-form');
    if (!form) return;
    const submitButton = form.querySelector('.btn-finalize');
    let isSubmitting = false;

    form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    isSubmitting = true;
    if (submitButton) submitButton.disabled = true;
    
    const token = localStorage.getItem('supabase-session-token');
    if (!token) {
        window.location.href = 'inicio_sesion.html';
        isSubmitting = false;
        if (submitButton) submitButton.disabled = false;
        return;
    }

    const payload = {
        num_doc: document.getElementById('num_doc').value.trim(),
        tipo_doc: document.getElementById('tipo_doc').value,
        nombre_paciente: document.getElementById('nombre_paciente').value.trim(),
        nombre_tutor: document.getElementById('nombre_tutor').value.trim(),
        tel_contacto: document.getElementById('tel_contacto').value.trim(),
        produc_1: document.getElementById('produc_1').value.trim(),
        cant_1: document.getElementById('cant_1').value,
        produc_2: document.getElementById('produc_2').value.trim(),
        cant_2: document.getElementById('cant_2').value,
        produc_3: document.getElementById('produc_3').value.trim(),
        cant_3: document.getElementById('cant_3').value,
        produc_4: document.getElementById('produc_4').value.trim(),
        cant_4: document.getElementById('cant_4').value,
        id_ads: document.getElementById('id_ads').value.trim(),
        origen_leads: document.getElementById('origen_leads').value.trim(),
        fechaatencion: document.getElementById('fecha_atencion').value
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

        const result = await response.json();

        if (response.ok) {
            alert('¡Pre Venta Guardada con éxito!');
            window.location.href = getRoleRedirect();
        } else {
            console.error('Detalle error backend:', result);
            alert(`Error al guardar: ${result.message || 'Error desconocido'}`);
            isSubmitting = false;
            if (submitButton) submitButton.disabled = false;
        }
    } catch (error) {
        console.error('Error al guardar pre venta:', error);
        alert('No se pudo conectar con el servidor.');
        isSubmitting = false;
        if (submitButton) submitButton.disabled = false;
    }
    });
});
