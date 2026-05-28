const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const TimesheetInstructionSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  startDate: { type: String, required: true }, // Format: YYYY-MM-DD
  endDate: { type: String, required: true },   // Format: YYYY-MM-DD
  instructions: { type: String, default: '' }
}, {
  timestamps: true
});

// Compound unique index to quickly look up or update specific timesheet instructions
TimesheetInstructionSchema.index({ userId: 1, startDate: 1, endDate: 1 }, { unique: true });

module.exports = mongoose.model('TimesheetInstruction', TimesheetInstructionSchema);
