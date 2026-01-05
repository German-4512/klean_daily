const express = require('express');
const router = express.Router();

const geografiaKleanVetController = require('../controllers/geografiaKleanVetController');
const { verifyAdminOrCallCenterActive } = require('../middlewares/middlewares');

// Todas estas rutas requieren token y rol permitido
router.use(verifyAdminOrCallCenterActive);

// 1. LISTAR DEPARTAMENTOS (GET /api/geografia_klean_vet/departamentos)
router.get('/departamentos', geografiaKleanVetController.getDepartamentos);

// 2. LISTAR MUNICIPIOS (GET /api/geografia_klean_vet/municipios)
router.get('/municipios', geografiaKleanVetController.getMunicipios);

module.exports = router;
