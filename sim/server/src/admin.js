const crypto = require('crypto');
const config = require('./config');
const store = require('./store');

function tokenHash(token) {
  return crypto.createHash('sha256').update(String(token).trim()).digest('hex');
}

function ensureAdminIdentities() {
  const identities = [...(config.adminIdentities || [])];
  for (const identity of identities) {
    store.upsertAdmin({ name: identity.name, tokenHash: tokenHash(identity.token) });
  }
  if (config.adminIdentitiesRaw) {
    store.deactivateAdminsNotIn(identities.map((identity) => identity.name));
  }
  return identities.length > 0;
}

module.exports = { tokenHash, ensureAdminIdentities };
