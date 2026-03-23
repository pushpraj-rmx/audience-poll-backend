const express = require('express')
const { protect } = require('../middlewares/auth')
const { getAllAdmins, alladmin, getAdminsBySeason } = require('../controllers/admin.controller')
const router = express.Router()


router.get('/getAllAdmins',protect(["super_admin","admin"]), getAllAdmins)
router.get('/',protect(["super_admin"]),alladmin)
router.get('/getAdminsBySeason/:seasonId', getAdminsBySeason)


module.exports = router