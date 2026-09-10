const nodemailer = require('nodemailer');
const env = require('../config/env');

const transporter = nodemailer.createTransport({
  host: env.email.host,
  port: env.email.port,
  secure: env.email.port === 465,
  auth: {
    user: env.email.user,
    pass: env.email.pass
  }
});

async function sendEmail({ to, subject, html, text, attachments }) {
  if (!env.email.host || !env.email.user) {
    throw new Error('Email is not configured. Please set SMTP env vars.');
  }

  const mailOptions = {
    from: env.email.from,
    to,
    subject,
    text,
    html
  };

  // Add attachments if provided
  if (attachments && attachments.length > 0) {
    mailOptions.attachments = attachments;
  }

  const info = await transporter.sendMail(mailOptions);

  return info;
}

module.exports = { sendEmail };

