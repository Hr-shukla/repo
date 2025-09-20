import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';

// Route imports
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import postRoutes from './routes/post.routes.js';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins for simplicity, restrict in production
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => console.error('MongoDB connection error:', err));


// Socket.IO for Messaging
const userSocketMap = {}; // {userId: socketId}

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  const userId = socket.handshake.query.userId;
  if (userId) {
    userSocketMap[userId] = socket.id;
  }

  // Listen for direct messages
  socket.on('directMessage', ({ recipientId, message }) => {
    const recipientSocketId = userSocketMap[recipientId];
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('newMessage', { senderId: userId, message });
    }
    // You would also save the message to the database here
  });
  
  // Handle group messaging similarly with rooms
  socket.on('joinGroup', (groupId) => {
    socket.join(groupId);
  });

  socket.on('groupMessage', ({ groupId, message }) => {
    socket.to(groupId).emit('newGroupMessage', { senderId: userId, message, groupId });
    // Save group message to DB
  });


  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    for (let id in userSocketMap) {
      if (userSocketMap[id] === socket.id) {
        delete userSocketMap[id];
        break;
      }
    }
  });
});


server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
