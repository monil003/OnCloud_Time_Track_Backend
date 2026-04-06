const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const Schema = mongoose.Schema;

const UserSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  assignedProjects: [{ type: Schema.Types.ObjectId, ref: 'Project' }],
  // Email verification
  isEmailVerified: { type: Boolean, default: false },
  emailVerifyOtp: { type: String, default: null },
  emailVerifyOtpExpiry: { type: Date, default: null },
  // Password reset OTP fields
  resetOtp: { type: String, default: null },
  resetOtpExpiry: { type: Date, default: null },
  resetOtpVerified: { type: Boolean, default: false },
  active: { type: Boolean, default: true }
}, {
  timestamps: true
});

UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    return next();
  } catch (err) {
    return next(err);
  }
});

UserSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);
