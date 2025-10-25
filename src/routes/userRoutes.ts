import { Router } from "express";
import {
  getAllUsers,
  getUserCredentials,
  getUserOtp,
  updateUserAmount,
} from "../controllers/userController";

const router = Router();

// Get all users
router.get("/", getAllUsers);

// Get user credentials
router.get("/credentials", getUserCredentials);

// Get user OTPs
router.get("/otp", getUserOtp);

// Update user amount
router.put("/:id/amount", updateUserAmount);

export default router;
