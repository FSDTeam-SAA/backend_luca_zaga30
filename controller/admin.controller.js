import httpStatus from "http-status";
import mongoose from "mongoose";
import { User } from "../model/user.model.js";
import { Property } from "../model/property.model.js";
import { Payment } from "../model/payment.model.js";
import AppError from "../errors/AppError.js";
import catchAsync from "../utils/catchAsync.js";
import sendResponse from "../utils/sendResponse.js";

const parseNumber = (value, defaultValue, min = 1, max = 100) => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return defaultValue;
  return Math.min(Math.max(parsed, min), max);
};

const parseDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const buildSortOption = (sort, fallback = "-createdAt") => {
  const sortValue = sort || fallback;
  if (!sortValue) return { createdAt: -1 };
  if (sortValue.startsWith("-")) {
    return { [sortValue.slice(1)]: -1 };
  }
  return { [sortValue]: 1 };
};

const buildDateRangeFilter = (from, to, field) => {
  const start = parseDate(from);
  const end = parseDate(to);
  if (!start && !end) return null;
  const range = {};
  if (start) range.$gte = start;
  if (end) range.$lte = end;
  return { [field]: range };
};

const toObjectId = (value) => {
  if (!value) return null;
  if (!mongoose.Types.ObjectId.isValid(value)) return null;
  return new mongoose.Types.ObjectId(value);
};

export const getAdminUsers = catchAsync(async (req, res) => {
  const page = parseNumber(req.query.page, 1, 1, 100000);
  const limit = parseNumber(req.query.limit, 20, 1, 100);
  const skip = (page - 1) * limit;

  const { search, role, verified, sort } = req.query;
  const filter = {};

  if (role) filter.role = role;
  if (verified !== undefined) {
    filter["verificationInfo.verified"] = verified === "true";
  }

  if (search && search.trim() !== "") {
    const regex = new RegExp(search.trim(), "i");
    filter.$or = [
      { name: regex },
      { email: regex },
      { username: regex },
      { phone: regex },
    ];
  }

  const total = await User.countDocuments(filter);
  const users = await User.find(filter)
    .select(
      "-password -refreshToken -password_reset_token -verificationInfo.token"
    )
    .sort(buildSortOption(sort, "-createdAt"))
    .skip(skip)
    .limit(limit);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Users fetched successfully",
    data: {
      items: users,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    },
  });
});

export const getAdminPayments = catchAsync(async (req, res) => {
  const page = parseNumber(req.query.page, 1, 1, 100000);
  const limit = parseNumber(req.query.limit, 20, 1, 100);
  const skip = (page - 1) * limit;

  const { status, type, userId, propertyId, from, to, sort } = req.query;
  const filter = {};

  if (status) filter.status = status;
  if (type) filter.type = type;
  if (userId) filter.user = userId;
  if (propertyId) filter.property = propertyId;

  const dateFilter = buildDateRangeFilter(from, to, "dueDate");
  if (dateFilter) Object.assign(filter, dateFilter);

  const total = await Payment.countDocuments(filter);
  const payments = await Payment.find(filter)
    .populate("user", "name email role")
    .populate("property", "name address.city address.country")
    .sort(buildSortOption(sort, "-dueDate"))
    .skip(skip)
    .limit(limit);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Payments fetched successfully",
    data: {
      items: payments,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    },
  });
});

export const getAdminProperties = catchAsync(async (req, res) => {
  const page = parseNumber(req.query.page, 1, 1, 100000);
  const limit = parseNumber(req.query.limit, 20, 1, 100);
  const skip = (page - 1) * limit;

  const { search, propertyType, status, country, userId, sort } = req.query;
  const filter = {};

  if (userId) filter.user = userId;
  if (propertyType) filter.propertyType = { $regex: new RegExp(propertyType, "i") };
  if (status) filter.status = { $regex: new RegExp(status, "i") };
  if (country) filter["address.country"] = { $regex: new RegExp(country, "i") };

  if (search && search.trim() !== "") {
    const regex = new RegExp(search.trim(), "i");
    filter.$or = [
      { name: regex },
      { "address.city": regex },
      { "address.country": regex },
    ];
  }

  const total = await Property.countDocuments(filter);
  const properties = await Property.find(filter)
    .populate("user", "name email role")
    .sort(buildSortOption(sort, "-createdAt"))
    .skip(skip)
    .limit(limit);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Properties fetched successfully",
    data: {
      items: properties,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    },
  });
});

export const getPropertiesByCountry = catchAsync(async (req, res) => {
  const { userId, from, to } = req.query;
  const match = {};

  if (userId) {
    const objectId = toObjectId(userId);
    if (!objectId) {
      throw new AppError(httpStatus.BAD_REQUEST, "Invalid userId");
    }
    match.user = objectId;
  }

  const dateFilter = buildDateRangeFilter(from, to, "purchaseDate");
  if (dateFilter) Object.assign(match, dateFilter);

  const pipeline = [];
  if (Object.keys(match).length > 0) {
    pipeline.push({ $match: match });
  }

  pipeline.push(
    {
      $group: {
        _id: "$address.country",
        count: { $sum: 1 },
        totalPurchaseValue: { $sum: "$purchasePrice" },
        totalMortgageAmount: { $sum: { $ifNull: ["$mortgageAmount", 0] } },
        avgPurchasePrice: { $avg: "$purchasePrice" },
        totalMonthlyRent: { $sum: { $ifNull: ["$lease.monthlyRent", 0] } },
      },
    },
    {
      $project: {
        _id: 0,
        country: "$_id",
        count: 1,
        totalPurchaseValue: 1,
        totalMortgageAmount: 1,
        avgPurchasePrice: 1,
        totalMonthlyRent: 1,
      },
    },
    { $sort: { count: -1, country: 1 } }
  );

  const data = await Property.aggregate(pipeline);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Country wise properties fetched successfully",
    data,
  });
});

export const getAdminDashboardAnalytics = catchAsync(async (req, res) => {
  const now = new Date();
  const endDate = parseDate(req.query.to) || now;
  const startDate =
    parseDate(req.query.from) ||
    new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);

  const rangeStart = startDate <= endDate ? startDate : endDate;
  const rangeEnd = startDate <= endDate ? endDate : startDate;

  const rangeFilter = { $gte: rangeStart, $lte: rangeEnd };

  const [
    totalUsers,
    totalProperties,
    totalPayments,
    newUsers,
    newProperties,
    newPayments,
    paymentsByStatusRaw,
    propertiesByStatusRaw,
    paymentAmountsRaw,
    monthlyRevenueRaw,
  ] = await Promise.all([
    User.countDocuments({}),
    Property.countDocuments({}),
    Payment.countDocuments({}),
    User.countDocuments({ createdAt: rangeFilter }),
    Property.countDocuments({ createdAt: rangeFilter }),
    Payment.countDocuments({ createdAt: rangeFilter }),
    Payment.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]),
    Property.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]),
    Payment.aggregate([
      {
        $group: {
          _id: null,
          totalPaid: {
            $sum: {
              $cond: [{ $eq: ["$status", "Paid"] }, "$amount", 0],
            },
          },
          totalPending: {
            $sum: {
              $cond: [{ $eq: ["$status", "Pending"] }, "$amount", 0],
            },
          },
          totalOverdue: {
            $sum: {
              $cond: [{ $eq: ["$status", "Overdue"] }, "$amount", 0],
            },
          },
        },
      },
    ]),
    Payment.aggregate([
      {
        $match: {
          status: "Paid",
          paidDate: { $ne: null, ...rangeFilter },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$paidDate" },
            month: { $month: "$paidDate" },
          },
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
      {
        $project: {
          _id: 0,
          year: "$_id.year",
          month: "$_id.month",
          total: 1,
          count: 1,
        },
      },
    ]),
  ]);

  const paymentsByStatus = {
    Pending: 0,
    Paid: 0,
    Overdue: 0,
    Rejected: 0,
  };
  paymentsByStatusRaw.forEach((item) => {
    if (item?._id) paymentsByStatus[item._id] = item.count;
  });

  const propertiesByStatus = {
    Ready: 0,
    Plan: 0,
    "Off-Plan": 0,
  };
  propertiesByStatusRaw.forEach((item) => {
    if (item?._id) propertiesByStatus[item._id] = item.count;
  });

  const paymentAmounts = paymentAmountsRaw?.[0] || {
    totalPaid: 0,
    totalPending: 0,
    totalOverdue: 0,
  };

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Admin dashboard analytics fetched successfully",
    data: {
      range: { from: rangeStart, to: rangeEnd },
      totals: {
        users: totalUsers,
        properties: totalProperties,
        payments: totalPayments,
      },
      newInRange: {
        users: newUsers,
        properties: newProperties,
        payments: newPayments,
      },
      paymentsByStatus,
      propertiesByStatus,
      amounts: {
        totalPaid: paymentAmounts.totalPaid || 0,
        totalPending: paymentAmounts.totalPending || 0,
        totalOverdue: paymentAmounts.totalOverdue || 0,
      },
      monthlyRevenue: monthlyRevenueRaw,
    },
  });
});
