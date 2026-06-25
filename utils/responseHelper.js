const sendSuccess = (res, data = {}, message = 'Success', statusCode = 200, alerts = []) => {
  return res.status(statusCode).json({
    success: true,
    action: data.action || '',
    message,
    data,
    alerts,
  });
};

const sendError = (res, message = 'Error occurred', statusCode = 400, errors = []) => {
  return res.status(statusCode).json({
    success: false,
    message,
    errors,
  });
};

module.exports = { sendSuccess, sendError };
