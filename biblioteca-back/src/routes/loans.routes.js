const express = require('express');
const controller = require('../controllers/loans.controller');

const router = express.Router();
router.get('/', controller.list);
router.post('/', controller.create);
router.post('/:id/devolucion', controller.returnBook);

module.exports = router;
