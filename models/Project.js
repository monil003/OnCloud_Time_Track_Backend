const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const ProjectSchema = new Schema({
  name: { type: String, required: true },
  clientOrTask: { type: String }, // e.g., 'NetSuite Development', 'Programming'
  subTasks: { type: [String], default: [] },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true }
}, {
  timestamps: true
});

module.exports = mongoose.model('Project', ProjectSchema);
