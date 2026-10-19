import nodemailer from "nodemailer";
import config from "../config";

// Created once: building a transporter doesn't open a connection, so this
// is safe to import in tests too.
const transporter = nodemailer.createTransport({
  host: config.smtp.smtp_host,
  service: config.smtp.smtp_service,
  port: config.smtp.smtp_port,
  secure: false, // true for port 465, false for other ports
  auth: {
    user: config.smtp.smtp_mail,
    pass: config.smtp.smtp_password,
  },
});

const sendEmail = async (options: {
  email: string;
  subject: string;
  html: string;
}) => {
  const { email, subject, html } = options;

  await transporter.sendMail({
    from: `${config.smtp.NAME} <${config.smtp.smtp_mail}>`,
    to: email,
    subject,
    html,
  });
};

export { sendEmail };
