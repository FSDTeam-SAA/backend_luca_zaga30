import mongoose, { Schema } from "mongoose";

const paymentSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    property: {
      type: Schema.Types.ObjectId,
      ref: "Property",
      required: true,
    },
    type: {
      type: String,
      enum: [
        "Mortgage Payment",
        "Home Payment",
        "Rent Due",
        "Bill",
        "Service Charge",
        "AC Bills",
        "Water/Electricity Bills",
        "Gas Bills",
      ],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    dueDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["Pending", "Paid", "Overdue", "Rejected"],
      default: "Pending",
    },
    receiverName: {
      type: String,
      required: true,
    },
    bank: {
      type: String,
    },
    accountNumber: {
      type: String,
    },
    proofFiles: [
      {
        public_id: { type: String },
        url: { type: String },
      },
    ],
    paidDate: {
      type: Date,
    },
    notes: {
      type: String,
    },
  },
  { timestamps: true }
);

export const Payment = mongoose.model("Payment", paymentSchema);
