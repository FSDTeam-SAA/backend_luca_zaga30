import express from "express";

import authRoute from "../route/auth.route.js";
import userRoute from "../route/user.route.js";
import subscriptionRoute from "../route/subcription.route.js";
import notificationRoute from "../route/notification.route.js";
import propertyRoute from "../route/property.route.js";

const router = express.Router();

// Mounting the routes
router.use("/auth", authRoute);
router.use("/user", userRoute);
router.use("/subscription", subscriptionRoute);
router.use("/notifications", notificationRoute);
router.use("/properties", propertyRoute);

export default router;
