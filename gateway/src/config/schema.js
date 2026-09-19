const Joi = require('joi');

const rateLimitSchema = Joi.object({
  windowMs: Joi.number().integer().positive().default(60000),
  max: Joi.number().integer().positive().default(100)
});

const routeSchema = Joi.object({
  path: Joi.string().pattern(/^\//).required(),
  target: Joi.string().uri({ scheme: [/https?/] }).required(),
  auth: Joi.boolean().default(false),
  healthPath: Joi.string().pattern(/^\//).default('/health'),
  rateLimit: rateLimitSchema.optional()
});

const configSchema = Joi.object({
  rateLimit: rateLimitSchema.default(),
  routes: Joi.array().items(routeSchema).min(1).required()
});

function validateConfig(raw) {
  const { value, error } = configSchema.validate(raw, { allowUnknown: false });
  if (error) {
    return { error: error.message };
  }
  return { value };
}

module.exports = { validateConfig };