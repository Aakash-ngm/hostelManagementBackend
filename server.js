require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 5000;

// Start server immediately so Render detects the bound port
app.listen(PORT, () => {
  console.log(`🚀 HostelFlow server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 API: http://localhost:${PORT}/api/health`);
  
  // Connect to MongoDB in the background
  connectDB().catch(err => {
    console.error('Failed to initiate MongoDB connection:', err.message);
  });
});
