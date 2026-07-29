const { clearDb, db } = require('./dbMock');

// Mock models and config before requiring the server
jest.mock('../models/User', () => require('./dbMock').UserMock);
jest.mock('../models/Job', () => require('./dbMock').JobMock);
jest.mock('../models/Contract', () => require('./dbMock').ContractMock);
jest.mock('../models/EscrowTransaction', () => require('./dbMock').EscrowTransactionMock);

jest.mock('../config/db', () => {
  return jest.fn().mockImplementation(() => {
    console.log('Mock DB connected');
    return Promise.resolve();
  });
});

const request = require('supertest');
const { app, server } = require('../server');

describe('REST API Integration Tests', () => {
  let clientToken, freelancerToken, adminToken;
  let client, freelancer, admin;
  let job, contract;

  afterAll(async () => {
    // Close Express HTTP server
    await server.close();
  });

  beforeEach(async () => {
    clearDb();

    // 1. Create client and get JWT token
    const clientRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Client API',
        email: 'client_api@test.com',
        password: 'password123',
        role: 'client'
      });
    clientToken = clientRes.body.data.token;
    client = clientRes.body.data;

    // 2. Create freelancer and get JWT token
    const freelancerRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Freelancer API',
        email: 'freelancer_api@test.com',
        password: 'password123',
        role: 'freelancer'
      });
    freelancerToken = freelancerRes.body.data.token;
    freelancer = freelancerRes.body.data;

    // 3. Create admin and get JWT token
    const adminRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Admin API',
        email: 'admin_api@test.com',
        password: 'password123',
        role: 'admin'
      });
    adminToken = adminRes.body.data.token;
    admin = adminRes.body.data;

    // 4. Create an initial job (posted by client)
    const jobRes = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        title: 'Build Integration Tests',
        description: 'Implement backend supertest tests',
        budget: 600
      });
    job = jobRes.body.data;

    // 5. Create draft contract (client assigning to freelancer)
    const contractRes = await request(app)
      .post('/api/contracts')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        jobId: job._id,
        freelancerId: freelancer._id,
        agreedAmount: 600
      });
    contract = contractRes.body.data;
  });

  test('Auth Flow: Register and Login user successfully', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'client_api@test.com',
        password: 'password123'
      });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.success).toBe(true);
    expect(loginRes.body.data.token).toBeDefined();
  });

  test('Job Flow: Client can post a job, freelancer cannot', async () => {
    // 1. Client post job
    const res1 = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        title: 'New Client Job',
        description: 'Test job posting',
        budget: 200
      });
    expect(res1.status).toBe(201);
    expect(res1.body.success).toBe(true);

    // 2. Freelancer try to post job (should get 403 Forbidden)
    const res2 = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({
        title: 'Freelancer Job Post',
        description: 'Forbidden job posting',
        budget: 200
      });
    expect(res2.status).toBe(403);
    expect(res2.body.success).toBe(false);
  });

  test('Escrow Flow: Full API interaction sequence', async () => {
    // 1. Client Funds Escrow
    const fundRes = await request(app)
      .post('/api/escrow/fund')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        contractId: contract._id,
        amount: 600
      });
    expect(fundRes.status).toBe(201);
    expect(fundRes.body.success).toBe(true);
    expect(fundRes.body.data.status).toBe('funded');
    const txId = fundRes.body.data._id;

    // 2. Freelancer Starts Work
    const startRes = await request(app)
      .post('/api/escrow/start')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ transactionId: txId });
    expect(startRes.status).toBe(200);
    expect(startRes.body.data.status).toBe('in_progress');

    // 3. Freelancer Marks Delivered
    const deliverRes = await request(app)
      .post('/api/escrow/deliver')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ transactionId: txId });
    expect(deliverRes.status).toBe(200);
    expect(deliverRes.body.data.status).toBe('delivered');

    // 4. Client Approves Work (Releases Escrow)
    const approveRes = await request(app)
      .post('/api/escrow/approve')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ transactionId: txId });
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.status).toBe('released');
    expect(approveRes.body.data.releasedAmount).toBe(600);
    expect(approveRes.body.data.heldAmount).toBe(0);
  });

  test('Dispute Flow: Client disputes delivery, Admin resolves dispute', async () => {
    // Setup: Fund -> Start -> Deliver
    const fund = await request(app)
      .post('/api/escrow/fund')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ contractId: contract._id, amount: 600 });
    const txId = fund.body.data._id;

    await request(app)
      .post('/api/escrow/start')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ transactionId: txId });

    await request(app)
      .post('/api/escrow/deliver')
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ transactionId: txId });

    // 1. Client disputes delivery
    const disputeRes = await request(app)
      .post('/api/escrow/dispute')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ transactionId: txId });
    expect(disputeRes.status).toBe(200);
    expect(disputeRes.body.data.status).toBe('disputed');

    // 2. Admin resolves dispute by refunding client
    const resolveRes = await request(app)
      .post('/api/escrow/resolve')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        transactionId: txId,
        action: 'refund'
      });
    expect(resolveRes.status).toBe(200);
    expect(resolveRes.body.data.status).toBe('refunded');
    expect(resolveRes.body.data.refundedAmount).toBe(600);
    expect(resolveRes.body.data.heldAmount).toBe(0);
  });

  test('Extension Flow: Freelancer can request extension, Client can respond/modify/approve', async () => {
    // 1. Client funds contract to make it active (extension requests require active contract)
    const fund = await request(app)
      .post('/api/escrow/fund')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ contractId: contract._id, amount: 600 });
    expect(fund.status).toBe(201);

    // 2. Freelancer requests 10-day extension
    const extensionReq = await request(app)
      .post(`/api/contracts/${contract._id}/extension-request`)
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ days: 10 });
    expect(extensionReq.status).toBe(200);
    expect(extensionReq.body.data.extensionRequest.days).toBe(10);
    expect(extensionReq.body.data.extensionRequest.status).toBe('pending');

    // 3. Client responds by modifying/reducing days to 5
    const extensionRespond = await request(app)
      .post(`/api/contracts/${contract._id}/extension-respond`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ action: 'modify', days: 5 });
    expect(extensionRespond.status).toBe(200);
    expect(extensionRespond.body.data.extensionRequest.days).toBe(5);
    expect(extensionRespond.body.data.extensionRequest.status).toBe('approved');
    expect(extensionRespond.body.data.deadline).toBeDefined();
  });

  test('Deadline Validation: cannot create contract with past deadline date', async () => {
    // Attempt draft contract creation with past date (e.g. yesterday)
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const res = await request(app)
      .post('/api/contracts')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        jobId: job._id,
        freelancerId: freelancer._id,
        agreedAmount: 600,
        deadline: pastDate
      });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/cannot be in the past/i);
  });

  test('Extension Limit: freelancer cannot request more than 1 extension', async () => {
    // Setup active contract
    await request(app)
      .post('/api/escrow/fund')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ contractId: contract._id, amount: 600 });

    // Request 1
    const res1 = await request(app)
      .post(`/api/contracts/${contract._id}/extension-request`)
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ days: 5 });
    expect(res1.status).toBe(200);

    // Client resolves to approve or reject request so they can ask again
    await request(app)
      .post(`/api/contracts/${contract._id}/extension-respond`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ action: 'approve' });

    // Request 2 (should be blocked)
    const res2 = await request(app)
      .post(`/api/contracts/${contract._id}/extension-request`)
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ days: 5 });
    expect(res2.status).toBe(400);
    expect(res2.body.message).toMatch(/limit of 1/i);
  });

  test('Extension Days Validation: freelancer cannot request more than 15 days extension', async () => {
    // Setup active contract is already done or we can do it if needed (but DB is in memory and reset per suite or contract is shared)
    // Request with 16 days
    const res = await request(app)
      .post(`/api/contracts/${contract._id}/extension-request`)
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ days: 16 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/cannot exceed 15 days/i);
  });
});
