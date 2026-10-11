require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const clientOrigin = (process.env.CLIENT_ORIGIN || '')
  .trim()
  .replace(/\/+$/, '');

app.use(cors({
  origin: clientOrigin,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '20kb' }));

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Kelsivo API is running'
  });
});

app.use('/api/admin', require('./routes/adminAuth'));
app.use('/api/orders', require('./routes/orders'));

app.use((err, req, res, next) => {
  console.error(err.message);

  res.status(500).json({
    success: false,
    message: 'An unexpected server error occurred',
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Kelsivo API running on port ${PORT}`);
});
