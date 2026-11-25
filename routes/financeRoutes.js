const express = require('express');
const requireUser = require('../middleware/requireUser');
const {
  createEntry,
  deleteEntry,
  listEntries,
  updateEntry,
} = require('../controllers/financeController');

const router = express.Router();

router.use(requireUser);
router.get('/:resource', listEntries);
router.post('/:resource', createEntry);
router.put('/:resource/:id', updateEntry);
router.delete('/:resource/:id', deleteEntry);

module.exports = router;
