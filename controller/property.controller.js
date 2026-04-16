import httpStatus from "http-status";
import { Property } from "../model/property.model.js";
import { uploadOnCloudinary } from "../utils/commonMethod.js";
import AppError from "../errors/AppError.js";
import sendResponse from "../utils/sendResponse.js";
import catchAsync from "../utils/catchAsync.js";

// Get all properties
export const getProperties = catchAsync(async (req, res) => {
  const {
    search,
    propertyType,
    status,
    country,
    sort = "-createdAt",
  } = req.query;

  let query = { user: req.user._id };

  if (search && search.trim() !== "") {
    const searchRegex = { $regex: search.trim(), $options: "i" };

    query.$or = [
      { name: searchRegex },
      { "address.city": searchRegex },
      { "address.country": searchRegex },
    ];
  }

  // Filter by propertyType
  if (propertyType) {
    query.propertyType = { $regex: new RegExp(propertyType, "i") };
  }

  // Filter by status
  if (status) {
    query.status = { $regex: new RegExp(status, "i") };
  }

  // Filter by country
  if (country) {
    query["address.country"] = { $regex: new RegExp(country, "i") };
  }

  // Build sort object
  let sortOption = {};
  if (sort) {
    if (sort.startsWith("-")) {
      sortOption[sort.slice(1)] = -1;
    } else {
      sortOption[sort] = 1;
    }
  }

  const properties = await Property.find(query).sort(
    sortOption || { createdAt: -1 },
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Properties fetched successfully",
    data: properties,
    meta: {
      total: properties.length,
      filtersApplied: !!search || !!propertyType || !!status || !!country,
    },
  });
});

// Add a new property
export const addProperty = catchAsync(async (req, res) => {
  const {
    name,
    address,
    propertyType,
    yearBuilt,
    monthBuilt,
    squareFoot,
    bedrooms,
    status,
    hasMortgage,
    mortgageAmount,
    interestRate,
    monthlyInstallment,
    installmentPaid,
    purchasePrice,
    purchaseDate,
    ownershipPercentage,
    lease,
  } = req.body;

  let parsedAddress = {};
  let parsedLease = undefined;

  if (address) {
    try {
      parsedAddress = JSON.parse(address);
    } catch (e) {
      throw new AppError(httpStatus.BAD_REQUEST, "Invalid address format");
    }
  }

  if (lease) {
    try {
      parsedLease = JSON.parse(lease);
    } catch (e) {
      throw new AppError(httpStatus.BAD_REQUEST, "Invalid lease format");
    }
  }

  const property = await Property.create({
    user: req.user._id,
    name,
    address: parsedAddress,
    propertyType,
    yearBuilt: yearBuilt ? Number(yearBuilt) : undefined,
    monthBuilt: monthBuilt ? Number(monthBuilt) : undefined,
    squareFoot: squareFoot ? Number(squareFoot) : undefined,
    bedrooms: bedrooms ? Number(bedrooms) : undefined,
    status: status || "Ready",
    hasMortgage: hasMortgage === "true" || hasMortgage === true,
    mortgageAmount: mortgageAmount ? Number(mortgageAmount) : undefined,
    interestRate: interestRate ? Number(interestRate) : undefined,
    monthlyInstallment: monthlyInstallment
      ? Number(monthlyInstallment)
      : undefined,
    installmentPaid: installmentPaid ? Number(installmentPaid) : 0,
    purchasePrice: Number(purchasePrice),
    purchaseDate,
    ownershipPercentage: ownershipPercentage
      ? Number(ownershipPercentage)
      : 100,
    lease: parsedLease,
    photos: [],
    documents: [],
  });

  // upload photos
  if (req.files && req.files.photos && req.files.photos.length > 0) {
    const photoUploads = req.files.photos.map((file) =>
      uploadOnCloudinary(file.buffer, {
        resource_type: "image",
        folder: "properties/photos",
      }),
    );
    const photoResults = await Promise.all(photoUploads);

    property.photos = photoResults.map((result) => ({
      public_id: result.public_id,
      url: result.secure_url,
    }));
  }

  // upload documents
  if (req.files && req.files.documents && req.files.documents.length > 0) {
    const docUploads = req.files.documents.map((file) =>
      uploadOnCloudinary(file.buffer, {
        resource_type: "raw",
        folder: "properties/documents",
      }),
    );
    const docResults = await Promise.all(docUploads);

    property.documents = docResults.map((result) => ({
      public_id: result.public_id,
      url: result.secure_url,
    }));
  }

  await property.save();

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Property added successfully",
    data: property,
  });
});

export const updateProperty = catchAsync(async (req, res) => {
  const { propertyId } = req.params;

  const property = await Property.findOne({
    _id: propertyId,
    user: req.user._id,
  });

  if (!property) {
    throw new AppError(httpStatus.NOT_FOUND, "Property not found");
  }

  const {
    name,
    address,
    propertyType,
    yearBuilt,
    monthBuilt,
    squareFoot,
    bedrooms,
    status,
    hasMortgage,
    mortgageAmount,
    interestRate,
    monthlyInstallment,
    installmentPaid,
    purchasePrice,
    purchaseDate,
    ownershipPercentage,
    lease,
  } = req.body;

  // ---------- Parse Address ----------
  if (address) {
    try {
      property.address =
        typeof address === "string" ? JSON.parse(address) : address;
    } catch (e) {
      throw new AppError(httpStatus.BAD_REQUEST, "Invalid address format");
    }
  }

  // ---------- Parse Lease ----------
  if (lease) {
    try {
      property.lease =
        typeof lease === "string" ? JSON.parse(lease) : lease;
    } catch (e) {
      throw new AppError(httpStatus.BAD_REQUEST, "Invalid lease format");
    }
  }

  // ---------- Update Fields ----------
  if (name !== undefined) property.name = name;
  if (propertyType !== undefined) property.propertyType = propertyType;
  if (yearBuilt !== undefined) property.yearBuilt = Number(yearBuilt);
  if (monthBuilt !== undefined) property.monthBuilt = Number(monthBuilt);
  if (squareFoot !== undefined) property.squareFoot = Number(squareFoot);
  if (bedrooms !== undefined) property.bedrooms = Number(bedrooms);
  if (status !== undefined) property.status = status;

  if (hasMortgage !== undefined) {
    property.hasMortgage = hasMortgage === "true" || hasMortgage === true;
  }

  if (mortgageAmount !== undefined)
    property.mortgageAmount = Number(mortgageAmount);

  if (interestRate !== undefined)
    property.interestRate = Number(interestRate);

  if (monthlyInstallment !== undefined)
    property.monthlyInstallment = Number(monthlyInstallment);

  if (installmentPaid !== undefined)
    property.installmentPaid = Number(installmentPaid);

  if (purchasePrice !== undefined)
    property.purchasePrice = Number(purchasePrice);

  if (purchaseDate !== undefined)
    property.purchaseDate = purchaseDate;

  if (ownershipPercentage !== undefined)
    property.ownershipPercentage = Number(ownershipPercentage);

  // ---------- Upload New Photos ----------
  if (req.files?.photos?.length > 0) {
    const photoUploads = req.files.photos.map((file) =>
      uploadOnCloudinary(file.buffer, {
        resource_type: "image",
        folder: "properties/photos",
      }),
    );

    const photoResults = await Promise.all(photoUploads);

    property.photos.push(
      ...photoResults.map((result) => ({
        public_id: result.public_id,
        url: result.secure_url,
      })),
    );
  }

  // ---------- Upload New Documents ----------
  if (req.files?.documents?.length > 0) {
    const docUploads = req.files.documents.map((file) =>
      uploadOnCloudinary(file.buffer, {
        resource_type: "raw",
        folder: "properties/documents",
      }),
    );

    const docResults = await Promise.all(docUploads);

    property.documents.push(
      ...docResults.map((result) => ({
        public_id: result.public_id,
        url: result.secure_url,
      })),
    );
  }

  await property.save();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Property updated successfully",
    data: property,
  });
});


// get single property details
export const getPropertyDetails = catchAsync(async (req, res) => {
  const propertyId = req.params.id;
  const property = await Property.findById(propertyId).populate(
    "user ",
    "name email phone avatar",
  );
  if (!property) {
    throw new AppError(httpStatus.NOT_FOUND, "Property not found");
  }
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Property details fetched successfully",
    data: property,
  });
});

// Delete property details
export const deletePropertyDetails = catchAsync(async (req, res) => {
  const propertyId = req.params.id;
  const property = await Property.findByIdAndDelete(propertyId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Property Deleted successfully",
    data: "",
  });
});

