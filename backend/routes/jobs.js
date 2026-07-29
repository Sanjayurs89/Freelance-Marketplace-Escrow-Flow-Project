const express = require('express');
const Job = require('../models/Job');
const JobApplication = require('../models/JobApplication');
const Contract = require('../models/Contract');
const { protect, authorize } = require('../middleware/auth');
const router = express.Router();

/**
 * @route   POST /api/jobs
 * @desc    Post a new job
 * @access  Private (Client only)
 */
router.post('/', protect, authorize('client'), async (req, res) => {
  try {
    const { title, description, budget } = req.body;

    if (!title || !description || budget === undefined) {
      return res.status(400).json({ success: false, message: 'Please provide all required fields' });
    }

    const job = await Job.create({
      title,
      description,
      budget,
      postedBy: req.user.id,
      status: 'open'
    });

    res.status(201).json({
      success: true,
      data: job
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   GET /api/jobs
 * @desc    Get all jobs (optionally filter by status, e.g. open jobs)
 * @access  Private (Authenticated)
 */
router.get('/', protect, async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) {
      filter.status = req.query.status;
    }
    
    // Sort by newest
    const jobs = await Job.find(filter)
      .populate('postedBy', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: jobs.length,
      data: jobs
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   GET /api/jobs/applications/my
 * @desc    Get current freelancer's job applications
 * @access  Private (Freelancer only)
 */
router.get('/applications/my', protect, authorize('freelancer'), async (req, res) => {
  try {
    const applications = await JobApplication.find({ freelancer: req.user.id })
      .populate({
        path: 'job',
        populate: {
          path: 'postedBy',
          select: 'name email'
        }
      })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: applications.length,
      data: applications
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   GET /api/jobs/:id
 * @desc    Get single job by ID
 * @access  Private (Authenticated)
 */
router.get('/:id', protect, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id).populate('postedBy', 'name email');
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }
    res.status(200).json({
      success: true,
      data: job
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   POST /api/jobs/:id/apply
 * @desc    Apply/bid on an open job
 * @access  Private (Freelancer only)
 */
router.post('/:id/apply', protect, authorize('freelancer'), async (req, res) => {
  try {
    const { bidAmount, coverLetter } = req.body;
    if (bidAmount === undefined || !coverLetter) {
      return res.status(400).json({ success: false, message: 'Please provide a bid amount and cover letter' });
    }

    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    if (job.status !== 'open') {
      return res.status(400).json({ success: false, message: 'Applications are closed for this job' });
    }

    // Check if already applied
    const alreadyApplied = await JobApplication.findOne({ job: req.params.id, freelancer: req.user.id });
    if (alreadyApplied) {
      return res.status(400).json({ success: false, message: 'You have already applied for this job' });
    }

    const application = await JobApplication.create({
      job: req.params.id,
      freelancer: req.user.id,
      bidAmount,
      coverLetter
    });

    res.status(201).json({
      success: true,
      message: 'Application submitted successfully',
      data: application
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   GET /api/jobs/:id/applications
 * @desc    Get all applications/bids for a job
 * @access  Private (Client only - owner of the job)
 */
router.get('/:id/applications', protect, authorize('client'), async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    // Verify client ownership
    if (job.postedBy.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized: You can only view applications for your own posted jobs' });
    }

    const applications = await JobApplication.find({ job: req.params.id })
      .populate('freelancer', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: applications.length,
      data: applications
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   POST /api/jobs/applications/:id/accept
 * @desc    Accept freelancer's application and create draft contract
 * @access  Private (Client only - job owner)
 */
router.post('/applications/:id/accept', protect, authorize('client'), async (req, res) => {
  try {
    const application = await JobApplication.findById(req.params.id).populate('job');
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    const job = application.job;
    if (!job) {
      return res.status(404).json({ success: false, message: 'Associated job not found' });
    }

    // Verify ownership of the job
    if (job.postedBy.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized: You can only accept applications for your own posted jobs' });
    }

    if (job.status !== 'open') {
      return res.status(400).json({ success: false, message: `Cannot accept application: job status is currently "${job.status}"` });
    }

    // Check if a contract already exists for this job
    const existingContract = await Contract.findOne({ job: job._id, status: { $ne: 'cancelled' } });
    if (existingContract) {
      return res.status(400).json({ success: false, message: 'A contract already exists for this job' });
    }

    const { deadline } = req.body;

    if (deadline && new Date(deadline).getTime() < Date.now()) {
      return res.status(400).json({ success: false, message: 'Contract deadline cannot be in the past' });
    }

    // 1. Update application status
    application.status = 'accepted';
    await application.save();

    // 2. Reject all other applications for this job
    await JobApplication.updateMany(
      { job: job._id, _id: { $ne: application._id } },
      { status: 'rejected' }
    );

    // 3. Update job status to assigned
    job.status = 'assigned';
    await job.save();

    // 4. Create draft contract
    const contract = await Contract.create({
      job: job._id,
      client: req.user.id,
      freelancer: application.freelancer,
      agreedAmount: application.bidAmount,
      deadline: deadline ? new Date(deadline) : undefined,
      status: 'draft'
    });

    res.status(200).json({
      success: true,
      message: 'Application accepted and draft contract created',
      data: {
        application,
        contract
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   POST /api/jobs/applications/:id/reject
 * @desc    Reject freelancer's application
 * @access  Private (Client only - job owner)
 */
router.post('/applications/:id/reject', protect, authorize('client'), async (req, res) => {
  try {
    const application = await JobApplication.findById(req.params.id).populate('job');
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    const job = application.job;
    if (!job) {
      return res.status(404).json({ success: false, message: 'Associated job not found' });
    }

    // Verify ownership
    if (job.postedBy.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized: You can only reject applications for your own jobs' });
    }

    if (application.status !== 'pending') {
      return res.status(400).json({ success: false, message: `Application is already in "${application.status}" state` });
    }

    application.status = 'rejected';
    await application.save();

    res.status(200).json({
      success: true,
      message: 'Application rejected successfully',
      data: application
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;

