import crypto from 'crypto';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import { Server as SocketServer } from 'socket.io';
import {
  createCorsOriginValidator,
  createRateLimiter,
  extractBearerToken,
  isValidUserId,
  parseAllowedOrigins,
  readOwnUser,
  resolveSessionSecret,
  signAuthToken,
  verifyAuthToken,
} from './security.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, 'data.json');
const DIST_DIR = path.resolve(__dirname, '..', 'dist');

const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || '127.0.0.1';
const SESSION_SECRET = resolveSessionSecret(process.env);
const ALLOWED_ORIGINS = parseAllowedOrigins(process.env.CORS_ALLOWED_ORIGINS, process.env.NODE_ENV);
const corsOriginValidator = createCorsOriginValidator(ALLOWED_ORIGINS);
const authRateLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, maxRequests: 30 });

const app = express();
app.disable('x-powered-by');
const server = http.createServer(app);
const io = new SocketServer(server, {
  cors: {
    origin: corsOriginValidator,
    methods: ['GET', 'POST', 'DELETE'],
  },
});

const userSockets = new Map();

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self)');
  next();
});

app.use(
  cors({
    origin: corsOriginValidator,
    methods: ['GET', 'POST', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json({ limit: '20mb' }));

if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({ users: {}, messages: [] }, null, 2));
}

const getDb = () => JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
const saveDb = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));

const sanitizeFileName = (name) => {
  if (typeof name !== 'string') return 'payload';
  const cleaned = Array.from(name)
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code > 31 && code !== 127;
    })
    .join('')
    .replace(/[\\/]/g, '-')
    .trim();
  return cleaned.slice(0, 200) || 'payload';
};

const emitPresence = () => {
  io.emit('presence_update', { onlineUsers: Array.from(userSockets.keys()) });
};

const enforceAuthRateLimit = (req, res, next) => {
  const clientKey = req.ip || req.socket?.remoteAddress || 'unknown';
  const status = authRateLimiter(clientKey);
  if (!status.allowed) {
    return res.status(429).json({ error: 'Too many authentication attempts. Please try again later.' });
  }
  next();
};

const requireAuth = (req, res, next) => {
  const token = extractBearerToken(req.headers.authorization);
  const claims = verifyAuthToken(token, SESSION_SECRET);
  if (!claims) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const db = getDb();
  if (!readOwnUser(db.users, claims.sub)) {
    return res.status(401).json({ error: 'Invalid session user' });
  }
  req.authUserId = claims.sub;
  next();
};

export const createMessage = ({
  senderId,
  receiverId,
  encryptedContent,
  secretKeyHash,
  ttlMinutes,
  type,
  fileName,
  fileType,
  fileSize,
}) => {
  const allowedTypes = new Set(['text', 'image', 'video', 'audio', 'file']);
  const normalizedType = allowedTypes.has(type) ? type : 'text';
  const maxFileSize = 10 * 1024 * 1024;
  const maxNameLength = 200;
  const maxTypeLength = 100;
  const numericTtl = Number(ttlMinutes);

  if (
    !isValidUserId(senderId) ||
    !isValidUserId(receiverId) ||
    typeof encryptedContent !== 'string' ||
    !encryptedContent ||
    typeof secretKeyHash !== 'string' ||
    !secretKeyHash ||
    !Number.isFinite(numericTtl) ||
    numericTtl <= 0 ||
    numericTtl > 10080
  ) {
    throw new Error('Missing or invalid message fields');
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
    fileSize: fileSize ? Number(fileSize) : undefined,
    secretKeyHash,
    expiryTime: Date.now() + numericTtl * 60 * 1000,
    createdAt: Date.now(),
  };
};

// Auth Routes
app.post('/api/register', enforceAuthRateLimit, async (req, res) => {
  const rawUserId = typeof req.body?.userId === 'string' ? req.body.userId.trim() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!isValidUserId(rawUserId)) {
    return res.status(400).json({ error: 'Operative ID must be 3-32 characters (letters, numbers, ., _, -).' });
  }
  if (password.length < 8 || password.length > 128) {
    return res.status(400).json({ error: 'Passphrase must be between 8 and 128 characters.' });
  }

  const db = getDb();
  if (readOwnUser(db.users, rawUserId)) {
    return res.status(400).json({ error: 'User already exists' });
  }

  const hash = await bcrypt.hash(password, 10);
  db.users[rawUserId] = { hash };
  saveDb(db);

  res.status(201).json({ message: 'User registered', userId: rawUserId });
});

app.post('/api/login', enforceAuthRateLimit, async (req, res) => {
  const rawUserId = typeof req.body?.userId === 'string' ? req.body.userId.trim() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!isValidUserId(rawUserId) || !password) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const db = getDb();
  const user = readOwnUser(db.users, rawUserId);
  if (!user || !(await bcrypt.compare(password, user.hash))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = signAuthToken(rawUserId, SESSION_SECRET);
  res.status(200).json({ message: 'Login successful', userId: rawUserId, token });
});

app.get('/api/users', requireAuth, (req, res) => {
  const db = getDb();
  const userIds = Object.keys(db.users);
  res.json({ users: userIds });
});

// Messages Routes
app.get('/api/messages/:userId', requireAuth, (req, res) => {
  const { userId } = req.params;
  if (userId !== req.authUserId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const db = getDb();
  const now = Date.now();

  let hasExpired = false;
  db.messages = db.messages.filter((m) => {
    if (m.expiryTime <= now) {
      hasExpired = true;
      return false;
    }
    return true;
  });
  if (hasExpired) saveDb(db);

  const userMessages = db.messages.filter(
    (m) => m.receiverId === req.authUserId || m.senderId === req.authUserId
  );
  res.json({ messages: userMessages });
});

app.post('/api/messages', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const receiverId = typeof req.body?.receiverId === 'string' ? req.body.receiverId.trim() : '';
    if (!readOwnUser(db.users, receiverId)) {
      return res.status(400).json({ error: 'Unknown recipient' });
    }

    const newMessage = createMessage({
      ...req.body,
      senderId: req.authUserId,
      receiverId,
    });
    db.messages.push(newMessage);
    saveDb(db);

    io.to(`user:${newMessage.receiverId}`).emit('receive_message', newMessage);
    io.to(`user:${newMessage.senderId}`).emit('receive_message', newMessage);

    res.status(201).json({ message: 'Message sent', data: newMessage });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid payload' });
  }
});

app.delete('/api/messages/:messageId', requireAuth, (req, res) => {
  const { messageId } = req.params;
  const db = getDb();

  const target = db.messages.find((m) => m.id === messageId);
  if (!target) {
    return res.status(404).json({ error: 'Message not found' });
  }
  if (target.senderId !== req.authUserId && target.receiverId !== req.authUserId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  db.messages = db.messages.filter((m) => m.id !== messageId);
  saveDb(db);
  res.json({ message: 'Message deleted' });
});

if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
} else if (process.env.NODE_ENV !== 'test') {
  console.warn('No dist folder found. Run "npm run build" to serve frontend from this server.');
}

io.use((socket, next) => {
  const handshakeToken =
    typeof socket.handshake.auth?.token === 'string'
      ? socket.handshake.auth.token
      : extractBearerToken(socket.handshake.headers?.authorization);

  const claims = verifyAuthToken(handshakeToken, SESSION_SECRET);
  if (!claims) {
    next(new Error('Authentication required'));
    return;
  }

  const db = getDb();
  if (!readOwnUser(db.users, claims.sub)) {
    next(new Error('Invalid session user'));
    return;
  }

  socket.data.userId = claims.sub;
  next();
});

io.on('connection', (socket) => {
  const authenticatedUserId = socket.data.userId;
  if (!authenticatedUserId) {
    socket.disconnect(true);
    return;
  }

  if (!userSockets.has(authenticatedUserId)) {
    userSockets.set(authenticatedUserId, new Set());
  }
  userSockets.get(authenticatedUserId).add(socket.id);
  socket.join(`user:${authenticatedUserId}`);
  emitPresence();

  socket.on('send_message', (payload, ack) => {
    try {
      const db = getDb();
      const receiverId = typeof payload?.receiverId === 'string' ? payload.receiverId.trim() : '';
      if (!readOwnUser(db.users, receiverId)) {
        if (ack) ack({ ok: false, error: 'Unknown recipient' });
        return;
      }

      const newMessage = createMessage({
        ...payload,
        senderId: authenticatedUserId,
        receiverId,
      });
      db.messages.push(newMessage);
      saveDb(db);

      io.to(`user:${newMessage.receiverId}`).emit('receive_message', newMessage);
      io.to(`user:${newMessage.senderId}`).emit('receive_message', newMessage);

      if (ack) ack({ ok: true, data: newMessage });
    } catch (err) {
      if (ack) ack({ ok: false, error: err instanceof Error ? err.message : 'Invalid payload' });
    }
  });

  socket.on('typing', ({ toUserId } = {}) => {
    if (!isValidUserId(toUserId)) return;
    io.to(`user:${toUserId}`).emit('typing', { fromUserId: authenticatedUserId });
  });

  socket.on('stop_typing', ({ toUserId } = {}) => {
    if (!isValidUserId(toUserId)) return;
    io.to(`user:${toUserId}`).emit('stop_typing', { fromUserId: authenticatedUserId });
  });

  socket.on('disconnect', () => {
    const sockets = userSockets.get(authenticatedUserId);
    if (sockets) {
      sockets.delete(socket.id);
      if (sockets.size === 0) {
        userSockets.delete(authenticatedUserId);
      }
    }
    emitPresence();
  });
});

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  server.listen(PORT, HOST, () => {
    console.log(`Shadow Cipher server listening on http://${HOST}:${PORT}`);
  });
}

export { app, server, io };
