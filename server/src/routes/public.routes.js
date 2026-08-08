const { Router } = require('express');
const publicController = require('../controllers/public.controller');

const router = Router();

router.get('/stats', publicController.stats);
router.get('/completed', publicController.completed);

module.exports = router;
