const express = require('express');

const { authenticateToken } = require('../middleware/auth');
const notificationController = require('../controllers/notificationController');
const joiValidate = require('../middleware/joiValidate');
const { createNotification } = require('../validation/commonSchemas');

const router = express.Router();

router.get('/', authenticateToken, notificationController.listNotifications);
router.patch('/read-all', authenticateToken, notificationController.markAllNotificationsAsRead);
router.patch('/:id/read', authenticateToken, notificationController.markNotificationAsRead);
router.post('/email', authenticateToken, joiValidate(createNotification), notificationController.sendEmailNotification);
router.post('/whatsapp', authenticateToken, joiValidate(createNotification), notificationController.sendWhatsAppNotification);
router.post('/sms', authenticateToken, joiValidate(createNotification), notificationController.sendSMSNotification);
router.post('/receipt', authenticateToken, joiValidate(createNotification), notificationController.sendReceiptNotification);

module.exports = router;
