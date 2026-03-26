const express = require('express')
const { protect } = require('../middlewares/auth')
const { getAllAdmins, alladmin, getAdminsBySeason, adminRevote, adminResetAudienceVotes } = require('../controllers/admin.controller')
const router = express.Router()


router.get('/getAllAdmins',protect(["super_admin","admin"]), getAllAdmins)
router.get('/',protect(["super_admin"]),alladmin)
router.get('/getAdminsBySeason/:seasonId', getAdminsBySeason)

// Phase 1 (revote): skeleton endpoint + auth + input validation.
router.post('/revote', protect(["super_admin", "admin"]), adminRevote)

// Option A (bulk reset): reset audience votes for a participant+round.
router.post('/reset-audience-votes', protect(["super_admin", "admin"]), adminResetAudienceVotes)


module.exports = router