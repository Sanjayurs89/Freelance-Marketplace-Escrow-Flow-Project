const mongoose = require('mongoose');

const ContractSchema = new mongoose.Schema({
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
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  agreedAmount: {
    type: Number,
    required: [true, 'Please add an agreed amount'],
    min: [0, 'Agreed amount must be a positive number']
  },
  status: {
    type: String,
    enum: ['draft', 'active', 'completed', 'cancelled'],
    default: 'draft'
  },
  deadline: {
    type: Date
  },
  extensionRequest: {
    days: {
      type: Number
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected']
    },
    requestedAt: {
      type: Date
    }
  },
  extensionRequestsCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Contract', ContractSchema);
