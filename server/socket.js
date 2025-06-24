const jwt = require('jsonwebtoken');
const User = require('./models/User');
const Message = require('./models/Message');

const connectedUsers = new Map();

const setupSocketHandlers = (io) => {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.user.id;
      next();
    } catch (err) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', async (socket) => {
    try {
      // Update user status to online
      await User.findByIdAndUpdate(socket.userId, { status: 'online' });
      connectedUsers.set(socket.userId, socket.id);

      // Notify all users about the new online user
      io.emit('user-status-change', {
        userId: socket.userId,
        status: 'online'
      });

      // Handle private messages
      socket.on('private-message', async (data) => {
        const receiverSocketId = connectedUsers.get(data.receiverId);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit('private-message', {
            ...data,
            senderId: socket.userId
          });
        }
      });

      // Handle typing status
      socket.on('typing', (data) => {
        const receiverSocketId = connectedUsers.get(data.receiverId);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit('typing', {
            senderId: socket.userId
          });
        }
      });

      // Handle stop typing
      socket.on('stop-typing', (data) => {
        const receiverSocketId = connectedUsers.get(data.receiverId);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit('stop-typing', {
            senderId: socket.userId
          });
        }
      });

      // Handle video call request
      socket.on('call-user', (data) => {
        const receiverSocketId = connectedUsers.get(data.receiverId);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit('incoming-call', {
            ...data,
            callerId: socket.userId
          });
        }
      });

      // Handle call accepted
      socket.on('call-accepted', (data) => {
        const callerSocketId = connectedUsers.get(data.callerId);
        if (callerSocketId) {
          io.to(callerSocketId).emit('call-accepted', {
            ...data,
            receiverId: socket.userId
          });
        }
      });

      // Handle call rejected
      socket.on('call-rejected', (data) => {
        const callerSocketId = connectedUsers.get(data.callerId);
        if (callerSocketId) {
          io.to(callerSocketId).emit('call-rejected', {
            ...data,
            receiverId: socket.userId
          });
        }
      });

      // Handle WebRTC signaling
      socket.on('webrtc-signal', (data) => {
        const receiverSocketId = connectedUsers.get(data.receiverId);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit('webrtc-signal', {
            ...data,
            senderId: socket.userId
          });
        }
      });

      // Handle disconnection
      socket.on('disconnect', async () => {
        try {
          await User.findByIdAndUpdate(socket.userId, { status: 'offline' });
          connectedUsers.delete(socket.userId);

          // Notify all users about the offline user
          io.emit('user-status-change', {
            userId: socket.userId,
            status: 'offline'
          });
        } catch (err) {
          console.error('Error handling disconnect:', err);
        }
      });
    } catch (err) {
      console.error('Error in socket connection:', err);
    }
  });
};

const socketHandler = (io, socket) => {
  // Store user socket mapping
  const userSockets = new Map();

  // Handle user connection
  socket.on('user:connect', async (userId) => {
    try {
      // Update user status
      await User.findByIdAndUpdate(userId, {
        status: 'online',
        lastSeen: new Date()
      });

      // Store socket mapping
      userSockets.set(userId, socket.id);

      // Broadcast user online status
      io.emit('user:status', {
        userId,
        status: 'online'
      });
    } catch (error) {
      console.error('Error in user:connect:', error);
    }
  });

  // Handle private messages
  socket.on('message:send', async (data) => {
    try {
      const { receiverId, content, type, fileUrl, fileName } = data;
      const senderId = socket.userId;

      const message = new Message({
        sender: senderId,
        receiver: receiverId,
        content,
        type,
        fileUrl,
        fileName
      });

      await message.save();

      const populatedMessage = await message
        .populate('sender', 'name avatar')
        .populate('receiver', 'name avatar');

      // Send to receiver if online
      const receiverSocketId = userSockets.get(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('message:receive', populatedMessage);
      }

      // Send confirmation to sender
      socket.emit('message:sent', populatedMessage);
    } catch (error) {
      console.error('Error in message:send:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Handle typing status
  socket.on('typing:start', (data) => {
    const { receiverId } = data;
    const receiverSocketId = userSockets.get(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('typing:start', {
        userId: socket.userId
      });
    }
  });

  socket.on('typing:stop', (data) => {
    const { receiverId } = data;
    const receiverSocketId = userSockets.get(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('typing:stop', {
        userId: socket.userId
      });
    }
  });

  // Handle video call requests
  socket.on('call:request', (data) => {
    const { receiverId, offer } = data;
    const receiverSocketId = userSockets.get(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('call:request', {
        callerId: socket.userId,
        offer
      });
    }
  });

  socket.on('call:answer', (data) => {
    const { callerId, answer } = data;
    const callerSocketId = userSockets.get(callerId);
    if (callerSocketId) {
      io.to(callerSocketId).emit('call:answer', {
        answer
      });
    }
  });

  socket.on('call:ice-candidate', (data) => {
    const { receiverId, candidate } = data;
    const receiverSocketId = userSockets.get(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('call:ice-candidate', {
        candidate
      });
    }
  });

  // Handle disconnection
  socket.on('disconnect', async () => {
    try {
      const userId = socket.userId;
      if (userId) {
        // Update user status
        await User.findByIdAndUpdate(userId, {
          status: 'offline',
          lastSeen: new Date()
        });

        // Remove socket mapping
        userSockets.delete(userId);

        // Broadcast user offline status
        io.emit('user:status', {
          userId,
          status: 'offline'
        });
      }
    } catch (error) {
      console.error('Error in disconnect:', error);
    }
  });
};

module.exports = { setupSocketHandlers, socketHandler }; 