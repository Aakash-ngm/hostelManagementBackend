const Warden = require('../models/Warden');
const Student = require('../models/Student');

const autoSeed = async () => {
  try {
    const wardenCount = await Warden.countDocuments();
    if (wardenCount === 0) {
      console.log('⚠️ No wardens found in the database. Performing automatic seeding...');

      // Create Admin Mess Warden
      await Warden.create({
        name: 'Admin Mess',
        email: 'admin@hostelflow.com',
        password: 'Admin@123',
        role: 'admin-mess'
      });
      console.log('✅ Auto-Seeded default admin-mess: admin@hostelflow.com / Admin@123');

      // Create Regular Warden
      await Warden.create({
        name: 'Sathish Warden',
        email: 'sathish@gmail.com',
        password: 'Warden@123',
        role: 'warden'
      });
      console.log('✅ Auto-Seeded default warden: sathish@gmail.com / Warden@123');

      // Create Sample Students
      const students = [
        { name: 'Abinash', registerNumber: '311523205001', email: 'abinash@student.com', password: 'Student@123', department: 'CSE', year: '3rd Year', roomNumber: 'A-105', studentPhone: '9876543210', parentPhone: '9876543211', currentStatus: 'Inside' },
        { name: 'Arjun Kumar', registerNumber: 'CS2021001', email: 'arjun@student.com', password: 'Student@123', department: 'CSE', year: '3rd Year', roomNumber: 'A-101', studentPhone: '9876543210', parentPhone: '9876543211', currentStatus: 'Inside' },
        { name: 'Priya Sharma', registerNumber: 'EC2021002', email: 'priya@student.com', password: 'Student@123', department: 'ECE', year: '3rd Year', roomNumber: 'A-102', studentPhone: '9876543220', parentPhone: '9876543221', currentStatus: 'Inside' },
        { name: 'Rahul Singh', registerNumber: 'ME2021003', email: 'rahul@student.com', password: 'Student@123', department: 'MECH', year: '2nd Year', roomNumber: 'B-201', studentPhone: '9876543230', parentPhone: '9876543231', currentStatus: 'Inside' },
        { name: 'Deepika Nair', registerNumber: 'IT2021004', email: 'deepika@student.com', password: 'Student@123', department: 'IT', year: '4th Year', roomNumber: 'C-301', studentPhone: '9876543240', parentPhone: '9876543241', currentStatus: 'Inside' },
        { name: 'Vijay Mohan', registerNumber: 'CV2021005', email: 'vijay@student.com', password: 'Student@123', department: 'CIVIL', year: '1st Year', roomNumber: 'B-105', studentPhone: '9876543250', parentPhone: '9876543251', currentStatus: 'Inside' },
        { name: 'Banthalesh.N', registerNumber: '311523205009', email: 'banthalesh@student.com', password: 'Student@123', department: 'IT', year: '3rd Year', roomNumber: '57', studentPhone: '9876543220', parentPhone: '9876543221', currentStatus: 'Inside' }
      ];

      for (const s of students) {
        const exists = await Student.findOne({ $or: [{ registerNumber: s.registerNumber }, { email: s.email }] });
        if (!exists) await Student.create(s);
      }
      console.log('✅ Auto-Seeded default student list successfully.');
    }
  } catch (err) {
    console.error('❌ Auto-seeding failed:', err.message);
  }
};

module.exports = autoSeed;
