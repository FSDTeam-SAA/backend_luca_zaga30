import express from "express";
import {
  getNotifications,
  markNotification,
  markAllAsRead,
  deleteNotification,
} from "../controller/notification.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/", protect, getNotifications);
router.patch("/:id/mark", protect, markNotification);
router.patch("/mark-all-read", protect, markAllAsRead);
router.delete("/:id", protect, deleteNotification);

export default router;
