const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://product-service:5002';
const TIMEOUT_MS = Number(process.env.PRODUCT_FETCH_TIMEOUT_MS || 5000);

class ProductServiceError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

// Fetch the authoritative product record. Prices/names from the client are
// never trusted — the order total is always computed from catalog data.
async function fetchProduct(productId) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(
      `${PRODUCT_SERVICE_URL}/api/products/${encodeURIComponent(productId)}`,
      { signal: controller.signal }
    );
    if (res.status === 404) {
      throw new ProductServiceError(`Invalid product: ${productId}`, 400);
    }
    if (!res.ok) {
      throw new ProductServiceError(`Invalid product: ${productId}`, 400);
    }
    const data = await res.json();
    if (!data || !data.product || typeof data.product.price !== 'number') {
      throw new ProductServiceError(`Invalid product: ${productId}`, 400);
    }
    return data.product;
  } catch (err) {
    if (err instanceof ProductServiceError) throw err;
    const reason = err && err.name === 'AbortError' ? 'timed out' : (err && err.message) || 'unreachable';
    throw new ProductServiceError(`Product service unavailable (${reason})`, 503);
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { fetchProduct, ProductServiceError, PRODUCT_SERVICE_URL };
