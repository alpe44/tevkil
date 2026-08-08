const { Router } = require('express');
const publicController = require('../controllers/public.controller');

const router = Router();

router.get('/stats', publicController.stats);

module.exports = router;
