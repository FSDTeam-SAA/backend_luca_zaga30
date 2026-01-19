import AppError from "../errors/AppError.js";
import { createToken, verifyToken } from "../utils/authToken.js";
import catchAsync from "../utils/catchAsync.js";
import { generateOTP } from "../utils/commonMethod.js";
import httpStatus from "http-status";
import sendResponse from "../utils/sendResponse.js";
import { sendEmail } from "../utils/sendEmail.js";
import { User } from "./../model/user.model.js";

export const register = catchAsync(async (req, res) => {
  const {
    name,
    email,
    phone,
    nationality,
    newsletterButton,
    password,
    confirmPassword,
  } = req.body;

  if (!email || !password) {
    throw new AppError(httpStatus.FORBIDDEN, "Please fill in all fields");
  }

  if (password !== confirmPassword) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Password and confirm password do not match",
    );
  }
  const checkUser = await User.findOne({ email: email });
  if (checkUser)
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Email already exists, please try another email",
    );

  const user = await User.create({
    name,
    email,
    phone,
    nationality,
    password,
    verificationInfo: { token: "", verified: true },
  });

  if (newsletterButton) {
    user.newsletterButton = newsletterButton;
  }

  const jwtPayload = {
    _id: user._id,
    email: user.email,
    role: user.role,
  };
  const accessToken = createToken(
    jwtPayload,
    process.env.JWT_ACCESS_SECRET,
    process.env.JWT_ACCESS_EXPIRES_IN,
  );

  const refreshToken = createToken(
    jwtPayload,
    process.env.JWT_REFRESH_SECRET,
    process.env.JWT_REFRESH_EXPIRES_IN,
  );
  user.refreshToken = refreshToken;
  await user.save();
  user.accessToken = accessToken;

  const userObj = user.toObject();
  userObj.accessToken = accessToken;

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User registered successfully",
    data: userObj,
  });
});

export const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.isUserExistsByEmail(email);
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }
  if (
    user?.password &&
    !(await User.isPasswordMatched(password, user.password))
  ) {
    throw new AppError(httpStatus.FORBIDDEN, "Password is not correct");
  }
  if (!(await User.isOTPVerified(user._id))) {
    const otp = generateOTP();
    const jwtPayloadOTP = {
      otp: otp,
    };

    const otptoken = createToken(
      jwtPayloadOTP,
      process.env.OTP_SECRET,
      process.env.OTP_EXPIRE,
    );
    user.verificationInfo.token = otptoken;
    await user.save();
    await sendEmail(user.email, "Registerd Account", `Your OTP is ${otp}`);

    return sendResponse(res, {
      statusCode: httpStatus.FORBIDDEN,
      success: false,
      message: "OTP is not verified, please verify your OTP",
      data: { email: user.email },
    });
  }
  const jwtPayload = {
    _id: user._id,
    email: user.email,
    role: user.role,
  };
  const accessToken = createToken(
    jwtPayload,
    process.env.JWT_ACCESS_SECRET,
    process.env.JWT_ACCESS_EXPIRES_IN,
  );

  const refreshToken = createToken(
    jwtPayload,
    process.env.JWT_REFRESH_SECRET,
    process.env.JWT_REFRESH_EXPIRES_IN,
  );

  user.refreshToken = refreshToken;
  let _user = await user.save();

  res.cookie("refreshToken", refreshToken, {
    secure: true,
    httpOnly: true,
    sameSite: "none",
    maxAge: 1000 * 60 * 60 * 24 * 365,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User Logged in successfully",
    data: {
      accessToken,
      refreshToken: refreshToken,
      role: user.role,
      _id: user._id,
      user: user,
    },
  });
});

export const forgetPassword = catchAsync(async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email });
  if (!user) throw new AppError(404, "User not found");

  const otp = generateOTP();

  const resetToken = createToken(
    { id: user._id },
    process.env.RESET_PASSWORD_SECRET,
    "10m",
  );

  user.passwordResetOTP = otp;
  user.passwordResetOTPExpiry = Date.now() + 10 * 60 * 1000;
  user.passwordResetVerified = false;
  user.password_reset_token = resetToken; // stored only

  await user.save();

  await sendEmail(user.email, "Reset Password", `Your OTP is ${otp}`);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "OTP sent to email",
    data: {},
  });
});

export const resetPassword = catchAsync(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new AppError(400, "Email and password are required");
  }

  const user = await User.findOne({ email }).select("+password");
  if (!user) throw new AppError(404, "User not found");

  if (!user.passwordResetVerified) {
    throw new AppError(403, "OTP not verified");
  }

  user.password = password;
  user.passwordResetOTP = undefined;
  user.passwordResetOTPExpiry = undefined;
  user.passwordResetVerified = false;
  user.password_reset_token = ""; // cleanup

  await user.save();

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Password reset successful",
    data: {},
  });
});

export const verifyOTP = catchAsync(async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    throw new AppError(400, "Email and OTP are required");
  }

  const user = await User.findOne({ email });
  if (!user) throw new AppError(404, "User not found");

  if (
    !user.passwordResetOTP ||
    user.passwordResetOTP !== otp ||
    user.passwordResetOTPExpiry < Date.now()
  ) {
    throw new AppError(400, "Invalid or expired OTP");
  }

  user.passwordResetVerified = true;
  await user.save();

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "OTP verified successfully",
    data: {},
  });
});

export const changePassword = catchAsync(async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Old password and new password are required",
    );
  }
  if (oldPassword === newPassword) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Old password and new password cannot be same",
    );
  }
  const user = await User.findById({ _id: req.user?._id });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }
  user.password = newPassword;
  await user.save();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Password changed",
    data: "",
  });
});

export const refreshToken = catchAsync(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw new AppError(400, "Refresh token is required");
  }

  const decoded = verifyToken(refreshToken, process.env.JWT_REFRESH_SECRET);
  const user = await User.findById(decoded._id);
  if (!user || user.refreshToken !== refreshToken) {
    throw new AppError(401, "Invalid refresh token");
  }
  const jwtPayload = {
    _id: user._id,
    email: user.email,
    role: user.role,
  };

  const accessToken = createToken(
    jwtPayload,
    process.env.JWT_ACCESS_SECRET,
    process.env.JWT_ACCESS_EXPIRES_IN,
  );

  const refreshToken1 = createToken(
    jwtPayload,
    process.env.JWT_REFRESH_SECRET,
    process.env.JWT_REFRESH_EXPIRES_IN,
  );
  user.refreshToken = refreshToken1;
  await user.save();

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Token refreshed successfully",
    data: { accessToken: accessToken, refreshToken: refreshToken1 },
  });
});

export const logout = catchAsync(async (req, res) => {
  const user = req.user?._id;
  const user1 = await User.findByIdAndUpdate(
    user,
    { refreshToken: "" },
    { new: true },
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Logged out successfully",
    data: "",
  });
});
