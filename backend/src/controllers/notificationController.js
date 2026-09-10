const { sendEmail } = require('../services/emailService');
const { sendWhatsAppTemplateMessage } = require('../services/whatsappService');
const { getDb } = require('../config/db');
const AuditService = require('../services/auditService');
const { getLocalDateString } = require('../utils/localDate');

const templates = {
  receipt: {
    email: {
      subject: 'Receipt from Clinic',
      html: (data) => `
        <h2>Receipt</h2>
        <p>Dear ${data.patientName},</p>
        <p>Your receipt for ₹${data.amount} has been generated.</p>
        <p><strong>Receipt ID:</strong> ${data.receiptId}</p>
        <p><strong>Date:</strong> ${data.date}</p>
        <p><strong>Payment Method:</strong> ${data.paymentMethod}</p>
        <p>Thank you for your visit!</p>
      `,
      text: (data) => `Receipt for ₹${data.amount}. Receipt ID: ${data.receiptId}. Date: ${data.date}. Payment: ${data.paymentMethod}`
    },
    whatsapp: (data) => `Receipt generated: ₹${data.amount}\nReceipt ID: ${data.receiptId}\nDate: ${data.date}\nPayment: ${data.paymentMethod}`
  },
  prescription: {
    email: {
      subject: 'Your Prescription',
      html: (data) => `
        <h2>Prescription</h2>
        <p>Dear ${data.patientName},</p>
        <p>Your prescription has been prepared by Dr. ${data.doctorName}.</p>
        <h3>Medications:</h3>
        <ul>
          ${data.medications.map(m => `<li>${m.name} - ${m.dosage} ${m.frequency} for ${m.duration}</li>`).join('')}
        </ul>
        <p><strong>Follow-up:</strong> ${data.followUp || 'As advised'}</p>
        <p>Please follow the instructions carefully.</p>
      `,
      text: (data) => `Prescription from Dr. ${data.doctorName}. Medications: ${data.medications.map(m => `${m.name} ${m.dosage}`).join(', ')}. Follow-up: ${data.followUp || 'As advised'}`
    },
    whatsapp: (data) => `Prescription from Dr. ${data.doctorName}\n\nMedications:\n${data.medications.map(m => `• ${m.name} - ${m.dosage} ${m.frequency}`).join('\n')}\n\nFollow-up: ${data.followUp || 'As advised'}`
  },
  appointment: {
    email: {
      subject: 'Appointment Confirmation',
      html: (data) => `
        <h2>Appointment Confirmed</h2>
        <p>Dear ${data.patientName},</p>
        <p>Your appointment has been confirmed with Dr. ${data.doctorName}.</p>
        <p><strong>Date:</strong> ${data.date}</p>
        <p><strong>Time:</strong> ${data.time}</p>
        <p><strong>Reason:</strong> ${data.reason}</p>
        <p>Please arrive 15 minutes early.</p>
      `,
      text: (data) => `Appointment confirmed with Dr. ${data.doctorName} on ${data.date} at ${data.time}. Reason: ${data.reason}`
    },
    whatsapp: (data) => `Appointment Confirmed\n\nDr. ${data.doctorName}\nDate: ${data.date}\nTime: ${data.time}\nReason: ${data.reason}\n\nPlease arrive 15 minutes early.`
  },
  reminder: {
    email: {
      subject: 'Appointment Reminder',
      html: (data) => `
        <h2>Appointment Reminder</h2>
        <p>Dear ${data.patientName},</p>
        <p>This is a reminder for your appointment with Dr. ${data.doctorName}.</p>
        <p><strong>Date:</strong> ${data.date}</p>
        <p><strong>Time:</strong> ${data.time}</p>
        <p><strong>Reason:</strong> ${data.reason}</p>
      `,
      text: (data) => `Reminder: Appointment with Dr. ${data.doctorName} on ${data.date} at ${data.time}`
    },
    whatsapp: (data) => `Appointment Reminder\n\nDr. ${data.doctorName}\nDate: ${data.date}\nTime: ${data.time}\nReason: ${data.reason}`,
    sms: (data) => `Reminder: Appointment with Dr. ${data.doctorName} on ${data.date} at ${data.time}. Reason: ${data.reason}`
  }
};

async function sendEmailNotification(req, res) {
  try {
    const { to, subject, html, text, template, templateData } = req.body;

    if (!to) {
      return res.status(400).json({ error: 'Recipient email is required' });
    }

    let finalSubject = subject;
    let finalHtml = html;
    let finalText = text;

    // Use template if provided
    if (template && templates[template] && templateData) {
      const tpl = templates[template].email;
      finalSubject = tpl.subject;
      finalHtml = tpl.html(templateData);
      finalText = tpl.text(templateData);
    }

    if (!finalSubject || (!finalHtml && !finalText)) {
      return res.status(400).json({ error: 'Subject and content (html or text) are required' });
    }

    const info = await sendEmail({ to, subject: finalSubject, html: finalHtml, text: finalText });
    res.json({ status: true, messageId: info.messageId, message: 'Email sent successfully' });
  } catch (error) {
    console.error('Send email error:', error);
    res.status(500).json({ error: 'Failed to send email', details: error.message });
  }
}

async function sendWhatsAppNotification(req, res) {
  try {
    const { phone, template, templateData, message } = req.body;

    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    let finalMessage = message;

    // Use template if provided
    if (template && templates[template] && templateData) {
      finalMessage = templates[template].whatsapp(templateData);
    }

    if (!finalMessage) {
      return res.status(400).json({ error: 'Message or template with templateData is required' });
    }

    // For now, use template name 'hello_world' or custom
    const templateName = template || 'hello_world';
    const response = await sendWhatsAppTemplateMessage(phone, templateName, finalMessage);
    res.json({ status: true, response, message: 'WhatsApp message sent successfully' });
  } catch (error) {
    console.error('Send WhatsApp error:', error);
    res.status(500).json({ error: 'Failed to send WhatsApp message', details: error.message });
  }
}

async function sendReceiptNotification(req, res) {
  try {
    const { billId, email, phone, method = 'both' } = req.body;
    const db = getDb();

    // Fetch bill details
    const [bills] = await db.execute(
      `SELECT b.*, p.name as patient_name FROM bills b
       JOIN patients p ON b.patient_id = p.id WHERE b.id = ?`,
      [billId]
    );

    if (bills.length === 0) {
      return res.status(404).json({ error: 'Bill not found' });
    }

    const bill = bills[0];
    const templateData = {
      patientName: bill.patient_name,
      amount: bill.total_amount,
      receiptId: bill.id,
      date: bill.bill_date || getLocalDateString(),
      paymentMethod: bill.payment_method
    };

    const results = {};

    if ((method === 'email' || method === 'both') && (email || bill.email)) {
      try {
        const emailResult = await sendEmail({
          to: email || bill.email,
          subject: templates.receipt.email.subject,
          html: templates.receipt.email.html(templateData),
          text: templates.receipt.email.text(templateData)
        });
        results.email = { status: true, messageId: emailResult.messageId };
      } catch (err) {
        results.email = { status: false, error: err.message };
      }
    }

    if ((method === 'whatsapp' || method === 'both') && (phone || bill.phone)) {
      try {
        const waResult = await sendWhatsAppTemplateMessage(phone || bill.phone, 'hello_world', templates.receipt.whatsapp(templateData));
        results.whatsapp = { status: true, response: waResult };
      } catch (err) {
        results.whatsapp = { status: false, error: err.message };
      }
    }

    res.json({ status: true, results });
  } catch (error) {
    console.error('Send receipt notification error:', error);
    res.status(500).json({ error: 'Failed to send receipt notification', details: error.message });
  }
}

async function listNotifications(req, res) {
  try {
    const db = getDb();
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    try {
      const [notifications] = await db.execute(
        `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`,
        [userId]
      );
      res.json({ notifications });
    } catch (dbErr) {
      const code = dbErr && (dbErr.code || dbErr.errno || dbErr.sqlState);
      if (code === 'ER_NO_SUCH_TABLE' || code === 1146) {
        return res.json({ notifications: [] });
      }
      throw dbErr;
    }
  } catch (error) {
    console.error('List notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
}

async function markNotificationAsRead(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const db = getDb();

    await db.execute(
      'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Mark notification as read error:', error);
    res.status(500).json({ error: 'Failed to update notification' });
  }
}

async function markAllNotificationsAsRead(req, res) {
  try {
    const userId = req.user?.id;
    const db = getDb();

    await db.execute(
      'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0',
      [userId]
    );

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all notifications as read error:', error);
    res.status(500).json({ error: 'Failed to update notifications' });
  }
}

async function sendSMSNotification(req, res) {
  // SMS service is disabled
  return res.status(503).json({ 
    error: 'SMS service is not available', 
    message: 'SMS functionality has been disabled. Please use email or WhatsApp notifications instead.' 
  });
}

// Automated notification functions (called by other controllers)
async function sendAppointmentConfirmation(appointmentId) {
  try {
    const db = getDb();
    const [appointments] = await db.execute(
      `SELECT a.*, p.name as patient_name, p.phone, p.email,
              u.name as doctor_name
       FROM appointments a
       JOIN patients p ON a.patient_id = p.id
       JOIN doctors d ON a.doctor_id = d.id
       JOIN users u ON d.user_id = u.id
       WHERE a.id = ?`,
      [appointmentId]
    );

    if (appointments.length === 0) return;

    const apt = appointments[0];
    const templateData = {
      patientName: apt.patient_name,
      doctorName: apt.doctor_name,
      date: apt.appointment_date,
      time: apt.appointment_time,
      reason: apt.reason_for_visit || 'General consultation'
    };

    // Send email if available
    if (apt.email) {
      try {
        await sendEmail({
          to: apt.email,
          subject: templates.appointment.email.subject,
          html: templates.appointment.email.html(templateData),
          text: templates.appointment.email.text(templateData)
        });
      } catch (err) {
        console.error('Appointment email error:', err);
      }
    }

    // SMS service disabled - skip SMS sending
    // SMS notifications are not available

    // Create notification in database
    await db.execute(
      `INSERT INTO notifications (user_id, type, title, message, created_at)
       SELECT u.id, 'appointment', 'Appointment Confirmed', 
              CONCAT('Appointment with Dr. ', ?, ' on ', ?, ' at ', ?), NOW()
       FROM users u
       WHERE u.role IN ('admin', 'doctor')
       LIMIT 1`,
      [apt.doctor_name, apt.appointment_date, apt.appointment_time]
    );
  } catch (error) {
    console.error('Send appointment confirmation error:', error);
  }
}

// Add SMS template to appointment
if (!templates.appointment.sms) {
  templates.appointment.sms = (data) => `Appointment Confirmed\n\nDr. ${data.doctorName}\nDate: ${data.date}\nTime: ${data.time}\nReason: ${data.reason}\n\nPlease arrive 15 minutes early.`;
}

module.exports = { 
  sendEmailNotification, 
  sendWhatsAppNotification,
  sendSMSNotification,
  sendReceiptNotification,
  listNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  sendAppointmentConfirmation
};
