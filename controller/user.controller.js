import httpStatus from "http-status";
import { User } from "../model/user.model.js";
import { uploadOnCloudinary } from "../utils/commonMethod.js";
import AppError from "../errors/AppError.js";
import sendResponse from "../utils/sendResponse.js";
import catchAsync from "../utils/catchAsync.js";
import { Payment } from "../model/payment.model.js";
import { Property } from "../model/property.model.js";

// Get user profile
export const getProfile = catchAsync(async (req, res) => {
  const user = await User.findById(req.user._id).select(
    "-password -refreshToken -verificationInfo -password_reset_token"
  );
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Profile fetched successfully",
    data: user,
  });
});

// Update profile
export const updateProfile = catchAsync(async (req, res) => {
  const { name } = req.body;

  // Find user
  const user = await User.findById(req.user._id).select(
    "-password -refreshToken -verificationInfo -password_reset_token"
  );
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  // Update only provided fields
  if (name) user.name = name;

  console.log(req.file);

  if (req.file) {
    const result = await uploadOnCloudinary(req.file.buffer);
    user.avatar.public_id = result.public_id;
    user.avatar.url = result.secure_url;
  }

  await user.save();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Profile updated successfully",
    data: user,
  });
});

// Change user password
export const changePassword = catchAsync(async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  const user = await User.findById(req.user._id).select("+password");
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  if (newPassword !== confirmPassword) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "New password and confirm password do not match"
    );
  }

  if (!(await User.isPasswordMatched(currentPassword, user.password))) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      "Current password is incorrect"
    );
  }

  user.password = newPassword;
  await user.save();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Password changed successfully",
    data: user,
  });
});

export const getCashflowDashboard = catchAsync(async (req, res) => {
  const userId = req.user._id;

  // Total Properties
  const totalProperties = await Property.countDocuments({ user: userId });

  // Total Monthly Rental Income
  const properties = await Property.find({ user: userId }).lean();
  const totalMonthlyRent = properties.reduce((sum, prop) => {
    if (prop.lease && prop.lease.monthlyRent) {
      return sum + prop.lease.monthlyRent * (prop.ownershipPercentage / 100);
    }
    return sum;
  }, 0);

  // Upcoming Payments (next 30 days)
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const upcomingPayments = await Payment.find({
    user: userId,
    status: "Pending",
    dueDate: { $lte: thirtyDaysFromNow },
  })
    .populate("property", "name address")
    .sort({ dueDate: 1 });

  // Cashflow by Country (percentage of rental income)
  const countryMap = {};
  let totalRentForPercentage = 0;

  properties.forEach((prop) => {
    if (prop.lease && prop.lease.monthlyRent) {
      const country = prop.address.country || "Unknown";
      const rentShare =
        prop.lease.monthlyRent * (prop.ownershipPercentage / 100);
      countryMap[country] = (countryMap[country] || 0) + rentShare;
      totalRentForPercentage += rentShare;
    }
  });

  const cashflowByCountry = Object.keys(countryMap).map((country) => ({
    country,
    percentage:
      totalRentForPercentage > 0
        ? Math.round((countryMap[country] / totalRentForPercentage) * 100)
        : 0,
    amount: countryMap[country],
  }));

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Cashflow dashboard data fetched",
    data: {
      totalProperties,
      monthlyRentalIncome: Math.round(totalMonthlyRent),
      upcomingPayments,
      cashflowByCountry,
    },
  });
});

// Change notification settings
export const updateNotificationSettings = catchAsync(async (req, res) => {
  const {
    rentNotifications,
    propertyNotifications,
    paymentNotifications,
    billNotifications,
  } = req.body;
  const user = await User.findById(req.user._id);
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  user.notificationSettings = {
    rentNotifications:
      rentNotifications ?? user.notificationSettings.rentNotifications,
    propertyNotifications:
      propertyNotifications ?? user.notificationSettings.propertyNotifications,
    paymentNotifications:
      paymentNotifications ?? user.notificationSettings.paymentNotifications,
    billNotifications:
      billNotifications ?? user.notificationSettings.billNotifications,
  };

  await user.save();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Notification settings updated successfully",
    data: user,
  });
});

// Change currency preference
export const updateCurrencyPreference = catchAsync(async (req, res) => {
  const { currency } = req.body;
  const user = await User.findById(req.user._id);
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  user.currency = currency ?? user.currency;

  await user.save();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Currency preference updated successfully",
    data: user,
  });
});
