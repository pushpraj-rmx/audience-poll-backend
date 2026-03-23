const express = require('express')
const { protect } = require('../middlewares/auth')
const { getAllJudges, allJudge, all_participants, getJudgesBySeason } = require('../controllers/judge.controller')
const router = express.Router()


router.get('/getAllJudges',protect(["super_admin","admin"]), getAllJudges );
router.get('/',protect(["super_admin","admin"]),allJudge)
router.get('/getJudgesBySeason/:seasonId',protect(["super_admin","admin","sponsor","judge"]),getJudgesBySeason);
router.get('/all',protect(["super_admin","admin"]),all_participants)

module.exports = router