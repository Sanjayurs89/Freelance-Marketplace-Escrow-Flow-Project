const mongoose = require('mongoose');

const EscrowTransactionSchema = new mongoose.Schema({
  contract: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contract',
    required: true
  },
  amount: {
    type: Number,
    required: [true, 'Please add a transaction amount'],
    min: [0, 'Amount must be positive']
  },
  releasedAmount: {
    type: Number,
    default: 0,
    min: [0, 'Released amount cannot be negative']
  },
  refundedAmount: {
    type: Number,
    default: 0,
    min: [0, 'Refunded amount cannot be negative']
  },
  heldAmount: {
    type: Number,
    default: 0,
    min: [0, 'Held amount cannot be negative']
  },
  status: {
    type: String,
    enum: ['funded', 'in_progress', 'delivered', 'released', 'disputed', 'refunded'],
    default: 'funded'
  },
  fundedAt: {
    type: Date,
    default: Date.now
  },
  inProgressAt: {
    type: Date
  },
  deliveredAt: {
    type: Date
  },
  releasedAt: {
    type: Date
  },
  disputedAt: {
    type: Date
  },
  refundedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Enforce invariant: amount = releasedAmount + refundedAmount + heldAmount
EscrowTransactionSchema.pre('save', function(next) {
  // To handle floating point rounding issues safely
  const sum = this.releasedAmount + this.refundedAmount + this.heldAmount;
  if (Math.abs(this.amount - sum) > 0.001) {
    return next(new Error(`Invariant violation: funded amount (${this.amount}) must equal released (${this.releasedAmount}) + refunded (${this.refundedAmount}) + held (${this.heldAmount})`));
  }

  // Validate that internal balances match status
  if (['funded', 'in_progress', 'delivered', 'disputed'].includes(this.status)) {
    if (this.heldAmount !== this.amount || this.releasedAmount !== 0 || this.refundedAmount !== 0) {
      return next(new Error(`Validation error: state "${this.status}" requires heldAmount matching amount (${this.amount}), and zero released and refunded amounts.`));
    }
  } else if (this.status === 'released') {
    if (this.heldAmount !== 0 || this.releasedAmount !== this.amount || this.refundedAmount !== 0) {
      return next(new Error(`Validation error: state "released" requires heldAmount to be 0, releasedAmount matching amount (${this.amount}), and zero refundedAmount.`));
    }
  } else if (this.status === 'refunded') {
    if (this.heldAmount !== 0 || this.releasedAmount !== 0 || this.refundedAmount !== this.amount) {
      return next(new Error(`Validation error: state "refunded" requires heldAmount to be 0, releasedAmount to be 0, and refundedAmount matching amount (${this.amount}).`));
    }
  }

  next();
});

module.exports = mongoose.model('EscrowTransaction', EscrowTransactionSchema);
