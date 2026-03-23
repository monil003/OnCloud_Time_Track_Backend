import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { format, startOfWeek, addDays, isSameDay } from 'date-fns';
import './Dashboard.css';

const Dashboard = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [projects, setProjects] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);
  
  // Form state
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [taskType, setTaskType] = useState('Programming');
  const [notes, setNotes] = useState('');
  const [duration, setDuration] = useState('0:00');

  const fetchInitialData = async () => {
    try {
      const [projRes, entriesRes] = await Promise.all([
        axios.get('http://localhost:5000/api/projects'),
        axios.get('http://localhost:5000/api/time-entries')
      ]);
      setProjects(projRes.data);
      setTimeEntries(entriesRes.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday
  const weekDays = [...Array(7)].map((_, i) => addDays(weekStart, i));

  const formatDurationDisplay = (mins) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}:${m.toString().padStart(2, '0')}`;
  };

  const parseDurationToMins = (str) => {
    if (!str.includes(':')) return parseFloat(str) * 60;
    const [h, m] = str.split(':');
    return (parseInt(h) || 0) * 60 + (parseInt(m) || 0);
  };

  const handleSaveEntry = async () => {
    if (!selectedProjectId) return alert("Select a project");
    const mins = parseDurationToMins(duration);
    if (mins <= 0) return alert("Enter valid duration");

    try {
      const res = await axios.post('http://localhost:5000/api/time-entries', {
        projectId: selectedProjectId,
        taskType,
        date: currentDate,
        duration: mins,
        notes
      });
      setTimeEntries([res.data, ...timeEntries]);
      setIsModalOpen(false);
      resetForm();
    } catch (err) {
      console.error(err);
    }
  };

  const resetForm = () => {
    setSelectedProjectId('');
    setTaskType('Programming');
    setNotes('');
    setDuration('0:00');
  };

  const todayEntries = timeEntries.filter(e => isSameDay(new Date(e.date), currentDate));
  const weekTotalMins = timeEntries.filter(e => {
    const d = new Date(e.date);
    return d >= weekStart && d <= addDays(weekStart, 6);
  }).reduce((acc, curr) => acc + curr.duration, 0);

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div className="date-nav">
          <button className="date-nav-btn" onClick={() => setCurrentDate(addDays(currentDate, -1))}>&larr;</button>
          <button className="date-nav-btn" onClick={() => setCurrentDate(addDays(currentDate, 1))}>&rarr;</button>
          <h2>{format(currentDate, 'EEEE, d MMM')}</h2>
          <span style={{color: 'var(--primary-orange)', fontSize: '14px', cursor:'pointer'}} onClick={() => setCurrentDate(new Date())}>Return to today</span>
        </div>
        <div className="view-toggles">
          <button className="view-toggle-btn active">Day</button>
          <button className="view-toggle-btn">Week</button>
        </div>
      </div>

      <div className="time-view-container">
        <div>
          <button className="add-time-btn" onClick={() => setIsModalOpen(true)}>+</button>
          <div className="add-time-label">Track time</div>
        </div>

        <div className="time-grid-container">
          <div className="week-row">
            {weekDays.map(day => {
              const isActive = isSameDay(day, currentDate);
              const dayEntries = timeEntries.filter(e => isSameDay(new Date(e.date), day));
              const dayTotal = dayEntries.reduce((acc, curr) => acc + curr.duration, 0);
              
              return (
                <div key={day.toISOString()} className={`day-col ${isActive ? 'active' : ''}`} onClick={() => setCurrentDate(day)} style={{cursor: 'pointer'}}>
                  <div className="day-name">{format(day, 'eee')}</div>
                  <div className="day-total">{formatDurationDisplay(dayTotal)}</div>
                </div>
              );
            })}
            <div className="day-col week-total" style={{ textAlign: 'right', flex: '0.8', color: 'var(--text-main)' }}>
              <div className="day-name">Week total</div>
              <div className="day-total" style={{fontSize: '18px'}}>{formatDurationDisplay(weekTotalMins)}</div>
            </div>
          </div>

          <div className="entries-area" style={{ background: todayEntries.length ? 'transparent' : '#EFEFEF' }}>
            {todayEntries.length === 0 ? (
              <div className="empty-quote">
                "Time is on my side, yes it is."<br/>- The Rolling Stones
              </div>
            ) : (
              <div style={{width: '100%'}}>
                {todayEntries.map(entry => (
                  <div className="time-entry-item" key={entry._id}>
                    <div className="entry-details">
                      <div className="entry-project">{entry.projectId?.name || 'Unknown Project'} - {entry.projectId?.clientOrTask || 'Unknown Client'}</div>
                      <div className="entry-task">{entry.taskType}</div>
                      {entry.notes && <div className="entry-notes">{entry.notes}</div>}
                    </div>
                    <div className="entry-duration">
                      {formatDurationDisplay(entry.duration)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              New time entry for {format(currentDate, 'EEEE, d MMM')}
            </div>
            <div className="modal-body">
              <div className="form-group">
                <select 
                  value={selectedProjectId} 
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  style={{ width: '100%', padding: '12px', fontSize: '15px' }}
                >
                  <option value="" disabled>Project / Task</option>
                  {projects.map(p => (
                    <option key={p._id} value={p._id}>{p.name} - {p.clientOrTask}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <select 
                  value={taskType} 
                  onChange={(e) => setTaskType(e.target.value)}
                  style={{ width: '100%', padding: '12px', fontSize: '15px' }}
                >
                  <option value="Programming">Programming</option>
                  <option value="Design">Design</option>
                  <option value="Project Management">Project Management</option>
                  <option value="NetSuite Development">NetSuite Development</option>
                  <option value="NetSuite Support">NetSuite Support</option>
                </select>
              </div>
              <div className="time-input-row">
                <input 
                  type="text" 
                  className="notes-input" 
                  placeholder="Notes (optional)" 
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
                <input 
                  type="text" 
                  className="duration-input" 
                  placeholder="0:00" 
                  value={duration}
                  onChange={e => setDuration(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={handleSaveEntry}>Start timer</button>
              <button className="btn btn-outline" onClick={() => setIsModalOpen(false)}>Cancel</button>
              <div style={{marginLeft: 'auto', color: 'var(--primary-orange)', fontSize: '14px', cursor: 'pointer'}}>
                &#128197; Pull in a calendar event
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
