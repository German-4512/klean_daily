// backend/server.js

const express = require('express');
const dotenv = require('dotenv'); // Para cargar las variables del .env
const cors = require('cors'); // Para permitir comunicación con el Frontend
// IMPORTANTE: Cargamos las variables de entorno ANTES que cualquier otro módulo las necesite
dotenv.config(); 

const { supabaseAdmin } = require('./config/supabase'); // Importamos el cliente Admin de Supabase

// Inicialización de la aplicación Express
const app = express();
const PORT = process.env.PORT || 3001;

// ------------------------------------------------
// 1. MIDDLEWARES GLOBALES
// ------------------------------------------------

// Middleware para permitir JSON: Necesario para leer req.body
app.use(express.json());

// Middleware CORS: Permite que el Frontend acceda a nuestra API.
const corsOptions = {
    // Definición estricta: Permite solo peticiones desde el origen de desarrollo del Frontend
    origin: ['http://localhost:5500', 'http://127.0.0.7:5500'], 
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
    optionsSuccessStatus: 204
};
app.use(cors(corsOptions));


// ------------------------------------------------
// 2. IMPORTAR E INTEGRAR RUTAS
// ------------------------------------------------

// Rutas de Autenticación (Login)
const authRoutes = require('./routes/auth'); 
app.use('/api/auth', authRoutes); // Prefijo: /api/auth/...

// Rutas de Gestión de Usuarios (CRUD Admin)
const userRoutes = require('./routes/user');
app.use('/api/users', userRoutes); // Prefijo: /api/users/...

// Rutas de Preventas Call (CallCenter/Admin)
const preventasCallRoutes = require('./routes/preventascall');
app.use('/api/preventascall', preventasCallRoutes); // Prefijo: /api/preventascall/...

// Rutas de Ventas Tutores (Datos y Ventas/Admin)
const ventasTutoresRoutes = require('./routes/ventasTutores');
app.use('/api/ventas_tutores', ventasTutoresRoutes); // Prefijo: /api/ventas_tutores/...

// Rutas de Seguimientos Vets (Veterinario/Admin)
const seguimientosVetsRoutes = require('./routes/seguimientosVets');
app.use('/api/seguimientos_vets', seguimientosVetsRoutes); // Prefijo: /api/seguimientos_vets/...
const seguimientosVets45Routes = require('./routes/seguimientosVets45');
app.use('/api/seguimientos_vets_45', seguimientosVets45Routes); // Prefijo: /api/seguimientos_vets_45/...

// Rutas de Creditos Tutores (Datos y Ventas/Admin/CallCenter)
const creditosKvRoutes = require('./routes/creditos_kv');
app.use('/api/creditos_kv', creditosKvRoutes); // Prefijo: /api/creditos_kv/...

// Rutas de Creditos Vets (Datos y Ventas/Admin/CallCenter)
const creditosVetsRoutes = require('./routes/creditos_vets');
app.use('/api/creditos_vets', creditosVetsRoutes); // Prefijo: /api/creditos_vets/...

// Rutas de Recaudos Call (Datos y Ventas/Admin/CallCenter)
const recaudoCallRoutes = require('./routes/recaudo_call');
app.use('/api/recaudo_call', recaudoCallRoutes); // Prefijo: /api/recaudo_call/...

// Rutas de Recaudos Vets (Datos y Ventas/Admin/CallCenter)
const recaudoVetsRoutes = require('./routes/recaudo_vets');
app.use('/api/recaudo_vets', recaudoVetsRoutes); // Prefijo: /api/recaudo_vets/...

// Rutas de Rendimiento Daily (Agente Mayor/Admin/CallCenter)
const rendimientoDailyRoutes = require('./routes/rendimiento_daily');
app.use('/api/rendimiento_daily', rendimientoDailyRoutes); // Prefijo: /api/rendimiento_daily/...

// Rutas de Clientes Klean Vet (CallCenter/Admin)
const clientesKleanVetRoutes = require('./routes/clientes_klean_vet');
app.use('/api/clientes_klean_vet', clientesKleanVetRoutes); // Prefijo: /api/clientes_klean_vet/...

// Rutas de Geografia Klean Vet (CallCenter/Admin)
const geografiaKleanVetRoutes = require('./routes/geografia_klean_vet');
app.use('/api/geografia_klean_vet', geografiaKleanVetRoutes); // Prefijo: /api/geografia_klean_vet/...

// Rutas de Citas Klean Vet (CallCenter/Admin)
const citasKleanVetRoutes = require('./routes/citas_klean_vet');
app.use('/api/citas_klean_vet', citasKleanVetRoutes); // Prefijo: /api/citas_klean_vet/...

// ------------------------------------------------
// 3. RUTA DE PRUEBA 
// ------------------------------------------------

app.get('/', (req, res) => {
    res.status(200).send('Servidor KLEAN DAILY API operativo.');
});

// ------------------------------------------------
// 3.1. HEALTH CHECK DE SUPABASE
// ------------------------------------------------
app.get('/health', async (req, res) => {
    try {
        const envOk = Boolean(
            process.env.SUPABASE_URL &&
            process.env.SUPABASE_ANON_KEY &&
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        const { error } = await supabaseAdmin
            .from('profiles')
            .select('id', { head: true })
            .limit(1);

        if (error) {
            return res.status(502).json({
                ok: false,
                envOk,
                supabase: 'error',
                message: error.message
            });
        }

        return res.status(200).json({
            ok: true,
            envOk,
            supabase: 'ok'
        });
    } catch (error) {
        return res.status(502).json({
            ok: false,
            envOk: false,
            supabase: 'error',
            message: error.message
        });
    }
});


// ------------------------------------------------
// 4. INICIO DEL SERVIDOR
// ------------------------------------------------

app.listen(PORT, () => {
    console.log(`🚀 Servidor Express escuchando en http://localhost:${PORT}`);
    // Usamos console.log() para verificar si la URL se cargó correctamente desde el .env
    console.log(`Base de datos URL cargada: ${process.env.SUPABASE_URL ? 'OK' : 'FALTA LA URL'}`);
});
