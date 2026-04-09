const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const TimeEntry = require('../models/TimeEntry');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

// Email transporter 
const getTransporter = () => nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Get all time entries for user
router.get('/', auth, async (req, res) => {
  try {
    const { startDate, endDate, sort } = req.query;
    
    let query = { userId: req.user.userId };
    
    if (startDate && endDate) {
      const endD = new Date(endDate);
      endD.setHours(23, 59, 59, 999);
      
      query.date = {
        $gte: new Date(startDate),
        $lte: endD
      };
    }

    const sortOrder = sort === 'desc' ? -1 : 1;

    const entries = await TimeEntry.find(query)
      .populate('projectId', 'name clientOrTask')
      .sort({ date: sortOrder });
      
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

    // Validate project assignment for non-admins
    if (req.user.role !== 'admin') {
      const User = require('../models/User');
      const user = await User.findById(req.user.userId);
      const isAssigned = user.assignedProjects.some(id => id.toString() === projectId);
      
      if (!isAssigned) {
        return res.status(403).json({ message: 'Access denied: This project is not assigned to you' });
      }
    }

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

// Import bulk time entries
router.post('/import', auth, async (req, res) => {
  try {
    const { entries } = req.body;
    if (!entries || !Array.isArray(entries)) {
      return res.status(400).json({ message: 'Invalid data format' });
    }

    // Validate project assignment for non-admins
    if (req.user.role !== 'admin') {
      const User = require('../models/User');
      const user = await User.findById(req.user.userId);
      const assignedProjects = user.assignedProjects.map(p => p.toString());
      
      for (let entry of entries) {
        if (!assignedProjects.includes(entry.projectId.toString())) {
          return res.status(403).json({ message: 'Access denied: One or more projects not assigned to you' });
        }
      }
    }

    const newEntries = entries.map(e => ({
      userId: req.user.userId,
      projectId: e.projectId,
      taskType: e.taskType,
      date: new Date(e.date),
      duration: e.duration,
      notes: e.notes || ''
    }));

    const inserted = await TimeEntry.insertMany(newEntries);
    const populated = await TimeEntry.find({ _id: { $in: inserted.map(e => e._id) } })
      .populate('projectId', 'name clientOrTask');
      
    res.json(populated);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Email timesheet for a selected date range
router.post('/email-timesheet', auth, async (req, res) => {
  try {
    const { startDate, endDate, targetUserId } = req.body;
    let queryUserId = req.user.userId;
    
    // If admin is requesting for a specific user
    if (req.user.role === 'admin' && targetUserId) {
      queryUserId = targetUserId;
    }

    let query = { userId: queryUserId };
    
    if (startDate && endDate) {
      const endD = new Date(endDate);
      endD.setHours(23, 59, 59, 999);
      query.date = {
        $gte: new Date(startDate),
        $lte: endD
      };
    }

    const entries = await TimeEntry.find(query)
      .populate('projectId', 'name clientOrTask')
      .sort({ date: 1 });

    if (entries.length === 0) {
      return res.status(400).json({ message: 'No time entries found for the selected range.' });
    }

    const User = require('../models/User');
    const targetUser = await User.findById(queryUserId);
    if (!targetUser) return res.status(404).json({ message: 'User not found' });

    let tableRows = '';
    let totalMins = 0;
    
    let csvContent = 'Date,Project,Client,Sub Task,Hours,Notes\n';

    entries.forEach(entry => {
      const dateStr = new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const projName = entry.projectId ? entry.projectId.name : 'Internal';
      const durationStr = `${Math.floor(entry.duration / 60)}:${(entry.duration % 60).toString().padStart(2, '0')}`;
      totalMins += entry.duration;

      const dateForCsv = new Date(entry.date).toISOString().split('T')[0];
      const clientName = entry.projectId?.clientOrTask || '';
      const hoursCsv = (entry.duration / 60).toFixed(2);
      const notesCsv = (entry.notes || '').replace(/"/g, '""').replace(/\n/g, ' | ');
      csvContent += `"${dateForCsv}","${projName}","${clientName}","${entry.taskType}",${hoursCsv},"${notesCsv}"\n`;

      tableRows += `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 14px;">${dateStr}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 14px;"><strong>${projName}</strong></td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 14px;">${entry.taskType}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 14px; font-weight: 600;">${durationStr}</td>
        </tr>
      `;
    });

    const totalFormatted = `${Math.floor(totalMins / 60)}:${(totalMins % 60).toString().padStart(2, '0')}`;

    const html = `
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #1e293b; background: white; padding: 20px;">
        <h2 style="color: #f36c21; font-weight: 800; font-size: 24px; margin-bottom: 8px;">Requested Timesheet Summary</h2>
        <p style="font-size: 16px; margin-bottom: 24px; color: #475569;">Hello ${targetUser.name}, here is the timesheet summary you requested (${startDate} to ${endDate}).</p>
        
        <table style="width: 100%; border-collapse: collapse; text-align: left; margin-bottom: 24px;">
          <thead>
            <tr>
              <th style="padding: 12px 10px; background: #f8fafc; border-bottom: 2px solid #cbd5e1; font-size: 13px; text-transform: uppercase;">Date</th>
              <th style="padding: 12px 10px; background: #f8fafc; border-bottom: 2px solid #cbd5e1; font-size: 13px; text-transform: uppercase;">Project</th>
              <th style="padding: 12px 10px; background: #f8fafc; border-bottom: 2px solid #cbd5e1; font-size: 13px; text-transform: uppercase;">Task Activity</th>
              <th style="padding: 12px 10px; background: #f8fafc; border-bottom: 2px solid #cbd5e1; font-size: 13px; text-transform: uppercase;">Time Logged</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3" style="padding: 16px 10px; font-weight: 800; text-align: right; font-size: 16px; color: #1e293b; border-bottom: 2px solid #f8fafc;">Total Hours:</td>
              <td style="padding: 16px 10px; font-weight: 800; font-size: 16px; color: #f36c21; border-bottom: 2px solid #f8fafc;">${totalFormatted}</td>
            </tr>
          </tfoot>
        </table>
        <p style="font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 16px;">Requested from OnCloud Time Track.</p>
      </div>
    `;

    await getTransporter().sendMail({
      from: process.env.EMAIL_USER,
      to: targetUser.email,
      subject: `Timesheet Summary: ${startDate} to ${endDate} — OnCloud Time`,
      html: html,
      attachments: [
        {
          filename: `Timesheet_${startDate}_to_${endDate}.csv`,
          content: csvContent
        }
      ]
    });

    res.json({ message: 'Email sent successfully!' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Get all time entries for all users (Admin Only)
router.get('/admin', [auth, admin], async (req, res) => {
  try {
    const { startDate, endDate, userId, projectId, sort } = req.query;
    let query = {};
    if (startDate && endDate) {
      const endD = new Date(endDate);
      endD.setHours(23, 59, 59, 999);
      
      query.date = {
        $gte: new Date(startDate),
        $lte: endD
      };
    }
    if (userId) {
      query.userId = userId;
    }
    if (projectId) {
      query.projectId = projectId;
    }

    const sortOrder = sort === 'desc' ? -1 : 1;

    const entries = await TimeEntry.find(query)
      .populate('userId', 'name email')
      .populate('projectId', 'name clientOrTask')
      .sort({ date: sortOrder });
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
