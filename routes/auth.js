const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const User = require('../models/User');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

// ---- Email transporter (lazy — reads env at call time) ----
const getTransporter = () => nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Register — creates unverified account and sends email OTP
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    user = new User({
      name,
      email,
      password,
      isEmailVerified: false,
      emailVerifyOtp: hashedOtp,
      emailVerifyOtpExpiry: otpExpiry,
    });
    await user.save();

    // Send verification email
    await getTransporter().sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Verify your email — OnCloud Time',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #f8fafc; border-radius: 16px;">
          <h2 style="color: #1e293b; margin-bottom: 8px;">Welcome to OnCloud Time, ${name}!</h2>
          <p style="color: #64748b; font-size: 15px; margin-bottom: 24px;">Please verify your email address using the code below. It expires in <strong>10 minutes</strong>.</p>
          <div style="background: white; border: 2px solid #e2e8f0; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
            <span style="font-size: 42px; font-weight: 800; letter-spacing: 12px; color: #f36c21; font-family: monospace;">${otp}</span>
          </div>
          <p style="color: #94a3b8; font-size: 13px;">If you didn't create an account, you can ignore this email.</p>
        </div>
      `,
    });

    res.status(201).json({ requiresVerification: true, email });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Verify Email OTP — POST /api/auth/verify-email
router.post('/verify-email', async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email });

    if (!user || !user.emailVerifyOtp || !user.emailVerifyOtpExpiry) {
      return res.status(400).json({ message: 'Invalid or expired code. Please register again.' });
    }
    if (new Date() > user.emailVerifyOtpExpiry) {
      return res.status(400).json({ message: 'Code expired. Please request a new one.' });
    }
    const hashedInput = crypto.createHash('sha256').update(otp).digest('hex');
    if (hashedInput !== user.emailVerifyOtp) {
      return res.status(400).json({ message: 'Incorrect code. Please try again.' });
    }

    // Mark verified and clear OTP
    user.isEmailVerified = true;
    user.emailVerifyOtp = null;
    user.emailVerifyOtpExpiry = null;
    await user.save();

    // Auto-login: return JWT
    const payload = { userId: user._id, role: user.role };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Resend Verification OTP — POST /api/auth/resend-verification
router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (user.isEmailVerified) return res.status(400).json({ message: 'Email already verified.' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.emailVerifyOtp = crypto.createHash('sha256').update(otp).digest('hex');
    user.emailVerifyOtpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    await getTransporter().sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'New verification code — OnCloud Time',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #f8fafc; border-radius: 16px;">
          <h2 style="color: #1e293b; margin-bottom: 8px;">New Verification Code</h2>
          <p style="color: #64748b; font-size: 15px; margin-bottom: 24px;">Your new code expires in <strong>10 minutes</strong>.</p>
          <div style="background: white; border: 2px solid #e2e8f0; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
            <span style="font-size: 42px; font-weight: 800; letter-spacing: 12px; color: #f36c21; font-family: monospace;">${otp}</span>
          </div>
        </div>
      `,
    });

    res.json({ message: 'New verification code sent.' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Login — blocks unverified accounts
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid Credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid Credentials' });
    }

    // Block login if email not verified
    if (!user.isEmailVerified) {
      return res.status(403).json({
        requiresVerification: true,
        email: user.email,
        message: 'Please verify your email before signing in.'
      });
    }

    // Block login if account is inactive
    if (user.active === false) {
      return res.status(403).json({
        message: 'Your account is inactive. Please contact your administrator.'
      });
    }

    const payload = {
      userId: user._id,
      role: user.role
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1d' });

    res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Get User
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Get All Users (Admin Only)
router.get('/', [auth, admin], async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Reset Password
router.put('/reset-password', auth, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isMatch = await user.comparePassword(oldPassword);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// =============================================
// STEP 1: Request OTP — POST /api/auth/forgot-password
// =============================================
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    // Always respond success to prevent email enumeration
    if (!user) {
      return res.json({ message: 'If that email exists, an OTP has been sent.' });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store hashed OTP
    const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');
    user.resetOtp = hashedOtp;
    user.resetOtpExpiry = otpExpiry;
    user.resetOtpVerified = false;
    await user.save();

    // Send email
    await getTransporter().sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Your Password Reset OTP — OnCloud Time',
      html: `
        <div style="font-family: 'Inter', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #f8fafc; border-radius: 16px;">
          <h2 style="color: #1e293b; font-size: 22px; margin-bottom: 8px;">Password Reset</h2>
          <p style="color: #64748b; font-size: 15px; margin-bottom: 24px;">Use the following one-time code to reset your password. It expires in <strong>10 minutes</strong>.</p>
          <div style="background: white; border: 2px solid #e2e8f0; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
            <span style="font-size: 42px; font-weight: 800; letter-spacing: 12px; color: #f36c21; font-family: monospace;">${otp}</span>
          </div>
          <p style="color: #94a3b8; font-size: 13px;">If you didn't request this, you can safely ignore this email. Your password won't change.</p>
        </div>
      `,
    });

    res.json({ message: 'If that email exists, an OTP has been sent.' });
  } catch (err) {
    console.error('forgot-password error:', err.message);
    res.status(500).json({ message: 'Failed to send OTP. Check email configuration.' });
  }
});

// =============================================
// STEP 2: Verify OTP — POST /api/auth/verify-otp
// =============================================
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email });

    if (!user || !user.resetOtp || !user.resetOtpExpiry) {
      return res.status(400).json({ message: 'Invalid or expired OTP. Please request a new one.' });
    }

    if (new Date() > user.resetOtpExpiry) {
      return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
    }

    const hashedInput = crypto.createHash('sha256').update(otp).digest('hex');
    if (hashedInput !== user.resetOtp) {
      return res.status(400).json({ message: 'Incorrect OTP. Please try again.' });
    }

    // Mark as verified
    user.resetOtpVerified = true;
    await user.save();

    res.json({ message: 'OTP verified successfully.' });
  } catch (err) {
    console.error('verify-otp error:', err.message);
    res.status(500).send('Server Error');
  }
});

// =============================================
// STEP 3: Reset Password — POST /api/auth/reset-password-otp
// =============================================
router.post('/reset-password-otp', async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    const user = await User.findOne({ email });

    if (!user || !user.resetOtpVerified) {
      return res.status(400).json({ message: 'OTP not verified. Please complete OTP verification first.' });
    }

    if (!user.resetOtpExpiry || new Date() > user.resetOtpExpiry) {
      return res.status(400).json({ message: 'Session expired. Please start again.' });
    }

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

    // Set new password and clear OTP fields
    user.password = newPassword;
    user.resetOtp = null;
    user.resetOtpExpiry = null;
    user.resetOtpVerified = false;
    await user.save();

    res.json({ message: 'Password reset successfully. You can now log in.' });
  } catch (err) {
    console.error('reset-password-otp error:', err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
