const express = require('express')
const { protect } = require('../middlewares/auth')
const { getAllSuperAdmins, loginSuperAdmin } = require('../controllers/superAdmin.controller')

const router = express.Router()

router.get("/getAllSuperAdmins",getAllSuperAdmins);
router.post("/contest-login",loginSuperAdmin);

module.exports = router;