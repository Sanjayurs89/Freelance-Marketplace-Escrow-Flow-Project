const express = require('express');
const Contract = require('../models/Contract');
const Job = require('../models/Job');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const router = express.Router();

/**
 * @route   POST /api/contracts
 * @desc    Create a draft contract for a job (Client assign to Freelancer)
 * @access  Private (Client only)
 */
router.post('/', protect, authorize('client'), async (req, res) => {
  try {
    const { jobId, freelancerId, agreedAmount, deadline } = req.body;

    if (!jobId || !freelancerId || agreedAmount === undefined) {
      return res.status(400).json({ success: false, message: 'Please provide jobId, freelancerId, and agreedAmount' });
    }

    if (deadline && new Date(deadline).getTime() < Date.now()) {
      return res.status(400).json({ success: false, message: 'Contract deadline cannot be in the past' });
    }

    // 1. Find job and verify ownership
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    if (job.postedBy.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized: You can only create contracts for your own posted jobs' });
    }

    if (job.status !== 'open') {
      return res.status(400).json({ success: false, message: `Cannot create contract: job status is currently "${job.status}"` });
    }

    // 2. Find freelancer and verify role
    const freelancer = await User.findById(freelancerId);
    if (!freelancer || freelancer.role !== 'freelancer') {
      return res.status(400).json({ success: false, message: 'Invalid freelancer: user not found or does not have freelancer role' });
    }

    // 3. Check if contract already exists for this job
    const existingContract = await Contract.findOne({ job: jobId, status: { $ne: 'cancelled' } });
    if (existingContract) {
      return res.status(400).json({ success: false, message: 'A contract already exists for this job' });
    }

    // 4. Create draft contract
    const contract = await Contract.create({
      job: jobId,
      client: req.user.id,
      freelancer: freelancerId,
      agreedAmount,
      deadline: deadline ? new Date(deadline) : undefined,
      status: 'draft'
    });

    res.status(201).json({
      success: true,
      data: contract
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   GET /api/contracts
 * @desc    Get contracts for logged-in user (role-filtered)
 * @access  Private (Authenticated)
 */
router.get('/', protect, async (req, res) => {
  try {
    let filter = {};

    if (req.user.role === 'client') {
      filter.client = req.user.id;
    } else if (req.user.role === 'freelancer') {
      filter.freelancer = req.user.id;
    }
    // Admins can see all contracts, so filter remains empty

    const contracts = await Contract.find(filter)
      .populate('job', 'title description budget status')
      .populate('client', 'name email')
      .populate('freelancer', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: contracts.length,
      data: contracts
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   GET /api/contracts/:id
 * @desc    Get contract details
 * @access  Private (Authenticated)
 */
router.get('/:id', protect, async (req, res) => {
  try {
    const contract = await Contract.findById(req.params.id)
      .populate('job', 'title description budget status')
      .populate('client', 'name email')
      .populate('freelancer', 'name email');

    if (!contract) {
      return res.status(404).json({ success: false, message: 'Contract not found' });
    }

    // Authorization checks
    if (
      req.user.role !== 'admin' &&
      contract.client._id.toString() !== req.user.id &&
      contract.freelancer._id.toString() !== req.user.id
    ) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this contract' });
    }

    res.status(200).json({
      success: true,
      data: contract
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   POST /api/contracts/:id/extension-request
 * @desc    Freelancer asks the client to extend the deadline
 * @access  Private (Freelancer only)
 */
router.post('/:id/extension-request', protect, authorize('freelancer'), async (req, res) => {
  try {
    const { days } = req.body;
    if (!days || Number(days) <= 0) {
      return res.status(400).json({ success: false, message: 'Please provide a valid positive number of days to extend' });
    }
    if (Number(days) > 15) {
      return res.status(400).json({ success: false, message: 'Extension request cannot exceed 15 days' });
    }

    const contract = await Contract.findById(req.params.id);
    if (!contract) {
      return res.status(404).json({ success: false, message: 'Contract not found' });
    }

    // Verify user is the freelancer of this contract
    const freelancerId = contract.freelancer._id ? contract.freelancer._id : contract.freelancer;
    if (freelancerId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized: Only the contract freelancer can request an extension' });
    }

    // Verify contract is active
    if (contract.status !== 'active') {
      return res.status(400).json({ success: false, message: `Cannot request extension: Contract is currently in "${contract.status}" status` });
    }

    // Verify freelancer hasn't exceeded 1 request
    if (contract.extensionRequestsCount >= 1) {
      return res.status(400).json({ success: false, message: 'You have reached the limit of 1 extension request for this contract' });
    }

    contract.extensionRequest = {
      days: Number(days),
      status: 'pending',
      requestedAt: new Date()
    };
    contract.extensionRequestsCount = (contract.extensionRequestsCount || 0) + 1;

    await contract.save();

    res.status(200).json({
      success: true,
      message: 'Extension request submitted successfully',
      data: contract
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   POST /api/contracts/:id/extension-respond
 * @desc    Client responds to extension request (approve, reject, or modify days)
 * @access  Private (Client only)
 */
router.post('/:id/extension-respond', protect, authorize('client'), async (req, res) => {
  try {
    const { action, days } = req.body; // action: 'approve' | 'reject' | 'modify'
    if (!action || !['approve', 'reject', 'modify'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid action ("approve", "reject", or "modify")' });
    }

    const contract = await Contract.findById(req.params.id);
    if (!contract) {
      return res.status(404).json({ success: false, message: 'Contract not found' });
    }

    // Verify user is the client of this contract
    const clientId = contract.client._id ? contract.client._id : contract.client;
    if (clientId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized: Only the contract client can respond to extension requests' });
    }

    if (!contract.extensionRequest || contract.extensionRequest.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'No pending extension request found for this contract' });
    }

    if (action === 'approve') {
      // Extend deadline by requested days
      const daysToExtend = contract.extensionRequest.days;
      const currentDeadline = contract.deadline ? new Date(contract.deadline) : new Date();
      contract.deadline = new Date(currentDeadline.getTime() + daysToExtend * 24 * 60 * 60 * 1000);
      contract.extensionRequest.status = 'approved';
    } else if (action === 'modify') {
      // Modify/reduce days
      if (!days || Number(days) <= 0) {
        return res.status(400).json({ success: false, message: 'Please provide a valid positive number of days to grant' });
      }
      if (Number(days) > contract.extensionRequest.days) {
        return res.status(400).json({ success: false, message: 'You cannot grant more days than the freelancer requested' });
      }
      const daysToExtend = Number(days);
      const currentDeadline = contract.deadline ? new Date(contract.deadline) : new Date();
      contract.deadline = new Date(currentDeadline.getTime() + daysToExtend * 24 * 60 * 60 * 1000);
      contract.extensionRequest.days = daysToExtend; // Update request to reflect modified days
      contract.extensionRequest.status = 'approved';
    } else if (action === 'reject') {
      contract.extensionRequest.status = 'rejected';
    }

    await contract.save();

    res.status(200).json({
      success: true,
      message: `Extension request ${contract.extensionRequest.status} successfully`,
      data: contract
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
