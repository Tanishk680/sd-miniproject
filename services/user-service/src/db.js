const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/userdb';
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log(`[user-service] connected to MongoDB: ${uri}`);
  } catch (err) {
    console.error('[user-service] MongoDB connection failed:', err.message);
    process.exit(1);
  }
}

module.exports = connectDB;