const express = require('express');
const router = express.Router();
const Project = require('../models/Project');
const auth = require('../middleware/auth');

// Get all projects for current user
router.get('/', auth, async (req, res) => {
  try {
    const projects = await Project.find({ userId: req.user.userId }).sort({ createdAt: -1 });
    res.json(projects);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Create a new project
router.post('/', auth, async (req, res) => {
  try {
    const { name, clientOrTask } = req.body;
    
    const newProject = new Project({
      name,
      clientOrTask,
      userId: req.user.userId
    });

    const project = await newProject.save();
    res.json(project);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
