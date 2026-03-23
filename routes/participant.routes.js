const express = require('express')
const router = express.Router();
const {protect} = require('../middlewares/auth');
const upload = require('../middlewares/upload');
const { createParticipant, getAllParticipants, getParticipantById, updateParticipant, deleteParticipant, assignContestToParticipant, loginParticipant, getLoggedInParticipant, contestHistory, bulkImportParticipants, getRoundParticipantsWithStars, getParticipantBySeason, updateParticipantForSeason, deleteParticipantFromSeason } = require('../controllers/participant.controller');

router.post('/createParticipant', upload.single('profile'), createParticipant);
router.post('/import', upload.single('csv'), bulkImportParticipants);
router.post('/login', loginParticipant);
router.get('/me',protect(["participant"]),getLoggedInParticipant);
router.get('/',protect(["super_admin", "admin", "sponsor", "judge"]), getAllParticipants);
router.get('/round-participants',getRoundParticipantsWithStars);
router.get('/:id',getParticipantById);
router.get('/getParticipantBySeason/:seasonId',protect(["super_admin","admin","judge","sponsor"]),getParticipantBySeason);
router.get('/contestHistory/:contestId/:seasonId',protect(["super_admin","admin","judge","sponsor","participant"]),contestHistory);
router.put('/updateParticipant/:id',protect(["super_admin", "admin", "participant","judge"]), upload.single('profile'), updateParticipant);
router.put('/updateParticipant-and-season',protect(["super_admin", "admin", "participant","judge"]), upload.single('profile'), updateParticipantForSeason);
router.put('/assign-contests/:id',protect(["super_admin", "admin"]),assignContestToParticipant);
router.delete('/deleteParticipant/:id',protect(["super_admin", "admin"]),deleteParticipant);
router.delete('/deleteParticipantFromSeason',protect(["super_admin", "admin"]),deleteParticipantFromSeason);


module.exports = router;