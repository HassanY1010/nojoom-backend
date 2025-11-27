import express from "express";
import { sendResetCode, verifyResetCode, resetPassword } from "../controllers/resetPasswordController.js";

const router = express.Router();

router.post("/forgot", sendResetCode);
router.post("/verify", verifyResetCode);
router.post("/reset", resetPassword);

export default router;
