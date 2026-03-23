const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const TimeEntrySchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
  taskType: { type: String, required: true }, // e.g. "Programming", "NetSuite Support"
  date: { type: Date, required: true },
  duration: { type: Number, required: true }, // duration in minutes
  notes: { type: String, default: '' }
}, {
  timestamps: true
});

module.exports = mongoose.model('TimeEntry', TimeEntrySchema);
