"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const userController_1 = require("../controllers/userController");
const router = (0, express_1.Router)();
// Get all users
router.get("/", userController_1.getAllUsers);
// Get user credentials
router.get("/credentials", userController_1.getUserCredentials);
// Get user OTPs
router.get("/otp", userController_1.getUserOtp);
// Update user amount
router.put("/:id/amount", userController_1.updateUserAmount);
exports.default = router;
