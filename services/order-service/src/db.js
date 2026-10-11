const mongoose = require('mongoose');
const { buildMongoUri } = require('./mongoUri');

async function connectDB() {
  const uri = buildMongoUri(process.env, 'orderdb');
  try {
    await mongoose.connect(uri.uri, { serverSelectionTimeoutMS: 5000 });
    console.log(`[order-service] connected to MongoDB: ${uri.redacted}`);
  } catch (err) {
    console.error('[order-service] MongoDB connection failed:', err.message);
    process.exit(1);
  }
}

module.exports = connectDB;