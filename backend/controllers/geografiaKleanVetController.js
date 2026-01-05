const { supabaseAdmin } = require('../config/supabase');

const normalizeText = (value) => {
    const text = String(value || '').trim();
    return text.length ? text : null;
};

// ------------------------------------------------------------------
// LISTAR DEPARTAMENTOS (GET /api/geografia_klean_vet/departamentos)
// ------------------------------------------------------------------
exports.getDepartamentos = async (req, res) => {
    const search = normalizeText(req.query.search) || '';
    try {
        let query = supabaseAdmin
            .from('geografia_klean_vet')
            .select('nombre_depto')
            .order('nombre_depto', { ascending: true })
            .limit(1000);

        if (search) {
            query = query.ilike('nombre_depto', `%${search}%`);
        }

        const { data, error } = await query;
        if (error) {
            return res.status(500).json({ message: 'Error al obtener departamentos.', error: error.message });
        }

        const unique = Array.from(new Set((data || []).map((item) => item.nombre_depto).filter(Boolean)));
        return res.status(200).json(unique);
    } catch (error) {
        console.error('Error interno al listar departamentos:', error);
        return res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

// ------------------------------------------------------------------
// LISTAR MUNICIPIOS POR DEPARTAMENTO (GET /api/geografia_klean_vet/municipios)
// ------------------------------------------------------------------
exports.getMunicipios = async (req, res) => {
    const departamento = normalizeText(req.query.departamento);
    const search = normalizeText(req.query.search) || '';

    if (!departamento) {
        return res.status(400).json({ message: 'Departamento requerido.' });
    }

    try {
        let query = supabaseAdmin
            .from('geografia_klean_vet')
            .select('nombre_mpio')
            .eq('nombre_depto', departamento)
            .order('nombre_mpio', { ascending: true })
            .limit(1000);

        if (search) {
            query = query.ilike('nombre_mpio', `%${search}%`);
        }

        const { data, error } = await query;
        if (error) {
            return res.status(500).json({ message: 'Error al obtener municipios.', error: error.message });
        }

        const unique = Array.from(new Set((data || []).map((item) => item.nombre_mpio).filter(Boolean)));
        return res.status(200).json(unique);
    } catch (error) {
        console.error('Error interno al listar municipios:', error);
        return res.status(500).json({ message: 'Error interno del servidor.' });
    }
};
