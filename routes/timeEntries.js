const express = require('express');
const router = express.Router();
const TimeEntry = require('../models/TimeEntry');
const auth = require('../middleware/auth');

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

module.exports = router;
