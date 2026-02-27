const crypto = require("crypto");
const User = require("../models/User");
const { sendResetPasswordEmail } = require("../utils/emailService");
 
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
 
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }
    console.log("FORGET PASSWORD email:", email);
 
    const user = await User.findOne({ email });
    console.log("USER FOUND:", !!user);
 
    if (!user) {
      return res.status(200).json({
        success: true,
        message: "If that email exists, a reset link has been sent.",
      });
    }
 
    if (user.authProvider === "google") {
      return res.status(400).json({
        success: false,
        message: "This account uses Google sign-in.",
      });
    }
 
    // Generate token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

    
 
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpire = Date.now() + 15 * 60 * 1000;
 
    await user.save({ validateBeforeSave: false });

const checkUser = await User.findOne({ email });

 
 
    const resetUrl = `${process.env.FRONTEND_URL}/api/auth/reset-password/${resetToken}`;
    console.log("Reset URL:", resetUrl);
 
    await sendResetPasswordEmail(user.email, resetUrl);
 
    return res.status(200).json({
      success: true,
      message: "If that email exists, a reset link has been sent.",
    });
 
  } catch (error) {
    console.error("Forgot Password Error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
 
exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;
 
    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }
 
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    console.log("RESET token received:", token);
    console.log("RESET hashedToken:", hashedToken);

    const testuser = await User.findOne({ email: "emelinazubby@gmail.com" });
    console.log("DB resetPasswordToken:", testuser?.resetPasswordToken);
    console.log("DB resetPasswordExpire:", testuser?.resetPasswordExpire);
    console.log("NOW:", new Date());
 
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() },
    });
 
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired token",
      });
    }
 
    user.password = password; // ensure you hash in pre-save
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
 
    await user.save();
 
    return res.status(200).json({
      success: true,
      message: "Password reset successful",
    });
 
  } catch (error) {
    console.error("Reset Password Error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
 