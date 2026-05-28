const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const http = require('http');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const setupSocket = require('./socket/index');

dotenv.config();

const app = express();
const server = http.createServer(app);

// Middleware
const allowedOrigins = ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', process.env.CLIENT_URL].filter(Boolean);
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(helmet());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB
connectDB();

// Routes
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/exams', require('./routes/exam.routes'));
app.use('/api/faculty', require('./routes/faculty.routes'));
app.use('/api/labs', require('./routes/lab.routes'));

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'TypeProctor API is running', timestamp: new Date().toISOString() });
});

// Setup Socket.IO
const io = setupSocket(server);

// Install axios for ML service calls
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`\n  TypeProctor API running on http://localhost:${PORT}`);
  console.log(`  Socket.IO ready for real-time monitoring\n`);
});
