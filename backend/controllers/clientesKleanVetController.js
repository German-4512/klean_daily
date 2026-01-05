const { supabaseAdmin } = require('../config/supabase');

const normalizeText = (value) => {
    const text = String(value || '').trim();
    return text.length ? text : null;
};

const normalizeNumber = (value) => {
    if (value === undefined || value === null || value === '') return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
};

// ------------------------------------------------------------------
// BUSCAR CLIENTE POR DOCUMENTO (GET /api/clientes_klean_vet/buscar)
// ------------------------------------------------------------------
exports.getClienteByDocumento = async (req, res) => {
    const numero_documento = normalizeText(req.query.numero_documento);
    if (!numero_documento) {
        return res.status(400).json({ message: 'Numero documento requerido.' });
    }

    try {
        const { data, error } = await supabaseAdmin
            .from('clientes_klean_vet')
            .select('*')
            .eq('numero_documento', numero_documento)
            .limit(1);

        if (error) {
            return res.status(500).json({ message: 'Error al buscar el cliente.', error: error.message });
        }

        const cliente = Array.isArray(data) ? data[0] : null;
        if (!cliente) {
            return res.status(404).json({ message: 'Cliente no encontrado.' });
        }

        return res.status(200).json(cliente);
    } catch (error) {
        console.error('Error interno al buscar cliente:', error);
        return res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

// ------------------------------------------------------------------
// CREAR CLIENTE (POST /api/clientes_klean_vet)
// ------------------------------------------------------------------
exports.createCliente = async (req, res) => {
    const {
        tipo_documento,
        numero_documento,
        nombre,
        apellido,
        telefono_celular,
        correo_electronico,
        asesor,
        departamento,
        municipio,
        fecha_nacimiento,
        direccion,
        apartamento,
        torre,
        barrio,
        nombre_mascota,
        raza,
        peso,
        edad,
        unidad_edad,
        especie,
        estado_reproductivo,
        sexo
    } = req.body || {};

    const requiredValues = [
        normalizeText(tipo_documento),
        normalizeText(numero_documento),
        normalizeText(nombre),
        normalizeText(apellido),
        normalizeText(telefono_celular),
        normalizeText(correo_electronico)
    ];

    if (requiredValues.some((value) => !value)) {
        return res.status(400).json({ message: 'Faltan campos obligatorios.' });
    }

    try {
        const payload = {
            tipo_documento: normalizeText(tipo_documento),
            numero_documento: normalizeText(numero_documento),
            nombre: normalizeText(nombre),
            apellido: normalizeText(apellido),
            telefono_celular: normalizeText(telefono_celular),
            correo_electronico: normalizeText(correo_electronico),
            asesor: normalizeText(asesor),
            departamento: normalizeText(departamento),
            municipio: normalizeText(municipio),
            fecha_nacimiento: normalizeText(fecha_nacimiento),
            direccion: normalizeText(direccion),
            apartamento: normalizeText(apartamento),
            torre: normalizeText(torre),
            barrio: normalizeText(barrio),
            nombre_mascota: normalizeText(nombre_mascota),
            raza: normalizeText(raza),
            peso: normalizeNumber(peso),
            edad: normalizeNumber(edad),
            unidad_edad: normalizeText(unidad_edad),
            especie: normalizeText(especie),
            estado_reproductivo: normalizeText(estado_reproductivo),
            sexo: normalizeText(sexo)
        };

        const { data, error } = await supabaseAdmin
            .from('clientes_klean_vet')
            .insert([payload])
            .select()
            .single();

        if (error) {
            const isDuplicate = String(error.message || '').toLowerCase().includes('duplicate');
            if (isDuplicate) {
                return res.status(409).json({ message: 'El cliente ya existe con ese documento.' });
            }
            return res.status(500).json({ message: 'Error al registrar el cliente.', error: error.message });
        }

        return res.status(201).json({ message: 'Cliente registrado correctamente.', data });
    } catch (error) {
        console.error('Error interno al registrar cliente:', error);
        return res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

// ------------------------------------------------------------------
// OBTENER CLIENTE POR ID (GET /api/clientes_klean_vet/:id)
// ------------------------------------------------------------------
exports.getClienteById = async (req, res) => {
    const { id } = req.params;
    if (!id) {
        return res.status(400).json({ message: 'Id requerido.' });
    }

    try {
        const { data, error } = await supabaseAdmin
            .from('clientes_klean_vet')
            .select('*')
            .eq('id_cliente', id)
            .single();

        if (error) {
            return res.status(500).json({ message: 'Error al obtener el cliente.', error: error.message });
        }

        if (!data) {
            return res.status(404).json({ message: 'Cliente no encontrado.' });
        }

        return res.status(200).json(data);
    } catch (error) {
        console.error('Error interno al obtener cliente:', error);
        return res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

// ------------------------------------------------------------------
// ACTUALIZAR CLIENTE (PUT /api/clientes_klean_vet/:id)
// ------------------------------------------------------------------
exports.updateCliente = async (req, res) => {
    const { id } = req.params;
    if (!id) {
        return res.status(400).json({ message: 'Id requerido.' });
    }

    const {
        tipo_documento,
        numero_documento,
        nombre,
        apellido,
        telefono_celular,
        correo_electronico,
        departamento,
        municipio,
        fecha_nacimiento,
        direccion,
        apartamento,
        torre,
        barrio,
        nombre_mascota,
        raza,
        peso,
        edad,
        unidad_edad,
        especie,
        estado_reproductivo,
        sexo
    } = req.body || {};

    const requiredValues = [
        normalizeText(tipo_documento),
        normalizeText(numero_documento),
        normalizeText(nombre),
        normalizeText(apellido),
        normalizeText(telefono_celular),
        normalizeText(correo_electronico)
    ];

    if (requiredValues.some((value) => !value)) {
        return res.status(400).json({ message: 'Faltan campos obligatorios.' });
    }

    try {
        const payload = {
            tipo_documento: normalizeText(tipo_documento),
            numero_documento: normalizeText(numero_documento),
            nombre: normalizeText(nombre),
            apellido: normalizeText(apellido),
            telefono_celular: normalizeText(telefono_celular),
            correo_electronico: normalizeText(correo_electronico),
            departamento: normalizeText(departamento),
            municipio: normalizeText(municipio),
            fecha_nacimiento: normalizeText(fecha_nacimiento),
            direccion: normalizeText(direccion),
            apartamento: normalizeText(apartamento),
            torre: normalizeText(torre),
            barrio: normalizeText(barrio),
            nombre_mascota: normalizeText(nombre_mascota),
            raza: normalizeText(raza),
            peso: normalizeNumber(peso),
            edad: normalizeNumber(edad),
            unidad_edad: normalizeText(unidad_edad),
            especie: normalizeText(especie),
            estado_reproductivo: normalizeText(estado_reproductivo),
            sexo: normalizeText(sexo)
        };

        const { data, error } = await supabaseAdmin
            .from('clientes_klean_vet')
            .update(payload)
            .eq('id_cliente', id)
            .select()
            .single();

        if (error) {
            return res.status(500).json({ message: 'Error al actualizar el cliente.', error: error.message });
        }

        if (!data) {
            return res.status(404).json({ message: 'Cliente no encontrado.' });
        }

        return res.status(200).json({ message: 'Cliente actualizado correctamente.', data });
    } catch (error) {
        console.error('Error interno al actualizar cliente:', error);
        return res.status(500).json({ message: 'Error interno del servidor.' });
    }
};
