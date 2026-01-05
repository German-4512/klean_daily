const express = require('express');
const router = express.Router();

const rendimientoDailyController = require('../controllers/rendimientoDailyController');
const { verifyAdminOrCallCenterActive } = require('../middlewares/middlewares');

router.use(verifyAdminOrCallCenterActive);

router.get('/', rendimientoDailyController.getRendimientoDaily);
router.post('/', rendimientoDailyController.updateRendimientoDaily);

module.exports = router;
