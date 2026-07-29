const path = require('path');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

// Load environment variables from the parent directory
dotenv.config({ path: path.join(__dirname, '../.env') });

// Connect to Database
connectDB();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/jobs', require('./routes/jobs'));
app.use('/api/contracts', require('./routes/contracts'));
app.use('/api/escrow', require('./routes/escrow'));

// Root Endpoint
app.get('/', (req, res) => {
  res.json({ message: 'Freelance Escrow Marketplace API is running...' });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: err.message || 'Server Error'
  });
});

const PORT = process.env.NODE_ENV === 'test' ? 5001 : (process.env.PORT || 5000);

const server = app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

module.exports = { app, server };
