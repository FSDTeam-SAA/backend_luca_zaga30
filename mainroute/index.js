import express from "express";

import authRoute from "../route/auth.route.js";
import userRoute from "../route/user.route.js";
import notificationRoute from "../route/notification.route.js";
import propertyRoute from "../route/property.route.js";
import paymentRoute from "../route/payment.route.js";

const router = express.Router();

// Mounting the routes
router.use("/auth", authRoute);
router.use("/user", userRoute);
router.use("/notifications", notificationRoute);
router.use("/properties", propertyRoute);
router.use("/payments", paymentRoute);

export default router;
