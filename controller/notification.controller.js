import httpStatus from "http-status";
import { Notification } from "../model/notification.model.js";
import catchAsync from "../utils/catchAsync.js";
import sendResponse from "../utils/sendResponse.js";
import AppError from "../errors/AppError.js";

// Get all notifications with filters
export const getNotifications = catchAsync(async (req, res) => {
  const { type, isRead } = req.query;

  let filter = { user: req.user._id };

  if (type) filter.type = type;
  if (isRead !== undefined) filter.isRead = isRead === "true";

  const notifications = await Notification.find(filter)
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  // Add unread count
  const unreadCount = await Notification.countDocuments({
    user: req.user._id,
    isRead: false,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Notifications fetched successfully",
    data: {
      notifications,
      unreadCount,
    },
  });
});

// Mark as Read / Unread
export const markNotification = catchAsync(async (req, res) => {
  const { isRead } = req.body; // true or false

  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id },
    { isRead },
    { new: true }
  );

  if (!notification) {
    throw new AppError(httpStatus.NOT_FOUND, "Notification not found");
  }

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: `Notification marked as ${isRead ? "read" : "unread"}`,
    data: notification,
  });
});

// Mark All as Read
export const markAllAsRead = catchAsync(async (req, res) => {
  await Notification.updateMany(
    { user: req.user._id, isRead: false },
    { isRead: true }
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "All notifications marked as read",
  });
});

// Delete Notification
export const deleteNotification = catchAsync(async (req, res) => {
  const notification = await Notification.findOneAndDelete({
    _id: req.params.id,
    user: req.user._id,
  });

  if (!notification) {
    throw new AppError(httpStatus.NOT_FOUND, "Notification not found");
  }

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Notification deleted successfully",
  });
});
