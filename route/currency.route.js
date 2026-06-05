import express from "express";
import { getCurrencyRates } from "../controller/currency.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/rates", protect, getCurrencyRates);

export default router;
