import express from "express";
import {
  getPayments,
  addPayment,
  updatePaymentStatus,
} from "../controller/payment.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import upload from "../middleware/multer.middleware.js";

const router = express.Router();

const uploadProof = upload.array("proofFiles", 5);

router.get("/", protect, getPayments);
router.post("/add", protect, uploadProof, addPayment);
router.patch("/:id/status", protect, updatePaymentStatus);

export default router;
