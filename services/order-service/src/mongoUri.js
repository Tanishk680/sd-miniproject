// Zero-dependency MongoDB URI builder (testable with plain `node`).
// Supports any password by URL-encoding credentials.
//
// - Dev (no MONGO_USER/MONGO_PASSWORD): MONGO_URI is used as-is.
// - Prod: MONGO_URI is the host template (no credentials in compose),
//   credentials come from MONGO_USER/MONGO_PASSWORD and are encoded,
//   so characters like @ : / ? # % in passwords cannot break parsing.
function buildMongoUri(env, fallbackDb) {
  const base = env.MONGO_URI || `mongodb://127.0.0.1:27017/${fallbackDb}`;
  const user = env.MONGO_USER;
  const pass = env.MONGO_PASSWORD;

  if (user === undefined && pass === undefined) {
    return { uri: base, redacted: base };
  }
  if (!user || pass === undefined) {
    throw new Error('MONGO_USER and MONGO_PASSWORD must both be set for authenticated MongoDB');
  }
  const m = base.match(/^(mongodb(?:\+srv)?:\/\/)(.*)$/);
  if (!m) {
    throw new Error(`Invalid MONGO_URI: ${base}`);
  }
  return {
    uri: `${m[1]}${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${m[2]}`,
    redacted: `${m[1]}${encodeURIComponent(user)}:***@${m[2]}`
  };
}

module.exports = { buildMongoUri };
