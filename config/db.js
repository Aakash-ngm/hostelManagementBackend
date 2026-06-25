const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📦 Database Name: ${conn.connection.name}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    console.error(`
─────────────────────────────────────────────────────────────────────────────
⚠️  CONNECTION TROUBLESHOOTING GUIDE FOR RENDER/HOSTING PROVIDERS:
1. Make sure IP "0.0.0.0/0" is whitelisted in MongoDB Atlas -> Network Access.
   (Render servers use dynamic IPs, so whitelisting your home IP is not enough).
2. Double-check that your MONGO_URI in Render's environment variables dashboard
   matches your actual connection string.
─────────────────────────────────────────────────────────────────────────────
`);
  }
};

module.exports = connectDB;
