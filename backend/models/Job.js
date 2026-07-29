const mongoose = require('mongoose');

const JobSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please add a job title'],
    trim: true,
    maxlength: [100, 'Title cannot be more than 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Please add a job description']
  },
  budget: {
    type: Number,
    required: [true, 'Please add a budget'],
    min: [0, 'Budget must be a positive number']
  },
  postedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['open', 'assigned', 'completed'],
    default: 'open'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Job', JobSchema);
