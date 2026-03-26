const nodemailer = require("nodemailer");

 
console.log("EMAIL_USER:", process.env.EMAIL_USER);
console.log("EMAIL_PASSWORD exists:", !!process.env.EMAIL_PASSWORD);
console.log("EMAIL_PASSWORD length:", process.env.EMAIL_PASSWORD?.length);
 
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
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
 
async function sendResetPasswordEmail(toEmail, resetUrl) {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: toEmail,
      subject: "EquiTask AI Password Reset",
      html: `
        <div style="font-family: Arial; line-height: 1.6;">
          <h2>Reset Your Password</h2>
          <p>You requested a password reset.</p>
          <p>Click the link below to reset your password:</p>
          <a href="${resetUrl}"
             style="display:inline-block;
             padding:10px 15px;
             background:#111;
             color:#fff;
             text-decoration:none;
             border-radius:6px;">
             Reset Password
          </a>
          <p>This link expires in 15 minutes.</p>
          <p>If you didn’t request this, ignore this email.</p>
        </div>
      `,
    });
 
    return { success: true };
  } catch (err) {
    console.error("Reset email send error:", err.message);
    return { success: false, error: err.message };
  }
}
 
async function sendInviteEmail(toEmail, inviteCode, organizationName, expiresAt) {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: toEmail,
      subject: "You’ve been invited to join EquiTask",
      text: `
Hello,
 
You have been invited to join ${organizationName || "an organization"} on EquiTask.
 
Your invite code is: ${inviteCode}
 
Use this code in the app to join the organization.
 
This code expires on: ${expiresAt}
 
If you were not expecting this invite, please ignore this email.
      `.trim(),
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #222;">
          <h2>You’ve been invited to join EquiTask</h2>
          <p>Hello,</p>
          <p>You have been invited to join <strong>${organizationName || "an organization"}</strong> on EquiTask.</p>
          <p><strong>Your invite code is:</strong> ${inviteCode}</p>
          <p>Use this code in the app to join the organization.</p>
          <p><strong>This code expires on:</strong> ${expiresAt}</p>
          <p>If you were not expecting this invite, please ignore this email.</p>
        </div>
      `,
    });
 
    return { success: true };
  } catch (err) {
    console.error("Invite email send error:", err.message);
    return { success: false, error: err.message };
  }
}
 
module.exports = {
  sendVerificationCode,
  sendResetPasswordEmail,
  sendInviteEmail,
};
 