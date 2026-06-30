require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');
const { runDynamicChecks } = require('./services/notificationGeneratorService');

const PORT = process.env.PORT || 5000;

// Start server immediately so Render detects the bound port
app.listen(PORT, () => {
  console.log(`🚀 HostelFlow server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 API: http://localhost:${PORT}/api/health`);
  
  // Connect to MongoDB in the background
  connectDB().then(() => {
    // Run dynamic checks immediately, then every 30 seconds
    runDynamicChecks().catch(err => console.error('Error in initial checks:', err));
    setInterval(() => {
      runDynamicChecks().catch(err => console.error('Error in background checks:', err));
    }, 30000);
  }).catch(err => {
    console.error('Failed to initiate MongoDB connection:', err.message);
  });
});
