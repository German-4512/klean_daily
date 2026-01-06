// backend/middlewares/authMiddleware.js

// Importamos el cliente de Supabase (admin) para verificar el token 
// y el cliente estándar para consultas de la DB si es necesario.
const { supabase, supabaseAdmin } = require('../config/supabase'); 

/**
 * Middleware para proteger rutas de administrador.
 * 1. Verifica la existencia y validez del JWT.
 * 2. Verifica que el rol del usuario sea 'admin'.
 */
exports.verifyAdmin = async (req, res, next) => {
    // 1. Obtener el token del header (formato: Bearer <token>)
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        return res.status(401).json({ error: 'Acceso denegado', message: 'Token de autenticación no proporcionado.' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Acceso denegado', message: 'Formato de token inválido.' });
    }

    try {
        // 2. Usar el cliente Admin para obtener el usuario del token (o verificarlo)
        // Usamos el cliente estándar de Supabase para la verificación del token y obtener el ID del usuario
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            console.error("Error al verificar el token:", authError?.message);
            return res.status(401).json({ error: 'Acceso denegado', message: 'Token inválido o expirado.' });
        }

        // El ID del usuario es necesario para la verificación de rol
        const userId = user.id;

        // 3. Consultar la base de datos para verificar el rol
        // Usamos el cliente estándar o admin (ambos pueden hacer select a 'perfiles')
        const { data: userData, error: userError } = await supabaseAdmin
            .from('profiles') // Tablas en inglés se usan en todo el resto del proyecto
            .select('rol')
            .eq('id', userId)
            .single();

        if (userError || !userData) {
             console.error("Error al buscar el perfil en el middleware:", userError?.message);
             return res.status(404).json({ error: 'Acceso denegado', message: 'Perfil de usuario no encontrado.' });
        }

        // 4. Verificar si el usuario tiene el rol de 'admin'
        if (userData.rol !== 'admin') {
            console.warn(`Intento de acceso de usuario no admin: ${user.email} con rol: ${userData.rol}`);
            return res.status(403).json({ error: 'Acceso denegado', message: 'No tiene permisos de administrador.' });
        }
        
        // 5. Adjuntar datos del usuario (opcional) y continuar
        req.user = user;
        req.userRole = userData.rol;
        next();

    } catch (err) {
        console.error('Error interno del middleware de autenticación:', err);
        return res.status(500).json({ error: 'Error del servidor', message: 'Fallo al procesar la autenticación.' });
    }
};

/**
 * Middleware para permitir Admin, Datos y Ventas, Veterinario, o Asesor Comercial CallCenter activo.
 */
exports.verifyAdminOrCallCenterActive = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        return res.status(401).json({ error: 'Acceso denegado', message: 'Token de autenticación no proporcionado.' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Acceso denegado', message: 'Formato de token inválido.' });
    }

    try {
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            console.error("Error al verificar el token:", authError?.message);
            return res.status(401).json({ error: 'Acceso denegado', message: 'Token inválido o expirado.' });
        }

        const { data: userData, error: userError } = await supabaseAdmin
            .from('profiles')
            .select('rol, estado')
            .eq('id', user.id)
            .single();

        if (userError || !userData) {
            console.error("Error al buscar el perfil en el middleware:", userError?.message);
            return res.status(404).json({ error: 'Acceso denegado', message: 'Perfil de usuario no encontrado.' });
        }

        const role = (userData.rol || '').trim().toLowerCase();
        const estado = (userData.estado || '').trim().toLowerCase();
        const isAdmin = role === 'admin';
        const isCallCenter = role === 'asesor comercial callcenter' && estado === 'activo';
        const isDataVentas = role === 'datos y ventas klean vet';
        const isVeterinario = role === 'veterinario';
        const isAgenteMayor = role === 'agente mayor' && estado === 'activo';
        const isInvitado = role === 'invitado';

        if (!isAdmin && !isCallCenter && !isDataVentas && !isVeterinario && !isAgenteMayor && !isInvitado) {
            console.warn(`Intento de acceso no autorizado: ${user.email} con rol: ${userData.rol} estado: ${userData.estado}`);
            return res.status(403).json({ error: 'Acceso denegado', message: 'No tiene permisos para esta acción.' });
        }

        if (isInvitado && req.method !== 'GET') {
            return res.status(403).json({ error: 'Acceso denegado', message: 'No tiene permisos para modificar.' });
        }

        req.user = user;
        req.userRole = userData.rol;
        req.userEstado = userData.estado;
        next();
    } catch (err) {
        console.error('Error interno del middleware de autenticación:', err);
        return res.status(500).json({ error: 'Error del servidor', message: 'Fallo al procesar la autenticación.' });
    }
};

/**
 * Middleware para permitir Admin o Veterinario.
 */
exports.verifyAdminOrVeterinario = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        return res.status(401).json({ error: 'Acceso denegado', message: 'Token de autenticación no proporcionado.' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Acceso denegado', message: 'Formato de token inválido.' });
    }

    try {
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            console.error("Error al verificar el token:", authError?.message);
            return res.status(401).json({ error: 'Acceso denegado', message: 'Token inválido o expirado.' });
        }

        const { data: userData, error: userError } = await supabaseAdmin
            .from('profiles')
            .select('rol, estado')
            .eq('id', user.id)
            .single();

        if (userError || !userData) {
            console.error("Error al buscar el perfil en el middleware:", userError?.message);
            return res.status(404).json({ error: 'Acceso denegado', message: 'Perfil de usuario no encontrado.' });
        }

        const role = (userData.rol || '').trim().toLowerCase();
        const isAdmin = role === 'admin';
        const isVeterinario = role === 'veterinario';
        const isInvitado = role === 'invitado';

        if (!isAdmin && !isVeterinario && !isInvitado) {
            console.warn(`Intento de acceso no autorizado: ${user.email} con rol: ${userData.rol}`);
            return res.status(403).json({ error: 'Acceso denegado', message: 'No tiene permisos para esta acción.' });
        }

        if (isInvitado && req.method !== 'GET') {
            return res.status(403).json({ error: 'Acceso denegado', message: 'No tiene permisos para modificar.' });
        }

        req.user = user;
        req.userRole = userData.rol;
        req.userEstado = userData.estado;
        next();
    } catch (err) {
        console.error('Error interno del middleware de autenticación:', err);
        return res.status(500).json({ error: 'Error del servidor', message: 'Fallo al procesar la autenticación.' });
    }
};
