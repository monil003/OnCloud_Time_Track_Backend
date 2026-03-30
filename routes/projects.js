const express = require('express');
const router = express.Router();
const Project = require('../models/Project');
const User = require('../models/User');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

// Get all projects for current user
router.get('/', auth, async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      const projects = await Project.find({}).sort({ createdAt: -1 });
      res.json(projects);
    } else {
      const user = await User.findById(req.user.userId).populate('assignedProjects');
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      // Sort assigned projects by creation date if possible, or just return them
      const sortedProjects = [...user.assignedProjects].sort((a, b) => b.createdAt - a.createdAt);
      res.json(sortedProjects);
    }
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Create a new project (Admin Only)
router.post('/', [auth, admin], async (req, res) => {
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

// Update a project (Admin Only)
router.put('/:id', [auth, admin], async (req, res) => {
  try {
    const { name, clientOrTask } = req.body;
    let project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    project.name = name || project.name;
    project.clientOrTask = clientOrTask || project.clientOrTask;

    await project.save();
    res.json(project);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Delete a project (Admin Only)
router.delete('/:id', [auth, admin], async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    await Project.findByIdAndDelete(req.params.id);
    res.json({ message: 'Project removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
