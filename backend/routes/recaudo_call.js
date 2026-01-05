const express = require('express');
const router = express.Router();

const recaudoCallController = require('../controllers/recaudoCallController');
const { verifyAdminOrCallCenterActive } = require('../middlewares/middlewares');

router.use(verifyAdminOrCallCenterActive);

router.get('/', recaudoCallController.getRecaudosCall);
router.post('/', recaudoCallController.createRecaudoCall);

module.exports = router;
