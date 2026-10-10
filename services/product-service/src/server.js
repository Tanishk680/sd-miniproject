require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./db');
const productRoutes = require('./routes/productRoutes');
const Product = require('./models/Product');
const seedProducts = require('./data/seed');

const app = express();

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'product-service', time: new Date().toISOString() });
});

app.use('/api/products', productRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

const PORT = process.env.PORT || 5002;

async function seed() {
  const count = await Product.estimatedDocumentCount();
  if (count === 0) {
    await Product.insertMany(seedProducts);
    console.log(`[product-service] seeded ${seedProducts.length} products`);
  } else {
    console.log(`[product-service] catalog already seeded (${count} products)`);
  }
}

connectDB()
  .then(seed)
  .then(() => {
    app.listen(PORT, () => {
      console.log(`[product-service] listening on port ${PORT}`);
    });
  });