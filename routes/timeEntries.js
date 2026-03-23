const express = require('express');
const router = express.Router();
const TimeEntry = require('../models/TimeEntry');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

// Get all time entries for user
router.get('/', auth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let query = { userId: req.user.userId };
    
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const entries = await TimeEntry.find(query)
      .populate('projectId', 'name clientOrTask')
      .sort({ date: -1 });
      
    res.json(entries);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Create a new time entry
router.post('/', auth, async (req, res) => {
  try {
    const { projectId, taskType, date, duration, notes } = req.body;

    const newEntry = new TimeEntry({
      userId: req.user.userId,
      projectId,
      taskType,
      date,
      duration,
      notes
    });

    const entry = await newEntry.save();
    await entry.populate('projectId', 'name clientOrTask');
    res.json(entry);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Get all time entries for all users (Admin Only)
router.get('/admin', [auth, admin], async (req, res) => {
  try {
    const { startDate, endDate, userId, projectId } = req.query;
    let query = {};
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    if (userId) {
      query.userId = userId;
    }
    if (projectId) {
      query.projectId = projectId;
    }
    const entries = await TimeEntry.find(query)
      .populate('userId', 'name email')
      .populate('projectId', 'name clientOrTask')
      .sort({ date: -1 });
    res.json(entries);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Update a time entry
router.put('/:id', auth, async (req, res) => {
  try {
    const { projectId, taskType, date, duration, notes } = req.body;
    let entry = await TimeEntry.findById(req.params.id);

    if (!entry) {
      return res.status(404).json({ message: 'Time entry not found' });
    }

    // Check if user owns the entry or is admin
    if (entry.userId.toString() !== req.user.userId && req.user.role !== 'admin') {
      return res.status(401).json({ message: 'User not authorized' });
    }

    entry.projectId = projectId || entry.projectId;
    entry.taskType = taskType || entry.taskType;
    entry.date = date || entry.date;
    entry.duration = duration || entry.duration;
    entry.notes = notes || entry.notes;

    await entry.save();
    await entry.populate('projectId', 'name clientOrTask');
    res.json(entry);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Delete a time entry
router.delete('/:id', auth, async (req, res) => {
  try {
    const entry = await TimeEntry.findById(req.params.id);

    if (!entry) {
      return res.status(404).json({ message: 'Time entry not found' });
    }

    // Check if user owns the entry or is admin
    if (entry.userId.toString() !== req.user.userId && req.user.role !== 'admin') {
      return res.status(401).json({ message: 'User not authorized' });
    }

    await TimeEntry.findByIdAndDelete(req.params.id);
    res.json({ message: 'Time entry removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
