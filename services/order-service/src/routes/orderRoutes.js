const express = require('express');
const router = express.Router();
const { createOrder, listOrders, getOrderById } = require('../controllers/orderController');
const authenticate = require('../middleware/auth');

router.post('/', authenticate, createOrder);
router.get('/', authenticate, listOrders);
router.get('/:id', authenticate, getOrderById);

module.exports = router;