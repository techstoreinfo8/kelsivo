
const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const requireAdmin = require('../middleware/requireAdmin');

// CUSTOMER: Submit a new order
router.post('/', async (req, res) => {
  try {
    
const { service, pickup, delivery, details, phone } = req.body || {};

const isText = (value, maxLength) =>
  typeof value === 'string' &&
  value.trim().length > 0 &&
  value.trim().length <= maxLength;

const validPhone =
  typeof phone === 'string' &&
  phone.length <= 30 &&
  /^(?=(?:\D*\d){7,20}\D*$)\+?[0-9\s().-]+$/.test(phone.trim());

if (
  !isText(service, 100) ||
  !isText(pickup, 500) ||
  !isText(delivery, 500) ||
  !validPhone ||
  (details !== undefined &&
    details !== null &&
    (typeof details !== 'string' || details.length > 5000))
) {
  return res.status(400).json({
    success: false,
    message: 'Please check your service, pickup, delivery, phone, and item details.',
  });
}


    if (
      typeof service !== 'string' || !service.trim() ||
      typeof pickup !== 'string' || !pickup.trim() ||
      typeof delivery !== 'string' || !delivery.trim() ||
      typeof phone !== 'string' || !phone.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: 'Please provide valid service, pickup, delivery, and phone details.',
      });
    }

    const [result] = await pool.execute(
      `INSERT INTO orders (service, pickup, delivery, details, phone)
       VALUES (?, ?, ?, ?, ?)`,
      [
        service.trim(),
        pickup.trim(),
        delivery.trim(),
        typeof details === 'string' ? details.trim() : '',
        phone.trim(),
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'Order saved successfully.',
      orderId: result.insertId,
    });
  } catch (error) {
    console.error('Creating order failed:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to save your order.',
    });
  }
});

// ADMIN: Retrieve all orders
router.get('/', requireAdmin, async (req, res) => {
  try {
    const [orders] = await pool.execute(
      `SELECT id, service, pickup, delivery, details, phone,
              status, created_at AS createdAt
       FROM orders
       ORDER BY created_at DESC`
    );

    return res.json({
      success: true,
      orders,
    });
  } catch (error) {
    console.error('Fetching orders failed:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to load orders.',
    });
  }
});

// ADMIN: Update order status
router.patch('/:id/status', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body || {};

    const allowedStatuses = [
      'New Request',
      'Quote Sent',
      'Confirmed',
      'In Transit',
      'Completed',
      'Cancelled',
    ];

    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID.',
      });
    }

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order status.',
      });
    }

    const [result] = await pool.execute(
      'UPDATE orders SET status = ? WHERE id = ?',
      [status, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.',
      });
    }

    const [rows] = await pool.execute(
      `SELECT id, service, pickup, delivery, details, phone,
              status, created_at AS createdAt
       FROM orders
       WHERE id = ?`,
      [id]
    );

    return res.json({
      success: true,
      message: 'Order status updated successfully.',
      order: rows[0],
    });
  } catch (error) {
    console.error('Updating order status failed:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to update order status.',
    });
  }
});

module.exports = router;
