const express = require("express");
const {
  castVote,
  submitAudienceInfo,
  getLiveVotes,
  getTotalStars,
  getBucketTotals,
  voterInfo,
  submitVoterInfo,
  getExistingVoterDetails,
  submitFinalVote,
} = require("../controllers/vote.controller");
const router = express.Router();

router.post("/submit-info", submitVoterInfo);
router.post("/submit", submitAudienceInfo);
router.post("/submit-final", submitFinalVote);
router.post("/castVote", castVote);
router.get("/audience-info/", voterInfo);
router.get("/voter-details/:token", getExistingVoterDetails);
router.get("/:contestId/:seasonId", getLiveVotes);
// GET total stars for a participant in a round (supports params and query)
router.get(
  "/totalStars/:contestId/:participantId/:roundName/:seasonId",
  getTotalStars,
);

// Audience vs Judges bucket totals (for VoteProfile)
router.get(
  "/bucket-totals/:contestId/:participantId/:roundId/:seasonId",
  getBucketTotals,
);
// router.get('/totalStars', getTotalStars); // also allow query params: ?contestId=&participantId=&roundName=
// GET number of distinct voters (people) for a participant in a round
// voterCount is now returned by the totalStars endpoint as `totalVoters`.

module.exports = router;
