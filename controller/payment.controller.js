import httpStatus from "http-status";
import { Payment } from "../model/payment.model.js";
import {
  createNotification,
  uploadOnCloudinary,
} from "../utils/commonMethod.js";
import AppError from "../errors/AppError.js";
import catchAsync from "../utils/catchAsync.js";
import sendResponse from "../utils/sendResponse.js";

// Get all upcoming/overdue payments
export const getPayments = catchAsync(async (req, res) => {
  const { type, status } = req.query;
  let filter = { user: req.user._id };

  if (type) filter.type = type;
  if (status) filter.status = status;

  const payments = await Payment.find(filter)
    .populate("property", "name address.city")
    .sort({ dueDate: 1 });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    data: payments,
  });
});

// Add new payment
export const addPayment = catchAsync(async (req, res) => {
  const {
    property,
    type,
    amount,
    dueDate,
    receiverName,
    bank,
    accountNumber,
    status,
  } = req.body;

  const newPayment = await Payment.create({
    user: req.user._id,
    property,
    type,
    amount: Number(amount),
    dueDate,
    receiverName,
    bank,
    accountNumber,
    status: status || "Pending",
    proofFiles: [],
  });

  // Upload proof files (if any)
  if (req.files && req.files.length > 0) {
    const uploads = req.files.map((file) =>
      uploadOnCloudinary(file.buffer, {
        resource_type: "raw",
        folder: "payments/proof",
      })
    );
    const results = await Promise.all(uploads);

    newPayment.proofFiles = results.map((r) => ({
      public_id: r.public_id,
      url: r.secure_url,
    }));
    await newPayment.save();
  }

  const populated = await Payment.findById(newPayment._id).populate(
    "property",
    "name"
  );

  await createNotification({
    user: req.user._id,
    title: `${newPayment.type} Added`,
    message: `A new ${newPayment.type.toLowerCase()} of $${
      newPayment.amount
    } is due on ${new Date(newPayment.dueDate).toLocaleDateString()}`,
    type: newPayment.type,
    relatedId: newPayment._id,
    relatedModel: "Payment",
  });

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Payment added successfully",
    data: populated,
  });
});

// Update payment status
export const updatePaymentStatus = catchAsync(async (req, res) => {
  const { status } = req.body;
  const payment = await Payment.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id },
    { status, paidDate: status === "Paid" ? new Date() : undefined },
    { new: true }
  );

  if (!payment) throw new AppError(httpStatus.NOT_FOUND, "Payment not found");

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Payment status updated",
    data: payment,
  });
});
