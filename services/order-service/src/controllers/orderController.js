const Order = require('../models/Order');
const { fetchProduct, ProductServiceError } = require('../services/productClient');

const MAX_QUANTITY = 100;

exports.createOrder = async (req, res) => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items must be a non-empty array' });
    }

    // Only productId + quantity are accepted from the client.
    // name/price are re-fetched from the product service so a tampered
    // request cannot set its own total.
    for (const it of items) {
      const qty = Number(it && it.quantity);
      if (!it || !it.productId || !Number.isInteger(qty) || qty < 1 || qty > MAX_QUANTITY) {
        return res.status(400).json({ error: 'Each item needs a productId and an integer quantity 1-100' });
      }
    }

    let catalogProducts;
    try {
      catalogProducts = await Promise.all(items.map((it) => fetchProduct(String(it.productId))));
    } catch (err) {
      if (err instanceof ProductServiceError) {
        return res.status(err.statusCode).json({ error: err.message });
      }
      throw err;
    }

    const serverItems = items.map((it, i) => {
      const catalog = catalogProducts[i];
      const clientPrice = Number(it.price);
      if (clientPrice !== catalog.price) {
        console.warn(`[order-service] client price ${it.price} ignored for ${it.productId}; catalog price ${catalog.price} applied`);
      }
      return {
        productId: String(catalog._id || it.productId),
        name: String(catalog.name),
        price: Number(catalog.price),
        quantity: Number(it.quantity)
      };
    });

    const totalAmount = serverItems.reduce((sum, it) => sum + it.price * it.quantity, 0);
    if (!(totalAmount > 0)) {
      return res.status(400).json({ error: 'Invalid order total' });
    }

    const order = await Order.create({
      userId: req.userId,
      items: serverItems,
      totalAmount,
      status: 'PLACED'
    });

    return res.status(201).json({ order });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.listOrders = async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.userId }).sort({ createdAt: -1 });
    return res.json({ orders, count: orders.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, userId: req.userId });
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    return res.json({ order });
  } catch (_err) {
    return res.status(400).json({ error: 'Invalid order id' });
  }
};