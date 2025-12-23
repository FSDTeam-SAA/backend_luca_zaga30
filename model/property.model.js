import mongoose, { Schema } from "mongoose";

const propertySchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    address: {
      country: { type: String, required: true },
      city: { type: String, required: true },
    },
    propertyType: {
      type: String,
      required: true,
    },
    yearBuilt: {
      type: Number,
    },
    monthBuilt: {
      type: Number,
    },
    squareFoot: {
      type: Number,
    },
    bedrooms: {
      type: Number,
    },
    status: {
      type: String,
      enum: ["Off-Plan", "Plan", "Ready"],
      default: "Ready",
    },
    hasMortgage: {
      type: Boolean,
      default: false,
    },
    mortgageAmount: {
      type: Number,
    },
    interestRate: {
      type: Number,
    },
    monthlyInstallment: {
      type: Number,
    },
    installmentPaid: {
      type: Number,
      default: 0,
    },
    purchasePrice: {
      type: Number,
      required: true,
    },
    purchaseDate: {
      type: Date,
      required: true,
    },
    ownershipPercentage: {
      type: Number,
      default: 100,
      min: 1,
      max: 100,
    },
    lease: {
      tenantName: { type: String },
      startDate: { type: Date },
      endDate: { type: Date },
      monthlyRent: { type: Number },
      serviceCharges: { type: Number },
    },
    photos: [
      {
        public_id: { type: String, default: "" },
        url: { type: String, default: "" },
      },
    ],
    documents: [
      {
        public_id: { type: String, default: "" },
        url: { type: String, default: "" },
      },
    ],
  },
  { timestamps: true }
);

export const Property = mongoose.model("Property", propertySchema);
