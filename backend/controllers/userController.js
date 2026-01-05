// backend/controllers/userController.js

const { supabaseAdmin } = require('../config/supabase'); 

function isMissingMedicoColumn(error) {
    const message = String(error?.message || '');
    return /medico_veterinario/i.test(message) && /column/i.test(message);
}

// ------------------------------------------------------------------
// CREAR USUARIO (POST /api/users)
// ------------------------------------------------------------------
exports.createUser = async (req, res) => {
    const { email, password, nombre_apellido, rol, estado, medico_veterinario } = req.body;
    
    if (!email || !password || !nombre_apellido || !rol || !estado) {
        return res.status(400).json({ message: 'Faltan campos obligatorios.' });
    }

    try {
        // 1. Crear el usuario en el sistema de autenticación (Auth Admin)
        const { data: userData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: email,
            password: password,
            email_confirm: true, // Auto-confirma el email para que pueda loguear de inmediato
        });

        if (authError) {
            return res.status(400).json({ message: 'Error al crear usuario en Auth', error: authError.message });
        }
        
        const userId = userData.user.id;

        // 2. Insertar información adicional en la tabla 'profiles'
        let profileError = null;
        ({
            error: profileError
        } = await supabaseAdmin
            .from('profiles')
            .insert([
                { 
                    id: userId,
                    nombre_apellido: nombre_apellido,
                    rol: rol,
                    estado: estado,
                    email: email, // Guardamos el email aquí también para facilitar las consultas
                    medico_veterinario: medico_veterinario || null
                }
            ]));

        if (profileError && isMissingMedicoColumn(profileError)) {
            ({
                error: profileError
            } = await supabaseAdmin
                .from('profiles')
                .insert([
                    { 
                        id: userId,
                        nombre_apellido: nombre_apellido,
                        rol: rol,
                        estado: estado,
                        email: email
                    }
                ]));
        }
        
        if (profileError) {
            console.error('Error al insertar perfil en DB:', profileError);
            // Revertir: Intenta eliminar el usuario de Auth si falla el perfil
            await supabaseAdmin.auth.admin.deleteUser(userId); 
            return res.status(500).json({ message: 'Fallo al guardar el perfil, operación revertida.' });
        }


        res.status(201).json({ 
            message: 'Usuario creado exitosamente', 
            user: { id: userId, email: email, rol: rol }
        });

    } catch (error) {
        console.error('Error interno al crear usuario:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

// ------------------------------------------------------------------
// LEER TODOS LOS USUARIOS (GET /api/users) <--- IMPLEMENTACIÓN COMPLETA
// ------------------------------------------------------------------
exports.getAllUsers = async (req, res) => {
    try {
        // Obtener todos los campos necesarios de la tabla 'profiles'
        let data = null;
        let error = null;
        ({
            data,
            error
        } = await supabaseAdmin
            .from('profiles')
            .select('id, nombre_apellido, rol, estado, email, medico_veterinario, created_at')
            .order('created_at', { ascending: false })); // Ordenar por fecha de creación

        if (error && isMissingMedicoColumn(error)) {
            ({
                data,
                error
            } = await supabaseAdmin
                .from('profiles')
                .select('id, nombre_apellido, rol, estado, email, created_at')
                .order('created_at', { ascending: false }));
        }

        if (error) throw error;

        res.status(200).json(data);

    } catch (error) {
        console.error('Error al obtener todos los usuarios:', error);
        res.status(500).json({ message: 'Error interno al recuperar la lista de usuarios.' });
    }
};

// ------------------------------------------------------------------
// LEER USUARIO POR ID (GET /api/users/:id) <--- IMPLEMENTACIÓN COMPLETA
// ------------------------------------------------------------------
exports.getUserById = async (req, res) => {
    const { id } = req.params;

    try {
        let data = null;
        let error = null;
        ({
            data,
            error
        } = await supabaseAdmin
            .from('profiles')
            .select('id, nombre_apellido, rol, estado, email, medico_veterinario')
            .eq('id', id)
            .single()); // Esperamos solo un resultado

        if (error && isMissingMedicoColumn(error)) {
            ({
                data,
                error
            } = await supabaseAdmin
                .from('profiles')
                .select('id, nombre_apellido, rol, estado, email')
                .eq('id', id)
                .single());
        }

        if (error && error.code !== 'PGRST116') throw error; // Ignorar 'no rows found'

        if (!data) {
             return res.status(404).json({ message: 'Usuario no encontrado en la base de datos.' });
        }

        res.status(200).json(data);

    } catch (error) {
        console.error('Error al obtener usuario por ID:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

// ------------------------------------------------------------------
// MODIFICAR USUARIO (PUT /api/users/:id) <--- IMPLEMENTACIÓN COMPLETA
// ------------------------------------------------------------------
exports.updateUser = async (req, res) => {
    const { id } = req.params;
    const { nombre_apellido, rol, estado, password, email, medico_veterinario } = req.body;
    
    // 1. Preparar la actualización del perfil (tabla 'profiles')
    const profileUpdates = { nombre_apellido, rol, estado, email, medico_veterinario: medico_veterinario || null };

    try {
        // 2. Actualizar la tabla de perfiles (roles, nombre, estado, email)
        let updatedProfile = null;
        let profileError = null;
        ({
            data: updatedProfile,
            error: profileError
        } = await supabaseAdmin
            .from('profiles')
            .update(profileUpdates)
            .eq('id', id)
            .select()); // Devolvemos el perfil actualizado

        if (profileError && isMissingMedicoColumn(profileError)) {
            const fallbackUpdates = { nombre_apellido, rol, estado, email };
            ({
                data: updatedProfile,
                error: profileError
            } = await supabaseAdmin
                .from('profiles')
                .update(fallbackUpdates)
                .eq('id', id)
                .select());
        }

        if (profileError) {
            console.error('Error al actualizar perfil:', profileError);
            return res.status(500).json({ message: 'Error al actualizar la información del perfil.' });
        }
        
        // 3. Actualizar la información en el sistema de autenticación (solo si cambia password o email)
        if (password || email) {
            const authUpdates = {};
            if (password) authUpdates.password = password;
            if (email) authUpdates.email = email;
            
            const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, authUpdates);

            if (authError) {
                console.error('Error al actualizar Auth:', authError);
                return res.status(500).json({ message: 'Perfil actualizado, pero falló la actualización en el sistema de autenticación.' });
            }
        }

        res.status(200).json({ message: 'Usuario modificado exitosamente.', user: updatedProfile });

    } catch (error) {
        console.error('Error interno al modificar usuario:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

// ------------------------------------------------------------------
// ELIMINAR USUARIO (DELETE /api/users/:id)
// ------------------------------------------------------------------
exports.deleteUser = async (req, res) => {
    const { id } = req.params;

    try {
        // 1) Eliminar primero el perfil para evitar errores de FK si no hay cascade.
        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .delete()
            .eq('id', id);

        if (profileError) {
            return res.status(500).json({
                message: 'Error al eliminar el perfil del usuario.',
                error: profileError.message
            });
        }

        // 2) Luego eliminar el usuario en Auth.
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id);

        const authNotFound = authError && /not found/i.test(authError.message || '');
        if (authError && !authNotFound) {
            return res.status(500).json({
                message: 'Error al eliminar usuario en Auth.',
                error: authError.message
            });
        }

        if (authNotFound) {
            return res.status(200).json({
                message: `Perfil con ID ${id} eliminado. Usuario no encontrado en Auth.`
            });
        }

        res.status(200).json({ message: `Usuario con ID ${id} eliminado exitosamente.` });

    } catch (error) {
        console.error('Error interno al eliminar usuario:', error);
        res.status(500).json({ message: 'Error interno del servidor al eliminar.' });
    }
};
