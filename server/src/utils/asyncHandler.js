// Async route handler'larda try/catch tekrarını önler; hatayı Express error middleware'ine iletir.
module.exports = function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
};
