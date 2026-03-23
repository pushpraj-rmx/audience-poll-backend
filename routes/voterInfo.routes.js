const express = require('express');
const { submitVoterDetails } = require('../controllers/VoterInfo.controller');
const router = express.Router()

router.post('/submit',submitVoterDetails);


module.exports = router;