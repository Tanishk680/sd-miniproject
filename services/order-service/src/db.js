const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/orderdb';
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log(`[order-service] connected to MongoDB: ${uri}`);
  } catch (err) {
    console.error('[order-service] MongoDB connection failed:', err.message);
    process.exit(1);
  }
}

module.exports = connectDB;