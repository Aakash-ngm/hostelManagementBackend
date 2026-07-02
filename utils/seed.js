require('dotenv').config();
const connectDB = require('../config/db');
const Student = require('../models/Student');
const Warden = require('../models/Warden');

const seed = async () => {
  await connectDB();

  // Clear existing data
  await Warden.deleteMany({});

  // Create default admin mess
  await Warden.create({
    name: 'Admin Mess',
    email: 'admin@hostelflow.com',
    password: 'Admin@123',
    role: 'admin-mess'
  });
  console.log('✅ Default admin-mess created: admin@hostelflow.com / Admin@123');

  // Create default warden
  await Warden.create({
    name: 'Warden Office',
    email: 'warden@hostelflow.com',
    password: 'Warden@123',
    role: 'warden'
  });
  console.log('✅ Default warden created: warden@hostelflow.com / Warden@123');

  // Create sample students
  const students = [
    { name: 'Abinash', registerNumber: '311523205001', email: 'abinash@student.com', password: 'Student@123', department: 'CSE', year: '3rd Year', roomNumber: 'A-105', studentPhone: '9876543210', parentPhone: '9876543211' },
    { name: 'Arjun Kumar', registerNumber: 'CS2021001', email: 'arjun@student.com', password: 'Student@123', department: 'CSE', year: '3rd Year', roomNumber: 'A-101', studentPhone: '9876543210', parentPhone: '9876543211' },
    { name: 'Priya Sharma', registerNumber: 'EC2021002', email: 'priya@student.com', password: 'Student@123', department: 'ECE', year: '3rd Year', roomNumber: 'A-102', studentPhone: '9876543220', parentPhone: '9876543221' },
    { name: 'Rahul Singh', registerNumber: 'ME2021003', email: 'rahul@student.com', password: 'Student@123', department: 'MECH', year: '2nd Year', roomNumber: 'B-201', studentPhone: '9876543230', parentPhone: '9876543231' },
    { name: 'Deepika Nair', registerNumber: 'IT2021004', email: 'deepika@student.com', password: 'Student@123', department: 'IT', year: '4th Year', roomNumber: 'C-301', studentPhone: '9876543240', parentPhone: '9876543241' },
    { name: 'Vijay Mohan', registerNumber: 'CV2021005', email: 'vijay@student.com', password: 'Student@123', department: 'CIVIL', year: '1st Year', roomNumber: 'B-105', studentPhone: '9876543250', parentPhone: '9876543251' },
  ];

  for (const s of students) {
    const exists = await Student.findOne({ $or: [{ registerNumber: s.registerNumber }, { email: s.email }] });
    if (!exists) await Student.create(s);
  }
  console.log('✅ Sample students created');
  console.log('🎉 Seeding complete!');
  process.exit(0);
};

seed().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
