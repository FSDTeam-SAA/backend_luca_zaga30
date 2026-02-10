import express from "express";
import {
  getAdminUsers,
  getAdminPayments,
  getAdminProperties,
  getPropertiesByCountry,
  getAdminDashboardAnalytics,
} from "../controller/admin.controller.js";
import { protect, isAdmin } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect, isAdmin);

router.get("/users", getAdminUsers);
router.get("/payments", getAdminPayments);
router.get("/properties", getAdminProperties);
router.get("/properties/by-country", getPropertiesByCountry);
router.get("/dashboard", getAdminDashboardAnalytics);

export default router;
