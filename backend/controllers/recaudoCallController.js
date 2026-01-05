const { supabaseAdmin } = require('../config/supabase');

const ALLOWED_TYPES = new Set(['Abono', 'Paz y salvo']);

// ------------------------------------------------------------------
// LISTAR RECAUDOS CALL (GET /api/recaudo_call)
// ------------------------------------------------------------------
exports.getRecaudosCall = async (req, res) => {
    try {
        const role = (req.userRole || '').trim().toLowerCase();
        const isAdmin = role === 'admin';
        const isDataVentas = role === 'datos y ventas klean vet';

        let query = supabaseAdmin
            .from('recaudo_call')
            .select('*')
            .order('fecha_recaudo', { ascending: false });

        if (!isAdmin && !isDataVentas) {
            query = query.eq('agente_id', req.user.id);
        }

        const { data, error } = await query;
        if (error) {
            return res.status(500).json({ message: 'Error al obtener recaudos.', error: error.message });
        }

        return res.status(200).json(data || []);
    } catch (error) {
        console.error('Error interno al listar recaudos:', error);
        return res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

// ------------------------------------------------------------------
// CREAR RECAUDO CALL (POST /api/recaudo_call)
// ------------------------------------------------------------------
exports.createRecaudoCall = async (req, res) => {
    const {
        credito_id,
        preventa_id,
        agente_id,
        tipo_recaudo,
        monto,
        fecha_recaudo
    } = req.body;

    if (!credito_id || !preventa_id || !tipo_recaudo) {
        return res.status(400).json({ message: 'Faltan campos obligatorios.' });
    }

    if (!ALLOWED_TYPES.has(tipo_recaudo)) {
        return res.status(400).json({ message: 'Tipo de recaudo no valido.' });
    }

    const montoNumber = Number(monto);
    if (!Number.isFinite(montoNumber) || montoNumber < 0) {
        return res.status(400).json({ message: 'Monto invalido.' });
    }

    try {
        const payload = {
            credito_id,
            preventa_id,
            agente_id: agente_id || null,
            tipo_recaudo,
            monto: montoNumber,
            fecha_recaudo: fecha_recaudo || new Date().toISOString()
        };

        const { data, error } = await supabaseAdmin
            .from('recaudo_call')
            .insert([payload])
            .select()
            .single();

        if (error) {
            return res.status(500).json({ message: 'Error al guardar el recaudo.', error: error.message });
        }

        return res.status(201).json({ message: 'Recaudo guardado.', data });
    } catch (error) {
        console.error('Error interno al crear recaudo:', error);
        return res.status(500).json({ message: 'Error interno del servidor.' });
    }
};
