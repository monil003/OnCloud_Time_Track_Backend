const express = require('express');
const router = express.Router();
const User = require('../models/User');
const TimeEntry = require('../models/TimeEntry');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

// @route    GET /api/users
// @desc     Get all employees (Admin Only)
// @access   Private/Admin
router.get('/', [auth, admin], async (req, res) => {
  try {
    const users = await User.find({ role: 'user' }).select('-password').populate('assignedProjects');
    res.json(users);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    PUT /api/users/:id/assign-projects
// @desc     Assign projects to an employee (Admin Only)
// @access   Private/Admin
router.put('/:id/assign-projects', [auth, admin], async (req, res) => {
  try {
    const { projectIds } = req.body;
    let user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.assignedProjects = projectIds;
    await user.save();
    
    // Return updated user with populated projects
    user = await User.findById(req.params.id).select('-password').populate('assignedProjects');
    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    DELETE /api/users/:id
// @desc     Delete an employee and their time entries (Admin Only)
// @access   Private/Admin
router.delete('/:id', [auth, admin], async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Delete all time entries for this user
    await TimeEntry.deleteMany({ userId: req.params.id });

    // Delete the user
    await User.findByIdAndDelete(req.params.id);

    res.json({ message: 'User and associated time entries deleted successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
