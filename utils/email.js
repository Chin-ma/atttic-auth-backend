const nodemailer = require("nodemailer");

exports.sendInvitationEmail = async (email, token) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const inviteLink = `http://localhost:3000/reset-password?token=${token}`;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: "User Invitation",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #333;">Welcome to Your Enterprise Account!</h2>
        <p>You’ve been invited to join the enterprise account. Please click the button below to set your password and activate your account:</p>

        <div style="text-align: center; margin: 10px 0;">
          <a href="${inviteLink}" 
            style="
              background-color: #007bff;
              color: #fff;
              padding: 12px 25px;
              text-decoration: none;
              border-radius: 6px;
              font-weight: bold;
              display: inline-block;
              font-size: 15px;
            ">
            Set Your Password
          </a>
        </div>

        <p>This link will expire in <strong>1 hour</strong>. Please do not share it with anyone.</p>
        <p>Thank you,<br><strong>The Attic Auth Team</strong></p>

        <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
        <p style="font-size: 12px; color: #777;">
          If you didn’t expect this email, please ignore it. 
          For security reasons, do not forward this message.
        </p>
      </div>
    `,
  };


  await transporter.sendMail(mailOptions);
};

exports.sendResetPasswordEmail = async (email, token) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const resetLink = `http://localhost:3000/reset-password?token=${token}`;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Password Reset",
    html: `
      <h3>Password Reset</h3>
      <p>Click the link below to reset your password:</p>
      <a href="${resetLink}">${resetLink}</a>
      <p>This link expires in 1 hour.</p>
    `,
  };

  await transporter.sendMail(mailOptions);
};
