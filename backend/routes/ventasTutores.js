const express = require('express');
const multer = require('multer');

const router = express.Router();
const ventasTutoresController = require('../controllers/ventasTutoresController');
const { verifyAdminOrCallCenterActive } = require('../middlewares/middlewares');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }
});

router.use(verifyAdminOrCallCenterActive);

// Cargar ventas desde Excel (POST /api/ventas_tutores/upload)
router.post('/upload', upload.single('file'), ventasTutoresController.uploadVentasTutores);

// Listar ventas cargadas (GET /api/ventas_tutores)
router.get('/veterinarios', ventasTutoresController.getVeterinarios);
router.get('/', ventasTutoresController.getVentasTutores);

// Guardar venta confirmada (POST /api/ventas_tutores/confirmadas)
router.post('/confirmadas', ventasTutoresController.createVentaConfirmada);

// Actualizar venta confirmada (PUT /api/ventas_tutores/confirmadas/:id)
router.put('/confirmadas/:id', ventasTutoresController.updateVentaConfirmada);

module.exports = router;
