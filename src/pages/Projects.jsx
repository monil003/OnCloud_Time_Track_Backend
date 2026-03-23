import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import './Projects.css';

const Projects = () => {
  const [projects, setProjects] = useState([]);
  const [name, setName] = useState('');
  const [clientOrTask, setClientOrTask] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchProjects = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/projects');
      setProjects(res.data);
    } catch (err) {
      console.error('Error fetching projects', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name) return;
    try {
      await axios.post('http://localhost:5000/api/projects', { name, clientOrTask });
      setName('');
      setClientOrTask('');
      fetchProjects();
    } catch (err) {
      console.error('Error creating project', err);
    }
  };

  if (loading) return <div>Loading projects...</div>;

  return (
    <div className="projects-container">
      <div className="projects-header">
        <h2>Projects</h2>
      </div>

      <div className="project-form-card">
        <h3>Add New Project</h3>
        <form onSubmit={handleSubmit} className="project-form">
          <div className="form-group row">
            <div className="input-col">
              <label>Project Name</label>
              <input 
                type="text" 
                value={name} 
                onChange={e => setName(e.target.value)} 
                placeholder="e.g. Internal Tool" 
                required 
              />
            </div>
            <div className="input-col">
              <label>Client / Client Task</label>
              <input 
                type="text" 
                value={clientOrTask} 
                onChange={e => setClientOrTask(e.target.value)} 
                placeholder="e.g. Acme Corp" 
              />
            </div>
            <div className="btn-col">
              <button type="submit" className="btn btn-primary" style={{ marginTop: '22px' }}>Save Project</button>
            </div>
          </div>
        </form>
      </div>

      <div className="projects-list">
        <h3>Your Projects</h3>
        {projects.length === 0 ? (
          <p className="empty-state">No projects found. Create one above.</p>
        ) : (
          <table className="projects-table">
            <thead>
              <tr>
                <th>Project Name</th>
                <th>Client / Task</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {projects.map(proj => (
                <tr key={proj._id}>
                  <td>{proj.name}</td>
                  <td>{proj.clientOrTask || '-'}</td>
                  <td>{new Date(proj.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Projects;
