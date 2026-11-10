const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { userPasswordHashDuration } = require('../metrics');

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true, minlength: 3 },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, required: true, minlength: 6 },
    createdAt: { type: Date, default: Date.now }
  },
  { versionKey: false }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const started = process.hrtime.bigint();
  try {
    this.password = await bcrypt.hash(this.password, 10);
  } finally {
    userPasswordHashDuration
      .labels('hash')
      .observe(Number(process.hrtime.bigint() - started) / 1e9);
  }
  next();
});

userSchema.methods.comparePassword = function (candidate) {
  const started = process.hrtime.bigint();
  return Promise.resolve()
    .then(() => bcrypt.compare(candidate, this.password))
    .finally(() => {
      userPasswordHashDuration
        .labels('compare')
        .observe(Number(process.hrtime.bigint() - started) / 1e9);
    });
};

userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.password;
    return ret;
  }
});

module.exports = mongoose.model('User', userSchema);