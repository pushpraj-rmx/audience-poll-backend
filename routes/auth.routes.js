const express = require('express');
const { login, getLoggedInUser, signup, logout, resetPassword, forgotPassword, superAdminLogin, sendResetEmail, getLoggedInParticipant } = require('../controllers/auth.controller');
const { protect } = require('../middlewares/auth');
const router = express.Router();

// router.post('/signup',signup);
router.post('/logout', logout);
router.post('/login',login);
router.get('/me', protect(["super_admin","admin", "sponsor", "judge"]), getLoggedInUser);
router.get('/participant', protect(["participant"]), getLoggedInParticipant);
router.post('/reset-password',protect(["super_admin"]),resetPassword);
router.post('/forgot-password',forgotPassword);
router.post('/super-admin-login',superAdminLogin)
router.post('/reset_by_email',sendResetEmail)
module.exports = router