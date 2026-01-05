const AUTH_BASE_URL = '/api/auth';

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
        const isAdmin = role === 'admin';
        const isAgenteMayor = role === 'agente mayor';

        if (!isAdmin && !isAgenteMayor) {
            window.location.href = 'inicio_sesion.html';
            return null;
        }

        return token;
    } catch (error) {
        window.location.href = 'inicio_sesion.html';
        return null;
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const token = await verifyAccess();
    if (!token) return;

    const backButton = document.getElementById('btn-back');
    if (backButton) {
        backButton.addEventListener('click', () => window.history.back());
    }

    document.getElementById('logout-btn').addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('supabase-session-token');
        localStorage.removeItem('user-rol');
        localStorage.removeItem('user-estado');
        window.location.href = 'inicio_sesion.html';
    });
});
