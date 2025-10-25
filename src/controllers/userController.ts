import { Request, Response } from "express";

// Temporary in-memory user list (replace with a database later)
let users = [
  {
    id: 1,
    name: "John Doe",
    email: "john@example.com",
    otp: "123456",
    amount: 500,
  },
];

// @desc Get all users
// @route GET /api/users
export const getAllUsers = (req: Request, res: Response) => {
  res.json(users);
};

// @desc Get user credentials (id, name, email)
// @route GET /api/users/credentials
export const getUserCredentials = (req: Request, res: Response) => {
  const credentials = users.map(({ id, name, email }) => ({ id, name, email }));
  res.json(credentials);
};

// @desc Get all user OTPs
// @route GET /api/users/otp
export const getUserOtp = (req: Request, res: Response) => {
  const otps = users.map(({ id, otp }) => ({ id, otp }));
  res.json(otps);
};

// @desc Update user amount
// @route PUT /api/users/:id/amount
export const updateUserAmount = (req: Request, res: Response) => {
  const { id } = req.params;
  const { amount } = req.body;

  // Validate amount
  if (amount === undefined || isNaN(amount)) {
    return res.status(400).json({ message: "Invalid amount" });
  }

  const userIndex = users.findIndex((u) => u.id === Number(id));

  if (userIndex === -1) {
    return res.status(404).json({ message: "User not found" });
  }

  users[userIndex].amount = Number(amount);
  res.json(users[userIndex]);
};
