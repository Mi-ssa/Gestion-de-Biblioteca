const service = require('../services/user.service');
const { sendError } = require('./response');

async function list(req, res) {
  try {
    return res.json({ data: await service.listUsers() });
  } catch (error) {
    return sendError(res, error);
  }
}

async function create(req, res) {
  try {
    return res.status(201).json({ data: await service.createUser(req.body) });
  } catch (error) {
    return sendError(res, error);
  }
}

async function configureAccess(req, res) {
  try {
    return res.status(201).json({
      data: await service.configureAdminAccess(req.params.id, req.body, req.staffUser.id),
    });
  } catch (error) {
    return sendError(res, error);
  }
}

async function registerFinePayment(req, res) {
  try {
    return res.status(201).json({
      data: await service.registerFinePayment(req.params.id, req.staffUser.id),
    });
  } catch (error) {
    return sendError(res, error);
  }
}

async function update(req, res) {
  try {
    return res.json({ data: await service.updateUser(req.params.id, req.body, req.staffUser.id) });
  } catch (error) {
    return sendError(res, error);
  }
}

async function remove(req, res) {
  try {
    return res.json({ data: await service.deleteUser(req.params.id) });
  } catch (error) {
    return sendError(res, error);
  }
}

module.exports = { list, create, configureAccess, registerFinePayment, update, remove };
