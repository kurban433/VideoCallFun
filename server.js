const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Enhanced CORS configuration for production
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? [process.env.ALLOWED_ORIGIN || '*'] 
    : "*",
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

const io = socketIo(server, {
  cors: corsOptions,
  transports: ['websocket', 'polling'],
  allowEIO3: true
});

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Store connected users in memory
const connectedUsers = new Map();

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Handle user registration
  socket.on('register-user', (userName) => {
    console.log(`User registration: ${userName} (${socket.id})`);
    const user = {
      id: socket.id,
      name: userName,
      status: 'online'
    };
    
    connectedUsers.set(socket.id, user);
    
    // Send updated user list to all clients
    const users = Array.from(connectedUsers.values());
    console.log('Current users:', users.map(u => `${u.name} (${u.id})`));
    io.emit('user-list', users);
    
    console.log(`User ${userName} registered with ID: ${socket.id}`);
  });

  // Handle video call requests
  socket.on('call-user', (data) => {
    console.log('Call request received:', data);
    const { to, offer } = data;
    const caller = connectedUsers.get(socket.id);
    
    if (caller) {
      console.log(`Forwarding call from ${caller.name} to ${to}`);
      io.to(to).emit('call-made', {
        from: socket.id,
        fromName: caller.name,
        offer: offer
      });
    } else {
      console.log('Caller not found in connected users');
    }
  });

  // Handle call answers
  socket.on('make-answer', (data) => {
    console.log('Call answer received:', data);
    const { to, answer } = data;
    io.to(to).emit('answer-made', {
      from: socket.id,
      answer: answer
    });
  });

  // Handle ICE candidates
  socket.on('ice-candidate', (data) => {
    console.log('ICE candidate received:', data);
    const { to, candidate } = data;
    io.to(to).emit('ice-candidate', {
      from: socket.id,
      candidate: candidate
    });
  });

  // Handle call ending
  socket.on('call-ended', (data) => {
    console.log('Call ended:', data);
    const { to } = data;
    io.to(to).emit('call-ended', {
      from: socket.id
    });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    
    // Remove user from connected users
    const user = connectedUsers.get(socket.id);
    if (user) {
      console.log(`Removing user: ${user.name} (${socket.id})`);
    }
    connectedUsers.delete(socket.id);
    
    // Send updated user list to all clients
    const users = Array.from(connectedUsers.values());
    console.log('Updated users after disconnect:', users.map(u => `${u.name} (${u.id})`));
    io.emit('user-list', users);
  });
});

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

server.listen(PORT, () => {
  console.log(`🚀 Video Call Server started`);
  console.log(`📡 Environment: ${NODE_ENV}`);
  console.log(`🌐 Port: ${PORT}`);
  console.log(`🔗 Server URL: ${NODE_ENV === 'production' ? 'https://videocallfun-2.onrender.com' : `http://localhost:${PORT}`}`);
  console.log(`📱 WebRTC STUN servers: stun:stun.l.google.com:19302, stun:stun1.l.google.com:19302`);
}); 