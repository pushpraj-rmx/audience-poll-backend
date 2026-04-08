const express = require('express')
const { protect } = require('../middlewares/auth')
const {
  getAllAdmins,
  alladmin,
  getAdminsBySeason,
  adminRevote,
  adminResetAudienceVotes,
  swapVoteVoterDetails,
  ensureRenuAnubhavSwap,
} = require('../controllers/admin.controller')
const {
  getMostTalentedChapterScores,
  getMostTalentedChapterSnapshot,
  saveMostTalentedChapterSnapshot,
} = require('../controllers/mostTalentedChapter.controller')
const router = express.Router()


router.get('/getAllAdmins',protect(["super_admin","admin"]), getAllAdmins)
router.get('/',protect(["super_admin"]),alladmin)
router.get('/getAdminsBySeason/:seasonId', getAdminsBySeason)

// Phase 1 (revote): skeleton endpoint + auth + input validation.
router.post('/revote', protect(["super_admin", "admin"]), adminRevote)

// Option A (bulk reset): reset audience votes for a participant+round.
router.post('/reset-audience-votes', protect(["super_admin", "admin"]), adminResetAudienceVotes)

router.post(
  '/swap-vote-voter-details',
  protect(["super_admin", "admin"]),
  swapVoteVoterDetails,
)

router.post(
  '/ensure-renu-anubhav-swap',
  protect(["super_admin", "admin"]),
  ensureRenuAnubhavSwap,
)

// Most Talented Chapter — specific paths before generic :seasonId
router.get(
  '/most-talented-chapter/:seasonId/snapshot',
  protect(["super_admin", "admin"]),
  getMostTalentedChapterSnapshot,
)
router.post(
  '/most-talented-chapter/:seasonId/snapshot',
  protect(["super_admin", "admin"]),
  saveMostTalentedChapterSnapshot,
)
router.get(
  '/most-talented-chapter/:seasonId',
  protect(["super_admin", "admin"]),
  getMostTalentedChapterScores,
)

module.exports = router