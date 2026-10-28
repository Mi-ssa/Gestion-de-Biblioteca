const express = require('express');
const controller = require('../controllers/users.controller');
const { requireAuthentication, requireCsrf } = require('../auth/auth.middleware');

const router = express.Router();
router.use(requireAuthentication, requireCsrf);
router.get('/', controller.list);
router.post('/', controller.create);
router.post('/:id/acceso', controller.configureAccess);
router.post('/:id/pago', controller.registerFinePayment);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

module.exports = router;
