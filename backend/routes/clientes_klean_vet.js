const express = require('express');
const router = express.Router();

const clientesKleanVetController = require('../controllers/clientesKleanVetController');
const { verifyAdminOrCallCenterActive } = require('../middlewares/middlewares');

// Todas estas rutas requieren token y rol permitido
router.use(verifyAdminOrCallCenterActive);

// 1. BUSCAR CLIENTE (GET /api/clientes_klean_vet/buscar)
router.get('/buscar', clientesKleanVetController.getClienteByDocumento);

// 2. REGISTRAR CLIENTE (POST /api/clientes_klean_vet)
router.post('/', clientesKleanVetController.createCliente);

// 3. OBTENER CLIENTE POR ID (GET /api/clientes_klean_vet/:id)
router.get('/:id', clientesKleanVetController.getClienteById);

// 4. ACTUALIZAR CLIENTE (PUT /api/clientes_klean_vet/:id)
router.put('/:id', clientesKleanVetController.updateCliente);

module.exports = router;
