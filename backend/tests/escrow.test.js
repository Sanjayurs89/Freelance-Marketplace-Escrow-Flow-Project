const { clearDb, db } = require('./dbMock');

// Register mocks before importing service/models
jest.mock('../models/User', () => require('./dbMock').UserMock);
jest.mock('../models/Job', () => require('./dbMock').JobMock);
jest.mock('../models/Contract', () => require('./dbMock').ContractMock);
jest.mock('../models/EscrowTransaction', () => require('./dbMock').EscrowTransactionMock);

jest.mock('mongoose', () => {
  return {
    connect: jest.fn().mockResolvedValue(true),
    connection: {
      close: jest.fn().mockResolvedValue(true)
    }
  };
});

const User = require('../models/User');
const Job = require('../models/Job');
const Contract = require('../models/Contract');
const EscrowTransaction = require('../models/EscrowTransaction');
const escrowService = require('../services/escrowService');

describe('Escrow State Machine Unit Tests', () => {
  let clientUser, freelancerUser, adminUser;
  let job, contract;

  beforeEach(async () => {
    clearDb();

    // Setup actors using User mock
    clientUser = await User.create({
      name: 'Client Harry',
      email: 'client@test.com',
      password: 'password123',
      role: 'client'
    });

    freelancerUser = await User.create({
      name: 'Freelancer Dev',
      email: 'freelancer@test.com',
      password: 'password123',
      role: 'freelancer'
    });

    adminUser = await User.create({
      name: 'Admin Moderator',
      email: 'admin@test.com',
      password: 'password123',
      role: 'admin'
    });

    // Setup job & contract
    job = await Job.create({
      title: 'Design API Logo',
      description: 'Create a logo',
      budget: 500,
      postedBy: clientUser._id
    });

    contract = await Contract.create({
      job: job._id,
      client: clientUser._id,
      freelancer: freelancerUser._id,
      agreedAmount: 500,
      status: 'draft'
    });
  });

  const assertInvariant = (tx) => {
    const total = tx.releasedAmount + tx.refundedAmount + tx.heldAmount;
    expect(tx.amount).toBeCloseTo(total, 3);
  };

  test('Happy Path: Complete transition cycle from Funded to Released', async () => {
    // 1. Client Funds Escrow
    const fundedTx = await escrowService.fundEscrow(contract._id, 500, clientUser._id);
    expect(fundedTx.status).toBe('funded');
    expect(fundedTx.heldAmount).toBe(500);
    expect(fundedTx.releasedAmount).toBe(0);
    expect(fundedTx.refundedAmount).toBe(0);
    assertInvariant(fundedTx);

    // Verify Contract/Job statuses
    const updatedContract = await Contract.findById(contract._id);
    expect(updatedContract.status).toBe('active');
    const updatedJob = await Job.findById(job._id);
    expect(updatedJob.status).toBe('assigned');

    // 2. Freelancer Starts Work
    const inProgressTx = await escrowService.startWork(fundedTx._id, freelancerUser._id);
    expect(inProgressTx.status).toBe('in_progress');
    expect(inProgressTx.inProgressAt).toBeDefined();
    assertInvariant(inProgressTx);

    // 3. Freelancer Marks Delivered
    const deliveredTx = await escrowService.markDelivered(inProgressTx._id, freelancerUser._id);
    expect(deliveredTx.status).toBe('delivered');
    expect(deliveredTx.deliveredAt).toBeDefined();
    assertInvariant(deliveredTx);

    // 4. Client Approves Work
    const releasedTx = await escrowService.approveEscrow(deliveredTx._id, clientUser._id);
    expect(releasedTx.status).toBe('released');
    expect(releasedTx.heldAmount).toBe(0);
    expect(releasedTx.releasedAmount).toBe(500);
    expect(releasedTx.refundedAmount).toBe(0);
    expect(releasedTx.releasedAt).toBeDefined();
    assertInvariant(releasedTx);

    // Verify terminal contract and job states
    const finalContract = await Contract.findById(contract._id);
    expect(finalContract.status).toBe('completed');
    const finalJob = await Job.findById(job._id);
    expect(finalJob.status).toBe('completed');
  });

  test('Dispute and Refund Path: Admin resolves dispute in favor of Client', async () => {
    // Fund -> Start -> Deliver
    const tx1 = await escrowService.fundEscrow(contract._id, 500, clientUser._id);
    const tx2 = await escrowService.startWork(tx1._id, freelancerUser._id);
    const tx3 = await escrowService.markDelivered(tx2._id, freelancerUser._id);

    // Client disputes
    const disputedTx = await escrowService.disputeEscrow(tx3._id, clientUser._id);
    expect(disputedTx.status).toBe('disputed');
    expect(disputedTx.disputedAt).toBeDefined();
    assertInvariant(disputedTx);

    // Admin resolves dispute and refunds client
    const refundedTx = await escrowService.resolveDispute(disputedTx._id, 'refund', adminUser._id, adminUser.role);
    expect(refundedTx.status).toBe('refunded');
    expect(refundedTx.heldAmount).toBe(0);
    expect(refundedTx.releasedAmount).toBe(0);
    expect(refundedTx.refundedAmount).toBe(500);
    expect(refundedTx.refundedAt).toBeDefined();
    assertInvariant(refundedTx);

    // Verify contract is cancelled and job reopened
    const finalContract = await Contract.findById(contract._id);
    expect(finalContract.status).toBe('cancelled');
    const finalJob = await Job.findById(job._id);
    expect(finalJob.status).toBe('open');
  });

  test('Dispute and Release Path: Admin resolves dispute in favor of Freelancer', async () => {
    const tx1 = await escrowService.fundEscrow(contract._id, 500, clientUser._id);
    const tx2 = await escrowService.startWork(tx1._id, freelancerUser._id);
    const tx3 = await escrowService.markDelivered(tx2._id, freelancerUser._id);
    const disputedTx = await escrowService.disputeEscrow(tx3._id, clientUser._id);

    // Admin resolves dispute by releasing funds
    const resolvedTx = await escrowService.resolveDispute(disputedTx._id, 'release', adminUser._id, adminUser.role);
    expect(resolvedTx.status).toBe('released');
    expect(resolvedTx.heldAmount).toBe(0);
    expect(resolvedTx.releasedAmount).toBe(500);
    expect(resolvedTx.refundedAmount).toBe(0);
    assertInvariant(resolvedTx);

    // Verify contract is completed
    const finalContract = await Contract.findById(contract._id);
    expect(finalContract.status).toBe('completed');
  });

  test('Validation: Reject unauthorized user transitions', async () => {
    const tx1 = await escrowService.fundEscrow(contract._id, 500, clientUser._id);

    // Freelancer tries to fund (client action)
    await expect(
      escrowService.fundEscrow(contract._id, 500, freelancerUser._id)
    ).rejects.toThrow();

    // Client tries to start work (freelancer action)
    await expect(
      escrowService.startWork(tx1._id, clientUser._id)
    ).rejects.toThrow();

    const tx2 = await escrowService.startWork(tx1._id, freelancerUser._id);

    // Client tries to deliver work (freelancer action)
    await expect(
      escrowService.markDelivered(tx2._id, clientUser._id)
    ).rejects.toThrow();
  });

  test('Validation: Reject invalid state transition sequences', async () => {
    const tx1 = await escrowService.fundEscrow(contract._id, 500, clientUser._id);

    // Cannot deliver before starting work
    await expect(
      escrowService.markDelivered(tx1._id, freelancerUser._id)
    ).rejects.toThrow();

    // Cannot approve before work is marked delivered
    await expect(
      escrowService.approveEscrow(tx1._id, clientUser._id)
    ).rejects.toThrow();

    const tx2 = await escrowService.startWork(tx1._id, freelancerUser._id);

    // Cannot dispute before work is delivered
    await expect(
      escrowService.disputeEscrow(tx2._id, clientUser._id)
    ).rejects.toThrow();
  });

  test('Critical Invariant: Pre-save hook enforces funded = released + refunded + held', async () => {
    const tx = await escrowService.fundEscrow(contract._id, 500, clientUser._id);

    // Violate the invariant manually
    tx.heldAmount = 400; // Total is now 400 instead of 500

    await expect(tx.save()).rejects.toThrow('Invariant violation');
  });

  test('Freelancer Dispute: 7-day restriction checks', async () => {
    // Fund -> Start -> Deliver
    const tx1 = await escrowService.fundEscrow(contract._id, 500, clientUser._id);
    const tx2 = await escrowService.startWork(tx1._id, freelancerUser._id);
    const tx3 = await escrowService.markDelivered(tx2._id, freelancerUser._id);

    // 1. Freelancer tries to dispute immediately -> should fail
    await expect(
      escrowService.disputeEscrow(tx3._id, freelancerUser._id)
    ).rejects.toThrow(/arbitration/i);

    // 2. Client disputes immediately -> should succeed
    const clientDisputedTx = await escrowService.disputeEscrow(tx3._id, clientUser._id);
    expect(clientDisputedTx.status).toBe('disputed');
  });

  test('Freelancer Dispute: allowed after 7 days', async () => {
    const tx1 = await escrowService.fundEscrow(contract._id, 500, clientUser._id);
    const tx2 = await escrowService.startWork(tx1._id, freelancerUser._id);
    const tx3 = await escrowService.markDelivered(tx2._id, freelancerUser._id);

    // Manually set deliveredAt to 7.5 days ago and save
    tx3.deliveredAt = new Date(Date.now() - 7.5 * 24 * 60 * 60 * 1000);
    await tx3.save();

    // Freelancer disputes -> should succeed now
    const freelancerDisputedTx = await escrowService.disputeEscrow(tx3._id, freelancerUser._id);
    expect(freelancerDisputedTx.status).toBe('disputed');
    expect(freelancerDisputedTx.disputedAt).toBeDefined();
  });

  test('Refund Overdue: refund client money after contract deadline passes', async () => {
    // 1. Client funds contract, set deadline to past
    const fundedTx = await escrowService.fundEscrow(contract._id, 500, clientUser._id);
    
    // Set contract deadline to 1 hour ago
    contract.deadline = new Date(Date.now() - 60 * 60 * 1000);
    await contract.save();

    // 2. Freelancer starts work
    await escrowService.startWork(fundedTx._id, freelancerUser._id);

    // 3. Client claims refund for overdue contract
    const refundedTx = await escrowService.refundOverdueEscrow(fundedTx._id, clientUser._id);
    expect(refundedTx.status).toBe('refunded');
    expect(refundedTx.refundedAmount).toBe(500);
    expect(refundedTx.heldAmount).toBe(0);
    expect(refundedTx.refundedAt).toBeDefined();

    // Verify contract and job states
    const finalContract = await Contract.findById(contract._id);
    expect(finalContract.status).toBe('cancelled');
    const finalJob = await Job.findById(job._id);
    expect(finalJob.status).toBe('open');
  });

  test('Refund Overdue: fails if deadline has not passed', async () => {
    const fundedTx = await escrowService.fundEscrow(contract._id, 500, clientUser._id);
    
    // Set contract deadline to 1 hour in the future
    contract.deadline = new Date(Date.now() + 60 * 60 * 1000);
    await contract.save();

    await expect(
      escrowService.refundOverdueEscrow(fundedTx._id, clientUser._id)
    ).rejects.toThrow(/deadline has not passed/i);
  });

  test('Refund Overdue: fails if unauthorized user triggers it', async () => {
    const fundedTx = await escrowService.fundEscrow(contract._id, 500, clientUser._id);
    contract.deadline = new Date(Date.now() - 60 * 60 * 1000);
    await contract.save();

    await expect(
      escrowService.refundOverdueEscrow(fundedTx._id, freelancerUser._id)
    ).rejects.toThrow(/unauthorized/i);
  });
});
