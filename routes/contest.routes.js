const express = require('express');
const router = express.Router();
const {protect} = require("../middlewares/auth");
const upload = require('../middlewares/upload');
const { getAllContests, getContestById, createContest, updateContest, deleteContest, toggleVoting, getContestByAdmin, assignUserToContest, assignParticipantToContest, unassignUserFromContest, unAssignParticipantFromContest, searchContests, votingEnabled, getContentest, getContestBySlug, getBasicDetails, assignToNextRound } = require('../controllers/contest.controller');

router.get('/',getAllContests);
router.get('/votingContests/',protect(["super_admin","participant","admin","judge","sponsor"]) ,votingEnabled);
router.get("/getContestById/:id" ,getContestById);
router.get("/getBasicDetails/:slug" ,getBasicDetails);
router.get("/getContestBySlug/:slug" ,getContestBySlug);
router.get("/getContestByAdmin/:id",protect(["super_admin", "admin"]) ,getContestByAdmin);
router.post("/createContest", protect(["super_admin","admin"]), upload.fields([{name: "logo", maxCount: 1}, { name: "banner", maxCount: 1}]),createContest);
router.put("/updateContest/:id",protect(["super_admin", "admin"]),upload.fields([{name: "logo", maxCount: 1}, { name: "banner", maxCount: 1}]) ,updateContest);
router.delete("/deleteContest/:id",protect(["super_admin", "admin"]) ,deleteContest);
router.put('/:id/toggle-voting',protect(["super_admin","admin"]),toggleVoting);
router.post("/assign-user", protect(["super_admin","admin"]), assignUserToContest);
router.post("/assign-participant", protect(["super_admin","admin","participant"]), assignParticipantToContest);
router.post("/unassign-user", protect(["super_admin","admin"]), unassignUserFromContest);
router.post("/unassign-participant", protect(["super_admin","admin"]), unAssignParticipantFromContest);
router.post("/assign-next-round",assignToNextRound)
router.get("/contests/searchContests",searchContests);
router.get("/fetch/contest",protect(["super_admin", "admin"]),getContentest)
module.exports = router