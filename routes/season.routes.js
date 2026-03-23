const express = require('express');
const router = express.Router();
const upload = require('../middlewares/upload');
const { protect } = require('../middlewares/auth');
const { createSeason, getSeasonsByContestId, deleteSeason, getBasicDetails, getSeasonBySlug, updateSeason, toggleVoting, assignUserToSeason, unassignUserFromSeason, assignParticipantToSeason, unassignParticipantFromSeason, getSeasonById, addRoundToSeason, updateRoundById, addParticipantsToRound } = require('../controllers/season.controller');

router.get("/getseasons/:contestId",getSeasonsByContestId)
router.get("/get-season-basicDetails/:slug",getBasicDetails)
router.get("/get-season-by-slug/:slug",getSeasonBySlug)
router.get("/get-season-by-id/:seasonId",getSeasonById)
router.post("/create-season", protect(["super_admin","admin"]), upload.fields([{name: "logo", maxCount: 1}, { name: "banner", maxCount: 1}, { name: "pdf", maxCount: 1}]), createSeason);
router.post('/create-round',addRoundToSeason)
router.post('/add-participants-to-round', addParticipantsToRound);
router.put("/update-season/:seasonId", protect(["super_admin","admin"]), upload.fields([{name: "logo", maxCount: 1}, { name: "banner", maxCount: 1}, { name: "pdf", maxCount: 1}]), updateSeason);
router.put("/toggle-voting/:seasonId", protect(["super_admin","admin"]), toggleVoting);
router.put('/season/:seasonId/round/:roundId', updateRoundById)
router.post("/assign-user", protect(["super_admin","admin"]), assignUserToSeason);
router.post("/unassign-user", protect(["super_admin","admin"]), unassignUserFromSeason);
router.post("/assign-participant", protect(["super_admin","admin","participant"]), assignParticipantToSeason);
router.post("/unassign-participant", protect(["super_admin","admin","participant"]), unassignParticipantFromSeason);
router.delete("/delete-season/:seasonId",deleteSeason)


module.exports = router;