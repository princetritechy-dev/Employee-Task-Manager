const nodemailer = require("nodemailer");

const sendEmail = async (options) => {
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT),
    secure: false,

    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  await transporter.sendMail({
    from: `"Employee Task Manager" <${process.env.EMAIL_FROM}>`,
    to: options.email,
    subject: options.subject,
    html: options.message
  });
};

module.exports = sendEmail;