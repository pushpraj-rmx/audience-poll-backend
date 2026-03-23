const express = require('express')
const { protect } = require('../middlewares/auth');
const { getAllSponsors, getallsponsor, getSponsorsBySeason } = require('../controllers/sponsor.controller');

const router = express.Router();

router.get('/getAllSponsors',protect(["super_admin","admin"]),getAllSponsors);
router.get('/',getallsponsor)
router.get('/getSponsorsBySeason/:seasonId',protect(["super_admin","admin","judge","sponsor"]),getSponsorsBySeason);

module.exports = router