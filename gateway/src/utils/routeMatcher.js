/**
 * Boundary-aware L7 route matching.
 * Prevents `/api/products-invalid` from matching `/api/products`.
 */
function matchesRoute(requestPath, routePath) {
  if (!requestPath || !routePath) return false;
  return requestPath === routePath || requestPath.startsWith(`${routePath}/`);
}

/**
 * Most-specific (longest prefix) match, so overlapping routes
 * resolve deterministically.
 */
function findMatchingRoute(routes, requestPath) {
  let best = null;
  for (const r of routes || []) {
    if (matchesRoute(requestPath, r.path)) {
      if (!best || r.path.length > best.path.length) best = r;
    }
  }
  return best;
}

module.exports = { matchesRoute, findMatchingRoute };
