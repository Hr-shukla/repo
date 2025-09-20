import express from 'express';
import { createPost, getFeedPosts, getUserPosts, updatePost, deletePost, likePost, commentOnPost } from '../controllers/post.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/feed', protect, getFeedPosts);
router.get('/user/:userId', protect, getUserPosts);
router.post('/', protect, createPost);
router.put('/:id', protect, updatePost);
router.delete('/:id', protect, deletePost);
router.post('/:id/like', protect, likePost);
router.post('/:id/comment', protect, commentOnPost);

export default router;
