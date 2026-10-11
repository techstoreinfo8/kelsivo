
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};

    // Validate incoming values
    if (
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      !email.trim() ||
      !password ||
      email.trim().length > 254 ||
      password.length > 1024
    ) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email and password.',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const adminEmail = process.env.ADMIN_EMAIL
      ?.trim()
      .toLowerCase();

    const passwordHash = process.env.ADMIN_PASSWORD_HASH;
    const jwtSecret = process.env.JWT_SECRET;

    // Verify required server configuration
    if (!adminEmail || !passwordHash || !jwtSecret) {
      console.error(
        'Admin authentication environment variables are missing.'
      );

      return res.status(500).json({
        success: false,
        message: 'Admin authentication is not configured.',
      });
    }

    // Check credentials
    const emailMatches = normalizedEmail === adminEmail;

    const passwordMatches = await bcrypt.compare(
      password,
      passwordHash
    );

    if (!emailMatches || !passwordMatches) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // Issue an admin token that expires after eight hours
    const token = jwt.sign(
      {
        role: 'admin',
        email: normalizedEmail,
      },
      jwtSecret,
      {
        algorithm: 'HS256',
        expiresIn: '8h',
      }
    );

    return res.json({
      success: true,
      message: 'Admin login successful.',
      token,
      admin: {
        email: normalizedEmail,
      },
    });
  } catch (error) {
    console.error('Admin login failed:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to log in. Please try again.',
    });
  }
});

module.exports = router;
