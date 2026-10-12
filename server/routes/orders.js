
const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const requireAdmin = require('../middleware/requireAdmin');

const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char]);

// CUSTOMER: Submit a new order

router.post('/', async (req, res) => {
  try {
    const {
      service,
      pickup,
      delivery,
      details,
      phone,
      email,
    } = req.body || {};

    // Validate the optional email address.
    const validEmail =
      email === undefined ||
      email === null ||
      email === '' ||
      (
        typeof email === 'string' &&
        email.trim().length <= 254 &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
      );

    if (!validEmail) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address.',
      });
    }

    const isText = (value, maxLength) =>
      typeof value === 'string' &&
      value.trim().length > 0 &&
      value.trim().length <= maxLength;

    // Validate phone: 7–20 digits, with optional formatting.
    const validPhone =
      typeof phone === 'string' &&
      phone.length <= 30 &&
      /^(?=(?:\D*\d){7,20}\D*$)\+?[0-9\s().-]+$/.test(
        phone.trim()
      );

    if (
      !isText(service, 100) ||
      !isText(pickup, 500) ||
      !isText(delivery, 500) ||
      !validPhone ||
      !validEmail ||
      (
        details !== undefined &&
        details !== null &&
        (
          typeof details !== 'string' ||
          details.length > 5000
        )
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Please check your service, pickup, delivery, phone, and item details.',
      });
    }

    const customerEmail =
      typeof email === 'string' ? email.trim() : '';

    // 1. Save the booking in MySQL first.
    const [result] = await pool.execute(
      `INSERT INTO orders
       (service, pickup, delivery, details, phone, email)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        service.trim(),
        pickup.trim(),
        delivery.trim(),
        typeof details === 'string' ? details.trim() : '',
        phone.trim(),
        customerEmail || null,
      ]
    );

    const orderId = result.insertId;

    // 2. Send confirmation if the customer provided an email.
    // Email failure must not cancel the saved booking.
    if (customerEmail) {
      try {
        const { data, error } = await resend.emails.send({
          from: 'Kelsivo <onboarding@resend.dev>',
          to: [customerEmail],
          subject: `Kelsivo Booking Confirmation - Order #${orderId}`,
          html: `
            <div style="font-family:Arial,sans-serif;line-height:1.7;color:#222">
              <h2>Thank you for choosing Kelsivo!</h2>
              <p>Your booking has been received successfully.</p>
              <p><strong>Order ID:</strong> ${escapeHtml(orderId)}</p>
              <p><strong>Service:</strong> ${escapeHtml(service.trim())}</p>
              <p><strong>Pickup:</strong> ${escapeHtml(pickup.trim())}</p>
              <p><strong>Delivery:</strong> ${escapeHtml(delivery.trim())}</p>
              <p><strong>Status:</strong> New Request</p>
              <p>Please keep your order ID and booking phone number
              to track your order.</p>
              <p>Thank you,<br>Kelsivo Team</p>
            </div>
          `,
        });

        if (error) {
          console.error('Confirmation email failed:', error);
        } else {
          console.log(
            `Confirmation email accepted for order #${orderId}:`,
            data?.id
          );
        }
      } catch (emailError) {
        console.error(
          'Confirmation email failed:',
          emailError.message
        );
      }
    }

    // 3. Return booking success even if email delivery fails.
    return res.status(201).json({
      success: true,
      message: 'Order saved successfully.',
      orderId,
    });
  } catch (error) {
    console.error('Creating order failed:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to save your order.',
    });
  }
});




 // CUSTOMER: Track one order using its order ID and booking phone
router.get('/track', async (req, res) => {
  try {
    const orderId = Number(req.query.orderId);
    const phone = req.query.phone;

    if (
      !Number.isSafeInteger(orderId) ||
      orderId <= 0 ||
      typeof phone !== 'string' ||
      !phone.trim() ||
      phone.trim().length > 30
    ) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid order ID and phone number.',
      });
    }

    const [rows] = await pool.execute(
      `SELECT id, service, pickup, delivery, status,
              created_at AS createdAt
       FROM orders
       WHERE id = ? AND phone = ?
       LIMIT 1`,
      [orderId, phone.trim()]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No matching order found. Check your order ID and booking phone number.',
      });
    }

    return res.json({
      success: true,
      order: rows[0],
    });
  } catch (error) {
    console.error('Tracking order failed:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to track your order right now.',
    });
  }
});


// ADMIN: Retrieve all orders
router.get('/', requireAdmin, async (req, res) => {
  try {
    const [orders] = await pool.execute(
      `SELECT id, service, pickup, delivery, details, phone, email,
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

    // 1. Retrieve the current order before changing its status.
    const [existingOrders] = await pool.execute(
      `SELECT id, service, pickup, delivery, email, status
       FROM orders
       WHERE id = ?
       LIMIT 1`,
      [id]
    );

    if (existingOrders.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.',
      });
    }

    const existingOrder = existingOrders[0];
    const previousStatus = existingOrder.status;

    // 2. Update the status in MySQL.
    await pool.execute(
      'UPDATE orders SET status = ? WHERE id = ?',
      [status, id]
    );

    // 3. Send email only when the status actually changes.
    const customerEmail =
      typeof existingOrder.email === 'string'
        ? existingOrder.email.trim()
        : '';

    if (previousStatus !== status && customerEmail) {
      try {
        const { data, error } = await resend.emails.send({
          from: 'Kelsivo <onboarding@resend.dev>',
          to: [customerEmail],
          subject: `Kelsivo Order #${id} - Status Updated`,
          html: `
            <div style="font-family:Arial,sans-serif;line-height:1.7;color:#222">
              <h2>Your Kelsivo order has been updated</h2>
              <p>Hello,</p>
              <p>The status of your booking has changed.</p>
              <p><strong>Order ID:</strong> ${escapeHtml(id)}</p>
              <p><strong>Service:</strong> ${escapeHtml(existingOrder.service)}</p>
              <p><strong>Previous status:</strong> ${escapeHtml(previousStatus)}</p>
              <p><strong>New status:</strong> ${escapeHtml(status)}</p>
              <p><strong>Pickup:</strong> ${escapeHtml(existingOrder.pickup)}</p>
              <p><strong>Delivery:</strong> ${escapeHtml(existingOrder.delivery)}</p>
              <p>Thank you for choosing Kelsivo!</p>
              <p>Kelsivo Team</p>
            </div>
          `,
        });

        if (error) {
          console.error('Status update email failed:', error);
        } else {
          console.log(
            `Status update email accepted for order #${id}:`,
            data?.id
          );
        }
      } catch (emailError) {
        console.error(
          'Status update email failed:',
          emailError.message
        );
      }
    }

    // 4. Return the updated order to the existing Admin dashboard.
    const [rows] = await pool.execute(
      `SELECT id, service, pickup, delivery, details, phone, email,
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
