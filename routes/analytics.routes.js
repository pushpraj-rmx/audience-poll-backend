const express = require('express');
const { total, getRegistrationsByContest, getStarsPerRoundForParticipant, getVotingAnalytics, getTotalStarsByContest, getTotalVoterByContest, getScanAnalytics, getParticipantContestsWithVotes, getPointTableByContest, getSuperAdminContestAnalytics, getUserAnalytics, getParticipantSeasonsWithVotes, getPointTableBySeason, totalsForSuperAdmin, getVotesPerSeasonForParticipant, getContestSeasonStats, getParticipantVoteAnalytics, groupLeaderboard, computeGroupWinners } = require('../controllers/analytics.controller');
const { protect } = require('../middlewares/auth');
const router = express.Router();

router.get("/contest-season-stats",getContestSeasonStats)
router.get("/total-super-admin",protect(["super_admin"]), totalsForSuperAdmin)
router.get("/votes", getVotingAnalytics);
router.get("/point-table", getPointTableBySeason);
router.get("/group-leaderboard", groupLeaderboard);
router.post(
  "/compute-group-winners",
  protect(["super_admin", "admin"]),
  computeGroupWinners
);
router.get("/votes-per-contest/:seasonId", protect(["participant","super_admin","admin","sponsor","judge"]), getVotesPerSeasonForParticipant);
router.get("/participant/votes/bar-graph",protect(["participant"]),getParticipantVoteAnalytics)
router.get("/:contestId", protect(["participant","super_admin","admin","sponsor","judge"]), total);
router.get("/votes-per-round/:seasonId/:roundName", protect(["participant","super_admin","admin","sponsor","judge"]), getStarsPerRoundForParticipant);
router.get("/registrations-by-contest", getRegistrationsByContest)
router.get("/total-stars-by-contest", getTotalStarsByContest);
router.get("/total-voters-by-contest", getTotalVoterByContest);
router.get("/QrScanLogs-by-contest", getScanAnalytics);
router.get("/:userId/contests/analytics",getSuperAdminContestAnalytics);
router.get("/:userId/contests/user-analytics",getUserAnalytics);
router.get("/participant/:participantId/seasons",getParticipantSeasonsWithVotes);

module.exports = router;