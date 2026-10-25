const service = require('../services/loan.service');
const { sendError } = require('./response');

async function list(req, res) {
  try {
    return res.json({ data: await service.listLoans() });
  } catch (error) {
    return sendError(res, error);
  }
}

async function create(req, res) {
  try {
    return res.status(201).json({ data: await service.createLoan(req.body) });
  } catch (error) {
    return sendError(res, error);
  }
}

async function returnBook(req, res) {
  try {
    return res.json({ data: await service.returnLoan(req.params.id) });
  } catch (error) {
    return sendError(res, error);
  }
}

module.exports = { list, create, returnBook };
