import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import { Server as SocketServer } from 'socket.io';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, 'data.json');
const DIST_DIR = path.resolve(__dirname, '..', 'dist');

const app = express();
const server = http.createServer(app);
const io = new SocketServer(server, {
  cors: { origin: '*' }
});
const PORT = 3001;

const userToSocket = new Map();
const socketToUser = new Map();

app.use(cors());
app.use(express.json());

// Initialize DB if doesn't exist
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({ users: {}, messages: [] }));
}

const getDb = () => JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
const saveDb = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
const sanitizeFileName = (name) => {
  if (typeof name !== 'string') return 'payload';
  const cleaned = name.replace(/[\x00-\x1F\x7F]/g, '').replace(/[\\/]/g, '-').trim();
  return cleaned.slice(0, 200) || 'payload';
};

const emitPresence = () => {
  io.emit('presence_update', { onlineUsers: Array.from(userToSocket.keys()) });
};

const createMessage = ({
  senderId,
  receiverId,
  encryptedContent,
  secretKeyHash,
  ttlMinutes,
  type,
  fileName,
  fileType,
  fileSize
}) => {
  const allowedTypes = new Set(['text', 'image', 'video', 'audio', 'file']);
  const normalizedType = allowedTypes.has(type) ? type : 'text';
  const maxFileSize = 10 * 1024 * 1024;
  const maxNameLength = 200;
  const maxTypeLength = 100;

  if (!senderId || !receiverId || !encryptedContent || !secretKeyHash || !ttlMinutes) {
    throw new Error('Missing fields');
  }

  if (normalizedType !== 'text') {
    if (!fileName || !fileType || !fileSize) {
      throw new Error('Missing file metadata');
    }
    if (typeof fileName !== 'string' || fileName.length > maxNameLength) {
      throw new Error('Invalid file name');
    }
    if (typeof fileType !== 'string' || fileType.length > maxTypeLength) {
      throw new Error('Invalid file type');
    }
    if (!Number.isFinite(Number(fileSize)) || Number(fileSize) <= 0) {
      throw new Error('Invalid file size');
    }
    if (Number(fileSize) > maxFileSize) {
      throw new Error('File too large');
    }
  }

  return {
    id: crypto.randomUUID(),
    senderId,
    receiverId,
    type: normalizedType,
    encryptedContent,
    fileName: fileName ? sanitizeFileName(fileName) : undefined,
    fileType: fileType || undefined,
    fileSize: fileSize || undefined,
    secretKeyHash,
    expiryTime: Date.now() + ttlMinutes * 60 * 1000,
    createdAt: Date.now()
  };
};

// Auth Routes
app.post('/api/register', async (req, res) => {
  const { userId, password } = req.body;
  if (!userId || !password) return res.status(400).json({ error: 'Missing fields' });

  const db = getDb();
  if (db.users[userId]) return res.status(400).json({ error: 'User already exists' });

  const hash = await bcrypt.hash(password, 10);
  db.users[userId] = { hash };
  saveDb(db);
  
  res.status(201).json({ message: 'User registered' });
});

app.post('/api/login', async (req, res) => {
  const { userId, password } = req.body;
  const db = getDb();
  
  const user = db.users[userId];
  if (!user || !(await bcrypt.compare(password, user.hash))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  res.status(200).json({ message: 'Login successful', userId });
});

app.get('/api/users', (req, res) => {
  const db = getDb();
  // Don't send hashes back
  const userIds = Object.keys(db.users);
  res.json({ users: userIds });
});

// Messages Routes
app.get('/api/messages/:userId', (req, res) => {
  const { userId } = req.params;
  const db = getDb();
  const now = Date.now();
  
  // Clean up expired messages everywhere
  let hasExpired = false;
  db.messages = db.messages.filter(m => {
    if (m.expiryTime <= now) {
      hasExpired = true;
      return false;
    }
    return true;
  });
  if (hasExpired) saveDb(db);

  // Return both messages sent TO the user AND sent BY the user to enable two-way chat view!
  const userMessages = db.messages.filter(m => m.receiverId === userId || m.senderId === userId);
  res.json({ messages: userMessages });
});

app.post('/api/messages', (req, res) => {
  try {
    const newMessage = createMessage(req.body);
    const db = getDb();
    db.messages.push(newMessage);
    saveDb(db);

    const receiverSocket = userToSocket.get(newMessage.receiverId);
    if (receiverSocket) io.to(receiverSocket).emit('receive_message', newMessage);
    const senderSocket = userToSocket.get(newMessage.senderId);
    if (senderSocket) io.to(senderSocket).emit('receive_message', newMessage);

    res.status(201).json({ message: 'Message sent', data: newMessage });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Invalid payload' });
  }
});

app.delete('/api/messages/:messageId', (req, res) => {
  const { messageId } = req.params;
  const db = getDb();
  
  const originalLength = db.messages.length;
  db.messages = db.messages.filter(m => m.id !== messageId);
  
  if (db.messages.length < originalLength) {
    saveDb(db);
    res.json({ message: 'Message deleted' });
  } else {
    res.status(404).json({ error: 'Message not found' });
  }
});

// Serve frontend from the same server when a build is available.
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
} else {
  console.warn('No dist folder found. Run "npm run build" to serve frontend from this server.');
}

io.on('connection', (socket) => {
  socket.on('register', ({ userId }) => {
    if (!userId) return;
    userToSocket.set(userId, socket.id);
    socketToUser.set(socket.id, userId);
    emitPresence();
  });

  socket.on('send_message', (payload, ack) => {
    try {
      const newMessage = createMessage(payload);
      const db = getDb();
      db.messages.push(newMessage);
      saveDb(db);

      const receiverSocket = userToSocket.get(newMessage.receiverId);
      if (receiverSocket) io.to(receiverSocket).emit('receive_message', newMessage);
      const senderSocket = userToSocket.get(newMessage.senderId);
      if (senderSocket) io.to(senderSocket).emit('receive_message', newMessage);

      if (ack) ack({ ok: true, data: newMessage });
    } catch (err) {
      if (ack) ack({ ok: false, error: err.message || 'Invalid payload' });
    }
  });

  socket.on('typing', ({ fromUserId, toUserId }) => {
    const receiverSocket = userToSocket.get(toUserId);
    if (receiverSocket) io.to(receiverSocket).emit('typing', { fromUserId });
  });

  socket.on('stop_typing', ({ fromUserId, toUserId }) => {
    const receiverSocket = userToSocket.get(toUserId);
    if (receiverSocket) io.to(receiverSocket).emit('stop_typing', { fromUserId });
  });

  socket.on('disconnect', () => {
    const userId = socketToUser.get(socket.id);
    if (userId) {
      userToSocket.delete(userId);
      socketToUser.delete(socket.id);
      emitPresence();
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Shadow Cipher server listening on http://localhost:${PORT}`);
});
