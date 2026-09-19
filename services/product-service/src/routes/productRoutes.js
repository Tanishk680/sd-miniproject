const express = require('express');
const router = express.Router();
const { listProducts, getProductById, searchProducts } = require('../controllers/productController');

router.get('/', listProducts);
router.get('/search', searchProducts);
router.get('/:id', getProductById);

module.exports = router;