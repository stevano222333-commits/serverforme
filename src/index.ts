import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import userRoutes from "./routes/userRoutes"; // ✅ make sure this default import matches your export

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ✅ This must be a router, not an object
app.use("/api/users", userRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
