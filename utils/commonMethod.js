import crypto from "crypto";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { v2 as cloudinary } from "cloudinary";
import { Notification } from "../model/notification.model.js";

// Generate a random OTP
export const generateOTP = () => {
  const OTP_LENGTH = 6;
  const otp = Array.from({ length: OTP_LENGTH }, () =>
    crypto.randomInt(0, 9)
  ).join("");
  return otp;
};

//Generate unique ID
export const generateUniqueId = () => {
  const timestamp = Date.now().toString(36); // Convert current timestamp to base36 string
  const randomPart = Math.random().toString(36).substr(2, 6); // Get 6 random characters

  const uniquePart = timestamp + randomPart;
  const uniqueId = uniquePart.substring(0, 8);

  return `BK${uniqueId}`;
};

//password hashing
export const hashPassword = async (newPassword) => {
  const salt = await bcrypt.genSalt(Number.parseInt(10));
  const hashedPassword = await bcrypt.hash(newPassword, salt);
  return Promise.resolve(hashedPassword);
};

export const uniqueTransactionId = () => {
  return uuidv4().replace(/-/g, "").substr(0, 12).toUpperCase();
};

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const uploadOnCloudinary = (fileData, options = {}) => {
  return new Promise((resolve, reject) => {
    let buffer = fileData;

    if (buffer instanceof ArrayBuffer) {
      buffer = Buffer.from(buffer);
    }

    if (ArrayBuffer.isView(buffer)) {
      buffer = Buffer.from(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    }

    if (buffer?.buffer && Buffer.isBuffer(buffer.buffer)) {
      buffer = buffer.buffer;
    }

    if (!Buffer.isBuffer(buffer)) {
      return reject(
        new TypeError(
          "uploadOnCloudinary expected Buffer/ArrayBuffer/TypedArray"
        )
      );
    }

    const stream = cloudinary.uploader.upload_stream(
      { ...options },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    stream.end(buffer);
  });
};

export const uploadMultipleOnCloudinary = async (files) => {
  if (!files || files.length === 0) return [];

  const uploadPromises = files.map((file) => uploadOnCloudinary(file.buffer));

  const results = await Promise.all(uploadPromises);

  return results.map((result) => ({
    public_id: result.public_id,
    secure_url: result.secure_url,
  }));
};

export const createNotification = async ({
  user,
  title,
  message,
  type,
  relatedId = null,
  relatedModel = null,
}) => {
  await Notification.create({
    user,
    title,
    message,
    type,
    relatedId,
    relatedModel,
  });
};
