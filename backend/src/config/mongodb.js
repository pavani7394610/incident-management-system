const mongoose = require('mongoose');
require('dotenv').config();

const connectMongo = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    // Retry after 5 seconds instead of crashing
    setTimeout(connectMongo, 5000);
  }
};

module.exports = connectMongo;