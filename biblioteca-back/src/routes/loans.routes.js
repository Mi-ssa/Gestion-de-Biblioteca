const express = require('express');
const controller = require('../controllers/loans.controller');
const { requireAuthentication, requireCsrf } = require('../auth/auth.middleware');

const router = express.Router();
router.use(requireAuthentication, requireCsrf);
router.get('/', controller.list);
router.post('/', controller.create);
router.post('/:id/devolucion', controller.returnBook);

module.exports = router;
