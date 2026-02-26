const nodemailer = require("nodemailer");
 
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});
 
async function sendVerificationCode(toEmail, code) {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: toEmail,
      subject: "EquiTask 2FA Verification Code",
      text: `Your verification code is: ${code}\nThis code expires in 10 minutes.`,
    });
    return { success: true };
  } catch (err) {
    console.error("Email send error:", err.message);
    return { success: false, error: err.message };
  }
}
 
module.exports = { sendVerificationCode };
 