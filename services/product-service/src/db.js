const mongoose = require('mongoose');
const { buildMongoUri } = require('./mongoUri');

async function connectDB() {
  const uri = buildMongoUri(process.env, 'productdb');
  try {
    await mongoose.connect(uri.uri, { serverSelectionTimeoutMS: 5000 });
    console.log(`[product-service] connected to MongoDB: ${uri.redacted}`);
  } catch (err) {
    console.error('[product-service] MongoDB connection failed:', err.message);
    process.exit(1);
  }
}

module.exports = connectDB;