const API_BASE_URL = 'http://localhost:3001/api/ventas_tutores';
const AUTH_BASE_URL = 'http://localhost:3001/api/auth';

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
        if (role !== 'datos y ventas klean vet' && role !== 'admin') {
            window.location.href = 'inicio_sesion.html';
            return null;
        }

        return token;
    } catch (error) {
        window.location.href = 'inicio_sesion.html';
        return null;
    }
}

function setResult(message, type, details) {
    const container = document.getElementById('upload-result');
    container.hidden = false;
    container.className = `upload-result ${type}`;
    container.innerHTML = `${message}${details ? `<div class="upload-details">${details}</div>` : ''}`;
}

document.addEventListener('DOMContentLoaded', async () => {
    const token = await verifyAccess();
    if (!token) return;

    document.getElementById('btn-back').addEventListener('click', () => window.history.back());

    document.getElementById('logout-btn').addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('supabase-session-token');
        localStorage.removeItem('user-rol');
        localStorage.removeItem('user-estado');
        window.location.href = 'inicio_sesion.html';
    });

    const fileInput = document.getElementById('excel-file');
    const uploadArea = document.getElementById('upload-area');
    const fileName = document.getElementById('file-name');
    const btnPick = document.getElementById('btn-pick');
    const btnUpload = document.getElementById('btn-upload');

    btnPick.addEventListener('click', (event) => {
        event.stopPropagation();
        fileInput.click();
    });
    uploadArea.addEventListener('click', () => fileInput.click());

    uploadArea.addEventListener('dragover', (event) => {
        event.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', (event) => {
        event.preventDefault();
        uploadArea.classList.remove('dragover');
        const droppedFile = event.dataTransfer.files[0];
        if (droppedFile) {
            fileInput.files = event.dataTransfer.files;
            fileName.textContent = droppedFile.name;
        }
    });

    fileInput.addEventListener('change', () => {
        const file = fileInput.files[0];
        fileName.textContent = file ? file.name : 'Ningun archivo seleccionado';
    });

    btnUpload.addEventListener('click', async () => {
        const file = fileInput.files[0];
        if (!file) {
            setResult('Debes seleccionar un archivo antes de cargar.', 'error');
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        btnUpload.disabled = true;
        btnUpload.textContent = 'Cargando...';

        try {
            const response = await fetch(`${API_BASE_URL}/upload`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            const result = await response.json();
            if (!response.ok) {
                setResult(result.message || 'No se pudo cargar el archivo.', 'error');
                return;
            }

            const skippedCount = Array.isArray(result.skipped) ? result.skipped.length : 0;
            const details = skippedCount
                ? `Filas omitidas: ${skippedCount}.`
                : 'Todo se cargo correctamente.';
            setResult(`Ventas cargadas: ${result.inserted || 0}.`, 'success', details);
        } catch (error) {
            console.error('Error al subir ventas:', error);
            setResult('Error de conexion al cargar ventas.', 'error');
        } finally {
            btnUpload.disabled = false;
            btnUpload.textContent = 'Cargar ventas';
        }
    });
});
