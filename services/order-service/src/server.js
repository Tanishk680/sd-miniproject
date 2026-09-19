require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./db');
const orderRoutes = require('./routes/orderRoutes');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'order-service', time: new Date().toISOString() });
});

app.use('/api/orders', orderRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

const PORT = process.env.PORT || 5003;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`[order-service] listening on port ${PORT}`);
  });
});