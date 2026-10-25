const service = require('../services/book.service');
const { sendError } = require('./response');

async function list(req, res) {
  try {
    return res.json({ data: await service.listBooks(req.query) });
  } catch (error) {
    return sendError(res, error);
  }
}

async function create(req, res) {
  try {
    return res.status(201).json({ data: await service.createBook(req.body) });
  } catch (error) {
    return sendError(res, error);
  }
}

async function update(req, res) {
  try {
    return res.json({ data: await service.updateBook(req.params.id, req.body) });
  } catch (error) {
    return sendError(res, error);
  }
}

async function remove(req, res) {
  try {
    return res.json({ data: await service.deleteBook(req.params.id) });
  } catch (error) {
    return sendError(res, error);
  }
}

module.exports = { list, create, update, remove };
