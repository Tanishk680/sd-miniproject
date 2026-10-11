const mongoose = require('mongoose');
const { buildMongoUri } = require('./mongoUri');

async function connectDB() {
  const { uri, redacted } = buildMongoUri(process.env, 'userdb');
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log(`[user-service] connected to MongoDB: ${redacted}`);
  } catch (err) {
    console.error('[user-service] MongoDB connection failed:', err.message);
    process.exit(1);
  }
}

module.exports = connectDB;