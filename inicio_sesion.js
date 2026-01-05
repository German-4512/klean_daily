// Definimos la URL base de nuestro Backend de Node.js
// Usamos el prefijo /api/auth que definimos en el server.js
const API_BASE_URL = 'http://localhost:3001/api/auth'; 

/**
 * Función principal para manejar el envío del formulario de inicio de sesión.
 * @param {Event} event El evento de envío del formulario (submit).
 */
async function handleLogin(event) {
    // 1. PREVENIR LA RECARGA DE PÁGINA: Es fundamental para el flujo AJAX.
    event.preventDefault();

    // 2. OBTENER ELEMENTOS Y VALORES DEL DOM
    // El HTML usa los IDs 'usuario' y 'contrasena'
    const emailInput = document.getElementById('usuario'); 
    const passwordInput = document.getElementById('contrasena');

    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();
    
    // Opcional: Desactivar el botón para evitar envíos dobles
    const loginButton = document.querySelector('.btn-primary');
    loginButton.disabled = true; 
    loginButton.textContent = 'Iniciando...';


    // 3. VALIDACIÓN BÁSICA DE DATOS
    if (!email || !password) {
        alert('Por favor, ingrese tanto el usuario como la contraseña.');
        loginButton.disabled = false;
        loginButton.textContent = 'Iniciar sesión';
        return;
    }

    try {
        // 4. ENVIAR DATOS AL BACKEND (POST /api/auth/login)
        const response = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            // Enviamos el objeto JSON que el controlador de Node.js espera
            body: JSON.stringify({ email, password }), 
        });

        // 5. PROCESAR LA RESPUESTA DEL BACKEND
        const data = await response.json();

        if (response.ok) {
            // CÓDIGO 200 (OK): Inicio de sesión exitoso
            console.log('✅ Login exitoso. Sesión obtenida:', data.session);
            
            // Tarea Detallista: Almacenamiento del token JWT
            localStorage.setItem('supabase-session-token', data.session.access_token);
            localStorage.setItem('user-rol', data.profile?.rol || '');
            localStorage.setItem('user-estado', data.profile?.estado || '');
            
            alert('¡Bienvenido a KLEAN DAILY! Redirigiendo...');
            
            // Redirección por rol
            const role = (data.profile?.rol || '').trim().toLowerCase();
        if (role === 'admin') {
            window.location.href = 'admin.html';
        } else if (role === 'datos y ventas klean vet') {
            window.location.href = 'datos_ventas_kv.html';
        } else if (role === 'asesor comercial callcenter') {
            window.location.href = 'agentes_call.html';
        } else if (role === 'veterinario') {
            window.location.href = 'veterinario_tutores.html';
        } else if (role === 'agente mayor') {
            window.location.href = 'rendimiento_dia.html';
        } else if (role === 'invitado') {
            window.location.href = 'invitado_kv.html';
        } else {
            window.location.href = 'inicio_sesion.html';
        }

        } else {
            // CÓDIGOS DE ERROR (401, 400, etc.):
            console.error('❌ Error en el login:', data.error, data.message);
            alert(`Error al iniciar sesión: ${data.message || 'Credenciales inválidas.'}`);
        }

    } catch (error) {
        // ERROR DE RED O CONEXIÓN: El servidor está inactivo, fallo de DNS, etc.
        console.error('🚨 Error de conexión o servidor caído:', error);
        alert('No se pudo conectar con el servidor. Por favor, verifique la conexión.');
    } finally {
        // 6. RESTAURAR EL BOTÓN (se ejecuta siempre, haya éxito o error)
        loginButton.disabled = false;
        loginButton.textContent = 'Iniciar sesión';
    }
}

// 7. ASIGNAR EL EVENT LISTENER
// Esperamos a que todo el contenido HTML esté cargado antes de manipular el DOM.
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.querySelector('.login-form');
    
    if (loginForm) {
        // Adjuntamos la función 'handleLogin' al evento 'submit' del formulario
        loginForm.addEventListener('submit', handleLogin);
    } else {
        // Mensaje de error detallado si el selector es incorrecto
        console.error('Error: El formulario de clase ".login-form" no fue encontrado. Verifique el HTML.');
    }
});
