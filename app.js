var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var authRouter = require('./routes/auth');
var projectsRouter = require('./routes/projects');
var timeEntriesRouter = require('./routes/timeEntries');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

var app = express();

// Database connection with enhanced error handling
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB Connected to database: ' + mongoose.connection.name);
  })
  .catch(err => {
    console.error('❌ MongoDB Connection Error:');
    console.error(err);
    console.error('URI being used:', process.env.MONGODB_URI.replace(/:([^:@]+)@/, ':****@')); // Hide password in logs
  });

// Handle connection events
mongoose.connection.on('error', err => {
  console.error('Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('Mongoose disconnected');
});

app.use(cors());
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/api/auth', authRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/time-entries', timeEntriesRouter);

module.exports = app;
