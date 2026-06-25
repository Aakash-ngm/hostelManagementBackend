const jwt = require('jsonwebtoken');
const { body } = require('express-validator');
const Student = require('../models/Student');
const Warden = require('../models/Warden');
const { sendSuccess, sendError } = require('../utils/responseHelper');

const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

// @route POST /api/auth/student/register
exports.registerStudent = async (req, res, next) => {
  try {
    const { name, registerNumber, email, password, department, year, roomNumber, studentPhone, parentPhone } = req.body;
    const existing = await Student.findOne({ $or: [{ email }, { registerNumber: registerNumber.toUpperCase() }] });
    if (existing) {
      return sendError(res, 'Email or Register Number already exists.', 400);
    }
    const student = await Student.create({
      name, registerNumber, email, password, department, year, roomNumber, studentPhone, parentPhone,
    });
    const token = generateToken(student._id, 'student');
    return sendSuccess(res, { token, user: { id: student._id, name: student.name, registerNumber: student.registerNumber, role: 'student' } }, 'Registration successful', 201);
  } catch (error) {
    next(error);
  }
};

// @route POST /api/auth/student/login
exports.loginStudent = async (req, res, next) => {
  try {
    const { registerNumber, password } = req.body;
    const student = await Student.findOne({ registerNumber: registerNumber.toUpperCase() }).select('+password');
    if (!student || !(await student.comparePassword(password))) {
      return sendError(res, 'Invalid register number or password.', 401);
    }
    const token = generateToken(student._id, 'student');
    return sendSuccess(res, { token, user: { id: student._id, name: student.name, registerNumber: student.registerNumber, email: student.email, department: student.department, year: student.year, roomNumber: student.roomNumber, currentStatus: student.currentStatus, role: 'student' } }, 'Login successful');
  } catch (error) {
    next(error);
  }
};

// @route POST /api/auth/warden/register
exports.registerWarden = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    const existing = await Warden.findOne({ email });
    if (existing) {
      return sendError(res, 'Email already exists.', 400);
    }
    const warden = await Warden.create({ name, email, password });
    const token = generateToken(warden._id, 'warden');
    return sendSuccess(res, { token, user: { id: warden._id, name: warden.name, email: warden.email, role: 'warden' } }, 'Warden registered successfully', 201);
  } catch (error) {
    next(error);
  }
};

// @route POST /api/auth/warden/login
exports.loginWarden = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const warden = await Warden.findOne({ email }).select('+password');
    if (!warden || !(await warden.comparePassword(password))) {
      return sendError(res, 'Invalid email or password.', 401);
    }
    const token = generateToken(warden._id, 'warden');
    return sendSuccess(res, { token, user: { id: warden._id, name: warden.name, email: warden.email, role: 'warden' } }, 'Login successful');
  } catch (error) {
    next(error);
  }
};

// @route GET /api/auth/me
exports.getMe = async (req, res, next) => {
  try {
    return sendSuccess(res, { user: req.user }, 'User details fetched');
  } catch (error) {
    next(error);
  }
};
