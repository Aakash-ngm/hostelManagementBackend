const jwt = require('jsonwebtoken');
const Student = require('../models/Student');
const Warden = require('../models/Warden');

const protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authorized. No token.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    req.userRole = decoded.role;

    if (decoded.role === 'warden' || decoded.role === 'admin-mess') {
      const warden = await Warden.findById(decoded.id);
      if (!warden) return res.status(401).json({ success: false, message: 'User not found.' });
      req.user = warden;
    } else {
      const student = await Student.findById(decoded.id);
      if (!student || !student.isActive) return res.status(401).json({ success: false, message: 'User account is deactivated or deleted.' });
      req.user = student;
    }

    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid token.' });
  }
};

module.exports = { protect };
