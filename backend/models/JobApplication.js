const mongoose = require('mongoose');

const JobApplicationSchema = new mongoose.Schema({
  job: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: true
  },
  freelancer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  bidAmount: {
    type: Number,
    required: [true, 'Please state your bid amount'],
    min: [0, 'Bid amount must be a positive number']
  },
  coverLetter: {
    type: String,
    required: [true, 'Please write a brief proposal/cover letter'],
    trim: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending'
  }
}, {
  timestamps: true
});

// Avoid multiple applications from the same freelancer to the same job
JobApplicationSchema.index({ job: 1, freelancer: 1 }, { unique: true });

module.exports = mongoose.model('JobApplication', JobApplicationSchema);
