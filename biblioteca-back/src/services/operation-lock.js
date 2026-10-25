let pendingOperation = Promise.resolve();

function withOperationLock(operation) {
  const result = pendingOperation.then(operation);
  pendingOperation = result.catch(() => {});
  return result;
}

module.exports = withOperationLock;
