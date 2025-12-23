import httpStatus from "http-status";
import { SubscriptionPlan } from "../model/subcriptionPlan.model.js";
import { UserSubscription } from "../model/userSubcription.model.js";
import { User } from "../model/user.model.js";
import { Notification } from "../model/notification.model.js";
import { io } from "../server.js";
import AppError from "../errors/AppError.js";
import sendResponse from "../utils/sendResponse.js";
import catchAsync from "../utils/catchAsync.js";
import stripe from "stripe";
import { PaymentInfo } from "../model/payment.model.js";

const stripeInstance = stripe(process.env.STRIPE_SECRET_KEY);

export const getSubscriptionPlans = catchAsync(async (req, res) => {
  const plans = await SubscriptionPlan.find({ isActive: true }).sort({
    createdAt: -1,
  });
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Plans fetched successfully",
    data: plans,
  });
});

export const createSubscriptionPayment = catchAsync(async (req, res) => {
  const { planId, isYearly } = req.body;
  const userId = req.user._id;

  if (!planId) {
    throw new AppError(httpStatus.BAD_REQUEST, "Plan ID is required");
  }

  const plan = await SubscriptionPlan.findById(planId);
  if (!plan) {
    throw new AppError(httpStatus.NOT_FOUND, "Plan not found");
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const customer = await stripeInstance.customers.create({
    email: user.email,
    name: user.name,
  });

  const paymentIntent = await stripeInstance.paymentIntents.create({
    amount: Math.round(
      isYearly ? plan.priceYearly * 100 : plan.priceMonthly * 100
    ),
    currency: "usd",
    customer: customer.id,
    automatic_payment_methods: { enabled: true, allow_redirects: "never" },
    metadata: {
      userId: userId.toString(),
      planId: planId.toString(),
      isYearly: isYearly.toString(),
    },
  });

  // Save payment record as pending
  const subscriptionPayment = new PaymentInfo({
    userId,
    planId,
    price: isYearly ? plan.priceYearly : plan.priceMonthly,
    transactionId: paymentIntent.id,
    paymentStatus: "pending",
    isYearly,
    type: "subscription",
  });
  await subscriptionPayment.save();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Subscription payment intent created",
    data: {
      transactionId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      price: isYearly ? plan.priceYearly : plan.priceMonthly,
      customerId: customer.id,
    },
  });
});

export const confirmSubscriptionPayment = catchAsync(async (req, res) => {
  const { paymentIntentId, paymentMethodId } = req.body;
  const userId = req.user._id;

  if (!paymentIntentId || !paymentMethodId) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Both paymentIntentId and paymentMethodId are required."
    );
  }

  try {
    const paymentIntent = await stripeInstance.paymentIntents.confirm(
      paymentIntentId,
      { payment_method: paymentMethodId }
    );

    const subscriptionPayment = await PaymentInfo.findOne({
      transactionId: paymentIntentId,
      userId,
    }).populate("planId");

    if (!subscriptionPayment) {
      throw new AppError(httpStatus.NOT_FOUND, "Payment record not found.");
    }

    if (paymentIntent.status === "succeeded") {
      subscriptionPayment.paymentStatus = "complete";
      subscriptionPayment.paymentMethod = paymentIntent.payment_method_types[0];
      await subscriptionPayment.save();

      // Create UserSubscription on success
      const startDate = new Date();
      const endDate = new Date(startDate);
      if (subscriptionPayment.isYearly) {
        endDate.setFullYear(endDate.getFullYear() + 1);
      } else {
        endDate.setMonth(endDate.getMonth() + 1);
      }

      const userSub = await UserSubscription.create({
        user: userId,
        plan: subscriptionPayment.planId._id,
        startDate,
        endDate,
        status: "active",
        paymentMethod: "stripe",
        stripeSubscriptionId: paymentIntentId,
      });

      await User.findByIdAndUpdate(userId, {
        currentPlan: subscriptionPayment.planId.name,
        subscription: userSub._id,
      });

      // Notification for subscription purchase
      const user = await User.findById(userId);
      if (user.enableNotifications) {
        const newNotif = await Notification.create({
          user: userId,
          title: "Subscription Purchased",
          message: `Welcome to ${subscriptionPayment.planId.name} plan! Enjoy your new benefits.`,
          type: "subscription_update",
        });
        io.to(userId.toString()).emit("newNotification", newNotif);
      }

      return sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Subscription payment successful",
        data: {
          transactionId: paymentIntentId,
          planId: subscriptionPayment.planId._id,
          userSubId: userSub._id,
        },
      });
    } else {
      subscriptionPayment.paymentStatus = "failed";
      await subscriptionPayment.save();
      throw new AppError(httpStatus.BAD_REQUEST, "Payment failed.");
    }
  } catch (error) {
    console.error("Stripe confirm error:", error);
    throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, error.message);
  }
});
