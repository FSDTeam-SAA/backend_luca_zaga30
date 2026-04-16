import express from "express";
import {
  getProperties,
  updateProperty,
  getPropertyDetails,
  addProperty,
  deletePropertyDetails
} from "../controller/property.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import upload from "../middleware/multer.middleware.js";

const router = express.Router();

const uploadFields = upload.fields([
  { name: "photos", maxCount: 10 },
  { name: "documents", maxCount: 10 },
]);

router.get("/", protect, getProperties);
router.get("/:propertyId", protect, getPropertyDetails);
router.delete("/:propertyId", protect, deletePropertyDetails);
router.put("/:propertyId", protect, uploadFields, updateProperty);
router.post("/add", protect, uploadFields, addProperty);

export default router;
