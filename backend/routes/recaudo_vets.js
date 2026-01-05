const express = require('express');
const router = express.Router();

const recaudoVetsController = require('../controllers/recaudoVetsController');
const { verifyAdminOrCallCenterActive } = require('../middlewares/middlewares');

router.use(verifyAdminOrCallCenterActive);

router.get('/', recaudoVetsController.getRecaudosVets);
router.post('/', recaudoVetsController.createRecaudoVets);

module.exports = router;
