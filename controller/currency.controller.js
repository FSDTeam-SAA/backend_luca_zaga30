import httpStatus from "http-status";
import sendResponse from "../utils/sendResponse.js";
import catchAsync from "../utils/catchAsync.js";
import AppError from "../errors/AppError.js";

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const SUPPORTED_CURRENCIES = ["USD", "EUR", "GBP", "AED", "INR", "BDT", "JPY", "CNY", "BTC"];

let _ratesCache = null;
let _cacheTimestamp = null;

export const getCurrencyRates = catchAsync(async (req, res) => {
  const now = Date.now();

  if (_ratesCache && _cacheTimestamp && now - _cacheTimestamp < CACHE_TTL_MS) {
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Currency rates fetched successfully",
      data: { rates: _ratesCache, base: "USD", cached: true },
    });
  }

  const apiKey = process.env.OPEN_EXCHANGE_RATE_KEY;
  if (!apiKey) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Exchange rate API key not configured on server"
    );
  }

  const url = `https://openexchangerates.org/api/latest.json?app_id=${apiKey}&symbols=${SUPPORTED_CURRENCIES.join(",")}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new AppError(
      httpStatus.BAD_GATEWAY,
      `Failed to fetch exchange rates: ${response.statusText}`
    );
  }

  const json = await response.json();

  if (!json.rates) {
    throw new AppError(httpStatus.BAD_GATEWAY, "Invalid exchange rates response from provider");
  }

  _ratesCache = json.rates;
  _cacheTimestamp = now;

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Currency rates fetched successfully",
    data: { rates: _ratesCache, base: "USD", cached: false },
  });
});
