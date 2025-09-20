import express from 'express';
import { registerUser, loginUser, generateImage } from '../controllers/auth.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/generate-image', protect, generateImage);

export default router;
