const { supabase, supabaseAdmin } = require('../config/supabase');

function isMissingMedicoColumn(error) {
  const message = String(error?.message || '');
  return /medico_veterinario/i.test(message) && /column/i.test(message);
}

exports.loginUser = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      error: 'Faltan datos',
      message: 'Debe proporcionar email y contraseña'
    });
  }

  try {
    // 1️⃣ Login con Supabase Auth (anon)
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      return res.status(401).json({
        error: 'Autenticación fallida',
        message: 'Credenciales inválidas'
      });
    }

    const user = data.user;

    // 2️⃣ 🔐 Verificar rol con SERVICE ROLE (CRÍTICO)
    let profile = null;
    let profileError = null;
    ({
      data: profile,
      error: profileError
    } = await supabaseAdmin
      .from('profiles')
      .select('rol, estado, medico_veterinario')
      .eq('id', user.id)
      .single());

    if (profileError && isMissingMedicoColumn(profileError)) {
      ({
        data: profile,
        error: profileError
      } = await supabaseAdmin
        .from('profiles')
        .select('rol, estado')
        .eq('id', user.id)
        .single());
    }

    const role = (profile?.rol || '').toLowerCase().replace(/\s+/g, ' ').trim();
    const estado = (profile?.estado || '').toLowerCase().replace(/\s+/g, ' ').trim();
    const isAdmin = role === 'admin';
    const isCallCenter = role === 'asesor comercial callcenter' && estado === 'activo';
    const isDataVentas = role === 'datos y ventas klean vet';
    const isVeterinario = role === 'veterinario';
    const isAgenteMayor = role === 'agente mayor' && estado === 'activo';
    const isInvitado = role === 'invitado';

    if (profileError) {
      console.warn(`Advertencia al cargar perfil: ${profileError.message}`);
    }

    if (!profile || (!isAdmin && !isCallCenter && !isDataVentas && !isVeterinario && !isAgenteMayor && !isInvitado)) {
      console.warn(`Intento de login sin permisos: ${email} con rol: ${profile?.rol} estado: ${profile?.estado}`);
      return res.status(403).json({
        error: 'Acceso denegado',
        message: 'No tiene permisos para ingresar'
      });
    }

    // 3️⃣ Login exitoso
    return res.status(200).json({
      message: 'Login exitoso',
      user,
      profile,
      session: data.session
    });

  } catch (err) {
    console.error('Error interno del servidor:', err);
    return res.status(500).json({
      error: 'Error del servidor'
    });
  }
};

exports.getMe = async (req, res) => {
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
      return res.status(401).json({ error: 'Acceso denegado', message: 'Token inválido o expirado.' });
    }

    let profile = null;
    let profileError = null;
    ({
      data: profile,
      error: profileError
    } = await supabaseAdmin
      .from('profiles')
      .select('rol, estado, nombre_apellido, email, medico_veterinario')
      .eq('id', user.id)
      .single());

    if (profileError && isMissingMedicoColumn(profileError)) {
      ({
        data: profile,
        error: profileError
      } = await supabaseAdmin
        .from('profiles')
        .select('rol, estado, nombre_apellido, email')
        .eq('id', user.id)
        .single());
    }

    if (profileError || !profile) {
      return res.status(404).json({ error: 'Acceso denegado', message: 'Perfil de usuario no encontrado.' });
    }

    return res.status(200).json({ user, profile });
  } catch (err) {
    console.error('Error interno al obtener el perfil:', err);
    return res.status(500).json({ error: 'Error del servidor' });
  }
};
