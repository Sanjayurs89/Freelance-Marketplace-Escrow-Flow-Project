const express = require('express');
const escrowService = require('../services/escrowService');
const EscrowTransaction = require('../models/EscrowTransaction');
const { protect, authorize } = require('../middleware/auth');
const router = express.Router();

/**
 * @route   POST /api/escrow/fund
 * @desc    Fund contract escrow (Client action)
 * @access  Private (Client only)
 */
router.post('/fund', protect, authorize('client'), async (req, res) => {
  try {
    const { contractId, amount } = req.body;
    if (!contractId || amount === undefined) {
      return res.status(400).json({ success: false, message: 'Please provide contractId and amount' });
    }

    const transaction = await escrowService.fundEscrow(contractId, Number(amount), req.user.id);
    res.status(201).json({
      success: true,
      message: 'Escrow funded successfully',
      data: transaction
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * @route   POST /api/escrow/start
 * @desc    Freelancer starts work on the contract
 * @access  Private (Freelancer only)
 */
router.post('/start', protect, authorize('freelancer'), async (req, res) => {
  try {
    const { transactionId } = req.body;
    if (!transactionId) {
      return res.status(400).json({ success: false, message: 'Please provide transactionId' });
    }

    const transaction = await escrowService.startWork(transactionId, req.user.id);
    res.status(200).json({
      success: true,
      message: 'Work started successfully',
      data: transaction
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * @route   POST /api/escrow/deliver
 * @desc    Freelancer marks work as delivered
 * @access  Private (Freelancer only)
 */
router.post('/deliver', protect, authorize('freelancer'), async (req, res) => {
  try {
    const { transactionId } = req.body;
    if (!transactionId) {
      return res.status(400).json({ success: false, message: 'Please provide transactionId' });
    }

    const transaction = await escrowService.markDelivered(transactionId, req.user.id);
    res.status(200).json({
      success: true,
      message: 'Work marked as delivered successfully',
      data: transaction
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * @route   POST /api/escrow/approve
 * @desc    Approve delivery and release funds to freelancer (Client action)
 * @access  Private (Client only)
 */
router.post('/approve', protect, authorize('client'), async (req, res) => {
  try {
    const { transactionId } = req.body;
    if (!transactionId) {
      return res.status(400).json({ success: false, message: 'Please provide transactionId' });
    }

    const transaction = await escrowService.approveEscrow(transactionId, req.user.id);
    res.status(200).json({
      success: true,
      message: 'Escrow approved and funds released successfully',
      data: transaction
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * @route   POST /api/escrow/dispute
 * @desc    Dispute the delivery (Client or Freelancer action)
 * @access  Private (Client or Freelancer)
 */
router.post('/dispute', protect, authorize('client', 'freelancer'), async (req, res) => {
  try {
    const { transactionId } = req.body;
    if (!transactionId) {
      return res.status(400).json({ success: false, message: 'Please provide transactionId' });
    }

    const transaction = await escrowService.disputeEscrow(transactionId, req.user.id);
    res.status(200).json({
      success: true,
      message: 'Escrow disputed successfully',
      data: transaction
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * @route   POST /api/escrow/resolve
 * @desc    Resolve a dispute (Admin action)
 * @access  Private (Admin only)
 */
router.post('/resolve', protect, authorize('admin'), async (req, res) => {
  try {
    const { transactionId, action } = req.body;
    if (!transactionId || !action) {
      return res.status(400).json({ success: false, message: 'Please provide transactionId and action ("release" or "refund")' });
    }

    const transaction = await escrowService.resolveDispute(transactionId, action, req.user.id, req.user.role);
    res.status(200).json({
      success: true,
      message: `Dispute resolved successfully with action: ${action}`,
      data: transaction
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * @route   GET /api/escrow/contract/:contractId
 * @desc    Get escrow transaction by contract ID
 * @access  Private (Authenticated)
 */
router.get('/contract/:contractId', protect, async (req, res) => {
  try {
    const transaction = await EscrowTransaction.findOne({ contract: req.params.contractId }).populate('contract');
    if (!transaction) {
      return res.status(404).json({ success: false, message: 'No escrow transaction found for this contract' });
    }

    // Check auth
    if (
      req.user.role !== 'admin' &&
      transaction.contract.client.toString() !== req.user.id &&
      transaction.contract.freelancer.toString() !== req.user.id
    ) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this transaction' });
    }

    res.status(200).json({
      success: true,
      data: transaction
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   POST /api/escrow/refund-overdue
 * @desc    Refund client's money if the contract deadline has passed
 * @access  Private (Client only)
 */
router.post('/refund-overdue', protect, authorize('client'), async (req, res) => {
  try {
    const { transactionId } = req.body;
    if (!transactionId) {
      return res.status(400).json({ success: false, message: 'Please provide transactionId' });
    }

    const transaction = await escrowService.refundOverdueEscrow(transactionId, req.user.id);
    res.status(200).json({
      success: true,
      message: 'Escrow refunded successfully due to overdue deadline',
      data: transaction
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

module.exports = router;
