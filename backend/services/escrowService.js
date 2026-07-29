const Contract = require('../models/Contract');
const Job = require('../models/Job');
const EscrowTransaction = require('../models/EscrowTransaction');

/**
 * Escrow State Machine Service
 * Enforces valid state transitions and user role authorization
 */

/**
 * 1. Fund Escrow (Client funds contract)
 * Transition: None -> funded
 * Contract: draft -> active
 */
const fundEscrow = async (contractId, amount, clientUserId) => {
  const contract = await Contract.findById(contractId);
  if (!contract) {
    throw new Error('Contract not found');
  }

  // Authorize client
  const clientId = contract.client._id ? contract.client._id : contract.client;
  if (clientId.toString() !== clientUserId.toString()) {
    throw new Error('Unauthorized: Only the contract client can fund this escrow');
  }

  // Validate current status
  if (contract.status !== 'draft') {
    throw new Error(`Invalid contract status: cannot fund contract in "${contract.status}" status`);
  }

  // Validate amount
  if (contract.agreedAmount !== amount) {
    throw new Error(`Amount mismatch: contract requires ${contract.agreedAmount}, but received ${amount}`);
  }

  // Check if an escrow transaction already exists for this contract
  const existingTx = await EscrowTransaction.findOne({ contract: contractId });
  if (existingTx) {
    throw new Error('Escrow has already been created/funded for this contract');
  }

  // Update Contract and Job status
  contract.status = 'active';
  await contract.save();

  const jobId = contract.job._id ? contract.job._id : contract.job;
  await Job.findByIdAndUpdate(jobId, { status: 'assigned' });

  // Create Escrow Transaction
  const transaction = new EscrowTransaction({
    contract: contractId,
    amount: amount,
    heldAmount: amount,
    releasedAmount: 0,
    refundedAmount: 0,
    status: 'funded',
    fundedAt: new Date()
  });

  await transaction.save();
  return transaction;
};

/**
 * 2. Start Work (Freelancer accepts/starts work on active contract)
 * Transition: funded -> in_progress
 */
const startWork = async (transactionId, freelancerUserId) => {
  const transaction = await EscrowTransaction.findById(transactionId).populate('contract');
  if (!transaction) {
    throw new Error('Escrow transaction not found');
  }

  // Authorize freelancer
  const freelancerId = transaction.contract.freelancer._id ? transaction.contract.freelancer._id : transaction.contract.freelancer;
  if (freelancerId.toString() !== freelancerUserId.toString()) {
    throw new Error('Unauthorized: Only the assigned freelancer can start work');
  }

  // Validate state transition
  if (transaction.status !== 'funded') {
    throw new Error(`Invalid transition: cannot start work when escrow is in "${transaction.status}" status`);
  }

  // Transition state
  transaction.status = 'in_progress';
  transaction.inProgressAt = new Date();

  await transaction.save();
  return transaction;
};

/**
 * 3. Mark Work as Delivered (Freelancer marks work as delivered)
 * Transition: in_progress -> delivered
 */
const markDelivered = async (transactionId, freelancerUserId) => {
  const transaction = await EscrowTransaction.findById(transactionId).populate('contract');
  if (!transaction) {
    throw new Error('Escrow transaction not found');
  }

  // Authorize freelancer
  const freelancerId = transaction.contract.freelancer._id ? transaction.contract.freelancer._id : transaction.contract.freelancer;
  if (freelancerId.toString() !== freelancerUserId.toString()) {
    throw new Error('Unauthorized: Only the assigned freelancer can deliver work');
  }

  // Validate state transition
  if (transaction.status !== 'in_progress') {
    throw new Error(`Invalid transition: cannot mark work as delivered when escrow is in "${transaction.status}" status`);
  }

  // Transition state
  transaction.status = 'delivered';
  transaction.deliveredAt = new Date();

  await transaction.save();
  return transaction;
};

/**
 * 4. Approve Escrow (Client approves delivery, releasing funds to freelancer)
 * Transition: delivered -> released
 * Contract: active -> completed
 * Job: assigned -> completed
 */
const approveEscrow = async (transactionId, clientUserId) => {
  const transaction = await EscrowTransaction.findById(transactionId).populate('contract');
  if (!transaction) {
    throw new Error('Escrow transaction not found');
  }

  // Authorize client
  const clientId = transaction.contract.client._id ? transaction.contract.client._id : transaction.contract.client;
  if (clientId.toString() !== clientUserId.toString()) {
    throw new Error('Unauthorized: Only the client can approve this escrow release');
  }

  // Validate state transition
  if (transaction.status !== 'delivered') {
    throw new Error(`Invalid transition: cannot approve escrow when in "${transaction.status}" status. Work must be delivered first.`);
  }

  // Transition state and update balances
  transaction.status = 'released';
  transaction.releasedAmount = transaction.amount;
  transaction.heldAmount = 0;
  transaction.releasedAt = new Date();

  await transaction.save();

  // Update Contract and Job status
  const contract = await Contract.findById(transaction.contract._id);
  if (contract) {
    contract.status = 'completed';
    await contract.save();

    const jobId = contract.job._id ? contract.job._id : contract.job;
    await Job.findByIdAndUpdate(jobId, { status: 'completed' });
  }

  return transaction;
};

/**
 * 5. Dispute Escrow (Client disputes the delivery)
 * Transition: delivered -> disputed
 */
const disputeEscrow = async (transactionId, userId) => {
  const transaction = await EscrowTransaction.findById(transactionId).populate('contract');
  if (!transaction) {
    throw new Error('Escrow transaction not found');
  }

  // Authorize client or freelancer
  const clientId = transaction.contract.client._id ? transaction.contract.client._id : transaction.contract.client;
  const freelancerId = transaction.contract.freelancer._id ? transaction.contract.freelancer._id : transaction.contract.freelancer;
  
  if (clientId.toString() !== userId.toString() && freelancerId.toString() !== userId.toString()) {
    throw new Error('Unauthorized: Only contract participants can dispute this escrow');
  }

  // Validate state transition
  if (transaction.status !== 'delivered') {
    throw new Error(`Invalid transition: cannot dispute escrow when in "${transaction.status}" status. Work must be delivered first.`);
  }

  // If the freelancer is disputing, enforce the 7-day restriction
  if (freelancerId.toString() === userId.toString()) {
    const deliveredAt = new Date(transaction.deliveredAt);
    const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
    const elapsed = Date.now() - deliveredAt.getTime();
    if (elapsed < sevenDaysInMs) {
      const remainingMs = sevenDaysInMs - elapsed;
      const days = Math.floor(remainingMs / (24 * 60 * 60 * 1000));
      const hours = Math.floor((remainingMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
      const mins = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
      
      let timeRemainingStr = '';
      if (days > 0) {
        timeRemainingStr = `${days}d ${hours}h`;
      } else if (hours > 0) {
        timeRemainingStr = `${hours}h ${mins}m`;
      } else {
        timeRemainingStr = `${mins}m`;
      }
      throw new Error(`Unauthorized: Freelancer can only file for arbitration 7 days after delivery. Please wait ${timeRemainingStr} more.`);
    }
  }

  // Transition state
  transaction.status = 'disputed';
  transaction.disputedAt = new Date();

  await transaction.save();
  return transaction;
};

/**
 * 6. Resolve Dispute (Admin resolves the dispute, releasing to freelancer or refunding to client)
 * Transition: disputed -> released OR disputed -> refunded
 */
const resolveDispute = async (transactionId, action, adminUserId, adminRole) => {
  // Authorize admin
  if (adminRole !== 'admin') {
    throw new Error('Unauthorized: Only administrators can resolve disputes');
  }

  const transaction = await EscrowTransaction.findById(transactionId).populate('contract');
  if (!transaction) {
    throw new Error('Escrow transaction not found');
  }

  // Validate state transition
  if (transaction.status !== 'disputed') {
    throw new Error(`Invalid transition: cannot resolve dispute when escrow is in "${transaction.status}" status`);
  }

  if (action === 'release') {
    // Release funds to freelancer
    transaction.status = 'released';
    transaction.releasedAmount = transaction.amount;
    transaction.heldAmount = 0;
    transaction.releasedAt = new Date();

    await transaction.save();

    // Update contract and job
    const contract = await Contract.findById(transaction.contract._id);
    if (contract) {
      contract.status = 'completed';
      await contract.save();
      const jobId = contract.job._id ? contract.job._id : contract.job;
      await Job.findByIdAndUpdate(jobId, { status: 'completed' });
    }
  } else if (action === 'refund') {
    // Refund funds to client
    transaction.status = 'refunded';
    transaction.refundedAmount = transaction.amount;
    transaction.heldAmount = 0;
    transaction.refundedAt = new Date();

    await transaction.save();

    // Cancel contract and reopen job
    const contract = await Contract.findById(transaction.contract._id);
    if (contract) {
      contract.status = 'cancelled';
      await contract.save();
      const jobId = contract.job._id ? contract.job._id : contract.job;
      await Job.findByIdAndUpdate(jobId, { status: 'open' });
    }
  } else {
    throw new Error('Invalid resolution action: must be "release" or "refund"');
  }

  return transaction;
};

/**
 * 7. Refund Overdue Escrow (Client refunds their money if the contract deadline has passed)
 * Transition: funded/in_progress/delivered/disputed -> refunded
 * Contract: active -> cancelled
 * Job: assigned -> open
 */
const refundOverdueEscrow = async (transactionId, clientUserId) => {
  const transaction = await EscrowTransaction.findById(transactionId).populate('contract');
  if (!transaction) {
    throw new Error('Escrow transaction not found');
  }

  // Authorize client
  const clientId = transaction.contract.client._id ? transaction.contract.client._id : transaction.contract.client;
  if (clientId.toString() !== clientUserId.toString()) {
    throw new Error('Unauthorized: Only the contract client can request an overdue refund');
  }

  // Check if contract has a deadline
  if (!transaction.contract.deadline) {
    throw new Error('This contract does not have a deadline');
  }

  // Check if the deadline has passed
  const deadlineDate = new Date(transaction.contract.deadline);
  if (Date.now() < deadlineDate.getTime()) {
    throw new Error('Contract deadline has not passed yet');
  }

  // Check transaction status - must be in a state where funds are held (funded, in_progress, delivered, disputed)
  if (!['funded', 'in_progress', 'delivered', 'disputed'].includes(transaction.status)) {
    throw new Error(`Invalid transition: cannot refund escrow when in "${transaction.status}" status`);
  }

  // Transition state and update balances
  transaction.status = 'refunded';
  transaction.refundedAmount = transaction.amount;
  transaction.heldAmount = 0;
  transaction.refundedAt = new Date();

  await transaction.save();

  // Cancel contract and reopen job
  const contract = await Contract.findById(transaction.contract._id);
  if (contract) {
    contract.status = 'cancelled';
    await contract.save();

    const jobId = contract.job._id ? contract.job._id : contract.job;
    await Job.findByIdAndUpdate(jobId, { status: 'open' });
  }

  return transaction;
};

module.exports = {
  fundEscrow,
  startWork,
  markDelivered,
  approveEscrow,
  disputeEscrow,
  resolveDispute,
  refundOverdueEscrow
};
