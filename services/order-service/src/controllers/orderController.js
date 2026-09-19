const Order = require('../models/Order');

exports.createOrder = async (req, res) => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items must be a non-empty array' });
    }

    const sanitizedItems = items.map((it) => ({
      productId: String(it.productId),
      name: String(it.name),
      price: Number(it.price),
      quantity: Number(it.quantity)
    }));

    if (sanitizedItems.some((it) => !it.name || it.price < 0 || it.quantity < 1)) {
      return res.status(400).json({ error: 'Invalid item fields' });
    }

    const totalAmount = sanitizedItems.reduce((sum, it) => sum + it.price * it.quantity, 0);
    if (totalAmount <= 0) {
      return res.status(400).json({ error: 'Invalid order total' });
    }

    const order = await Order.create({
      userId: req.userId,
      items: sanitizedItems,
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