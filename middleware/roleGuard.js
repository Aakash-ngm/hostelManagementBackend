const requireWarden = (req, res, next) => {
  if (req.userRole !== 'warden') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Warden only.',
    });
  }
  next();
};

const requireStudent = (req, res, next) => {
  if (req.userRole !== 'student') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Students only.',
    });
  }
  next();
};

module.exports = { requireWarden, requireStudent };
