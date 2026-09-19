const Product = require('../models/Product');

exports.listProducts = async (req, res) => {
  try {
    const filter = {};
    if (req.query.category) filter.category = req.query.category;
    const products = await Product.find(filter).sort({ createdAt: -1 });
    return res.json({ products, count: products.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    return res.json({ product });
  } catch (_err) {
    return res.status(400).json({ error: 'Invalid product id' });
  }
};

exports.searchProducts = async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) {
      return res.status(400).json({ error: 'Search query "q" is required' });
    }
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    const products = await Product.find({
      $or: [{ name: regex }, { description: regex }, { category: regex }]
    }).sort({ createdAt: -1 });
    return res.json({ query: q, products, count: products.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};