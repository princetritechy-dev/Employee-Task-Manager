require("dotenv").config();

const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT),
  secure: false,

  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

async function testEmail() {
  try {
    console.log("Testing Brevo SMTP...");

    await transporter.verify();

    console.log("SMTP connection successful!");

    const info = await transporter.sendMail({
      from: `"Employee Task Manager" <${process.env.EMAIL_FROM}>`,
      to: "prince.tritechy@gmail.com",
      subject: "Task Manager Email Test",

      html: `
        <h2>Email Test Successful</h2>

        <p>
          Your Task Manager email system is working correctly.
        </p>
      `
    });

    console.log("Email sent successfully!");
    console.log("Message ID:", info.messageId);

  } catch (error) {
    console.error("EMAIL ERROR:");
    console.error(error);
  }
}

testEmail();