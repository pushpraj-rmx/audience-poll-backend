const express = require('express');
const { getAllUsers, getUserById, createUser, updateUser, deleteUser, assignContest, getAllUsersForContest } = require('../controllers/user.controller');
const { protect } = require('../middlewares/auth');
const upload = require('../middlewares/upload');

const router = express.Router();

router.use(protect(["super_admin","admin","participant","sponsor","judge"]))

router.get('/',getAllUsers);
router.get('/getUserById/:id',getUserById);
router.post("/createUser",upload.single('profile'),createUser);
router.put("/updateUser/:id",upload.single('profile'),updateUser);
router.delete("/deleteUser/:id",deleteUser);
router.put("/assignContest/:id",assignContest);

module.exports = router