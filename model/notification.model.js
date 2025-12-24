import mongoose, { Schema } from "mongoose";

const notificationSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: [
        "Home payment",
        "Mortgage Payment",
        "Rents Income",
        "Bill",
        "Water/Electricity Bills",
        "AC Bills",
        "Gas Bills",
        "Property Type",
        "Rent Due",
        "Payment Reminder",
        "Payment Received",
      ],
      required: true,
    },
    relatedId: {
      type: Schema.Types.ObjectId,
      refPath: "relatedModel",
    },
    relatedModel: {
      type: String,
      enum: ["Payment", "Property"],
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, isRead: 1 });

export const Notification = mongoose.model("Notification", notificationSchema);
