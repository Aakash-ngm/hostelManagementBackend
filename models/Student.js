const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const studentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    registerNumber: {
      type: String,
      required: [true, 'Register number is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
      select: false,
    },
    department: {
      type: String,
      required: [true, 'Department is required'],
      trim: true,
    },
    year: {
      type: String,
      required: [true, 'Year is required'],
      enum: ['1st Year', '2nd Year', '3rd Year', '4th Year'],
    },
    roomNumber: {
      type: String,
      required: [true, 'Room number is required'],
      trim: true,
      uppercase: true,
    },
    studentPhone: {
      type: String,
      required: [true, 'Student phone is required'],
      match: [/^[6-9]\d{9}$/, 'Enter a valid Indian mobile number'],
    },
    parentPhone: {
      type: String,
      required: [true, 'Parent phone is required'],
      match: [/^[6-9]\d{9}$/, 'Enter a valid Indian mobile number'],
    },
    currentStatus: {
      type: String,
      enum: ['Inside', 'Outside', 'Permission', 'NativeLeave'],
      default: 'Inside',
    },
    role: {
      type: String,
      default: 'student',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Hash password before save
studentSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password
studentSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('Student', studentSchema);
