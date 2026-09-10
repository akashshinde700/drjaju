const express = require('express');
const router = express.Router();

const { authenticateToken } = require('../middleware/auth');

const doctorStaffController = require('../controllers/doctorStaffController');

// Protect all routes
router.use(authenticateToken);

router.get('/:doctorId', doctorStaffController.listDoctorStaff);
router.post('/', doctorStaffController.createDoctorStaff);
router.put('/:id', doctorStaffController.updateDoctorStaff);
router.delete('/:id', doctorStaffController.deleteDoctorStaff);

module.exports = router;
