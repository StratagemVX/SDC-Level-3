# Shadow Message Cipher

Shadow Message Cipher is a production-grade React + TypeScript secure messaging application designed for encrypted, short-lived communication. 
It features a full cyberpunk/terminal aesthetic, real-time messaging, multimedia attachments (Camera, Voice, Files), and AES client-side encryption.

## Table of Contents

- [Project Overview](#project-overview)
- [Quick Start Checklist](#quick-start-checklist)
- [Core Features](#core-features)
- [System Architecture](#system-architecture)
- [Architecture Diagram](#architecture-diagram)
- [Frontend Routes](#frontend-routes)
- [Backend API](#backend-api)
- [API Error Reference](#api-error-reference)
- [API Examples](#api-examples)
- [API Smoke Test (PowerShell)](#api-smoke-test-powershell)
- [Data Model](#data-model)
- [Encryption and Security Model](#encryption-and-security-model)
- [Local Development](#local-development)
- [Windows PowerShell Quick Start](#windows-powershell-quick-start)
- [Environment Variables](#environment-variables)
- [Available Scripts](#available-scripts)
- [Project Structure](#project-structure)
- [Operational Behavior](#operational-behavior)
- [Production Considerations](#production-considerations)
- [Security Hardening Roadmap](#security-hardening-roadmap)
- [Known Limitations](#known-limitations)
- [Contributing Guide](#contributing-guide)
- [Release Checklist](#release-checklist)
- [Changelog](#changelog)

---

## Project Overview

This project implements a lightweight, highly secure chat workflow:

1. **Authentication:** Users register and log in with a user ID and password.
2. **Client-Side Encryption:** Messages (both text and files) are encrypted entirely on the client using a user-provided cipher key. The server never sees plaintext data.
3. **Transmission:** Encrypted payloads and key hashes are transmitted in real-time via Socket.IO.
4. **Auto-Destruction:** Messages self-destruct based on a Time-To-Live (TTL) countdown and are automatically purged by the API.
5. **Decryption:** Receivers must manually decrypt messages locally with the original matching cipher key.

---

## Quick Start Checklist

1. Install Node.js 18+ and npm 9+.
2. Run `npm install` to install all dependencies.
3. Start the application with `npm run dev`.
4. Open the frontend at `https://localhost:8080`.
   *(Note: The app runs on HTTPS via Vite Basic SSL to allow Camera/Microphone permissions on local networks.)*
5. Confirm the API is reachable via the WebSocket proxy.
6. Create two operative accounts to test the secure link.

---

## Core Features

- **Real-Time Communication:** Instant messaging powered by Socket.IO with typing indicators and online/offline presence tracking.
- **Multimedia Support:** 
  - 📷 **Camera:** Native webcam capture with a dedicated modal and shutter animations.
  - 🎤 **Voice:** Live microphone recording with an animated waveform UI and timer.
  - 📎 **Files:** Drag-and-drop file uploading with size limits, automatic image compression, and format validation.
- **Military-Grade Encryption:** Client-side AES message and file encryption using `crypto-js`.
- **Key Hashing:** SHA-256 key hashing to verify decryption attempts without exposing the key.
- **Self-Destructing Messages:** Programmable TTL (Time-To-Live) slider for message auto-deletion (1 to 60 minutes).
- **Premium Cyberpunk UI:** 
  - Glassmorphism panels, neon green/cyan glow effects, and modern layout alignment.
  - Custom scrollbars, pulse animations, glitch-in effects, and dynamic slide-up message entry animations.
  - Graceful inline error handling and toaster notifications.

---

## System Architecture

**Frontend:**
- React 18 + TypeScript bundled with Vite.
- Styled with Tailwind CSS and Radix UI primitives.
- Context-based state management (`AuthContext`, `MessageContext`).
- Hosted locally over HTTPS using `@vitejs/plugin-basic-ssl`.

**Backend:**
- Express API running on port `3000`.
- Socket.IO server bound to the Express app.
- JSON file storage at `server/data.json` for persistence.
- `bcrypt` password hashing for stored credentials.

**Network Routing (Dev):**
- Frontend dev server on `https://localhost:8080`.
- Backend API server on `http://localhost:3000`.
- Vite proxies all `/api` and `/socket.io` traffic to the backend, bypassing CORS and Mixed Content issues across local networks.

---

## Architecture Diagram

```text
+-----------------------------+     HTTPS /api/* & /socket.io    +-----------------------------+
| Frontend (React + Vite)     | -----------------------------> | Backend (Express + WS)      |
| Port 8080 (HTTPS)           |                                | Port 3000 (HTTP)            |
|                             | <----------------------------- |                             |
| - AuthContext               |        JSON / WebSockets       | - Auth routes               |
| - MessageContext            |                                | - Message routes            |
| - Encryption utilities      |                                | - Expiry cleanup logic      |
| - Media APIs (Cam/Mic)      |                                | - Socket.IO Hub             |
+-----------------------------+                                +--------------+--------------+
                                                                              |
                                                                              | read/write
                                                                              v
                                                               +-----------------------------+
                                                               | server/data.json            |
                                                               | users + messages store      |
                                                               +-----------------------------+
```

---

## Frontend Routes

- `/` : Landing page
- `/landing` : Landing page alias
- `/login` : Login & Authentication Portal
- `/register` : Operative Registration
- `/dashboard` : Main Secure Messaging Workspace

---

## Backend API

Base URL in local development: `http://localhost:3000` (Proxied via `https://localhost:8080/api`)

### Authentication

**POST /api/register**
- Body: `{ userId, password }`
- Behavior: Creates user if userId is unique.
- Response: 201 Created on success.

**POST /api/login**
- Body: `{ userId, password }`
- Behavior: Validates credentials against bcrypt hash.
- Response: 200 OK with userId on success.

**GET /api/users**
- Behavior: Returns user IDs only (never password hashes).
- Response: `{ users: string[] }`

### Messaging

**GET /api/messages/:userId**
- Behavior: Removes expired messages from storage first, then returns messages where user is sender or receiver.
- Response: `{ messages: Message[] }`

**POST /api/messages** (Legacy fallback for non-WS payload transmission)
- Body: `{ senderId, receiverId, encryptedContent, secretKeyHash, ttlMinutes, fileName, fileType, fileSize }`
- Behavior: Stores message with generated ID and computed expiryTime.
- Response: 201 Created with stored message data.

**DELETE /api/messages/:messageId**
- Behavior: Deletes message by ID.
- Response: 200 OK if deleted, 404 if not found.

### Socket.IO Events

- `register` : Maps a socket connection to a `userId`.
- `send_message` : Transmits payload to recipient instantly.
- `receive_message` : Fired on recipient client when payload arrives.
- `typing` / `stop_typing` : Broadcasts typing status.
- `presence_update` : Broadcasts online/offline status of operatives.

---

## API Error Reference

| Endpoint | Status | Reason | Response Shape |
| --- | --- | --- | --- |
| POST /api/register | 400 | Missing userId or password | `{ "error": "Missing fields" }` |
| POST /api/register | 400 | userId already exists | `{ "error": "User already exists" }` |
| POST /api/login | 401 | Invalid credentials | `{ "error": "Invalid credentials" }` |
| POST /api/messages | 400 | Missing required body fields | `{ "error": "Missing fields" }` |
| DELETE /api/messages/:messageId | 404 | Message not found | `{ "error": "Message not found" }` |

---

## API Examples

These examples use PowerShell-friendly curl syntax with JSON payloads.

### Register User

```sh
curl -X POST http://localhost:3000/api/register \
    -H "Content-Type: application/json" \
    -d '{"userId":"agent_alpha","password":"top-secret-pass"}'
```

Success response (201):
```json
{ "message": "User registered" }
```

### Login

```sh
curl -X POST http://localhost:3000/api/login \
    -H "Content-Type: application/json" \
    -d '{"userId":"agent_alpha","password":"top-secret-pass"}'
```

Success response (200):
```json
{
    "message": "Login successful",
    "userId": "agent_alpha"
}
```

### Send Message

```sh
curl -X POST http://localhost:3000/api/messages \
    -H "Content-Type: application/json" \
    -d '{
        "senderId":"agent_alpha",
        "receiverId":"agent_zero",
        "encryptedContent":"U2FsdGVkX1...",
        "secretKeyHash":"5f4dcc3b5aa765d61d8327deb882cf99...",
        "ttlMinutes":10
    }'
```

---

## API Smoke Test (PowerShell)

Run this in PowerShell to validate the happy path quickly.

```powershell
$base = "http://localhost:3000"
$userA = "agent_alpha"
$userB = "agent_bravo"

# 1) Register users (ignore duplicate errors if users already exist)
Invoke-RestMethod -Method Post -Uri "$base/api/register" -ContentType "application/json" -Body (@{ userId = $userA; password = "pass123" } | ConvertTo-Json)
Invoke-RestMethod -Method Post -Uri "$base/api/register" -ContentType "application/json" -Body (@{ userId = $userB; password = "pass123" } | ConvertTo-Json)

# 2) Login
Invoke-RestMethod -Method Post -Uri "$base/api/login" -ContentType "application/json" -Body (@{ userId = $userA; password = "pass123" } | ConvertTo-Json)

# 3) List users
Invoke-RestMethod -Method Get -Uri "$base/api/users"

# 4) Send one encrypted message sample
$payload = @{
    senderId = $userA
    receiverId = $userB
    encryptedContent = "U2FsdGVkX1_sample_payload"
    secretKeyHash = "sample_hash"
    ttlMinutes = 5
} | ConvertTo-Json
$sendResult = Invoke-RestMethod -Method Post -Uri "$base/api/messages" -ContentType "application/json" -Body $payload

# 5) Fetch messages for receiver
Invoke-RestMethod -Method Get -Uri "$base/api/messages/$userB"

# 6) Delete sent message
Invoke-RestMethod -Method Delete -Uri "$base/api/messages/$($sendResult.data.id)"
```

---

## Data Model

Storage file: `server/data.json`

Top-level schema:
- `users`: `Record<string, { hash: string }>`
- `messages`: `Message[]`

Message shape:
- `id`: string (UUID)
- `senderId`: string
- `receiverId`: string
- `encryptedContent`: string
- `secretKeyHash`: string
- `expiryTime`: number (epoch ms)
- `createdAt`: number (epoch ms)
- `fileName` (Optional): string
- `fileType` (Optional): string
- `fileSize` (Optional): number
- `type`: string ("text", "image", "video", "audio", "file")

---

## Encryption and Security Model

Implemented cryptography:
- **Encryption:** `crypto-js` AES with user-supplied secret key.
- **Key hash:** `crypto-js` SHA-256 for verification matching.
- **Password storage:** `bcrypt` hash on server.

Behavioral notes:
- Plaintext messages are encrypted in the client before send.
- Server stores encrypted payload and key hash, not plaintext.
- Decryption happens in the client with provided secret key.
- If decryption fails, UI surfaces invalid key behavior.
- Local Network Safety: Vite Basic SSL (`https://`) is enforced so that WebRTC hardware APIs (`getUserMedia`) are unblocked on mobile devices testing over the same Wi-Fi.

Important limitation:
- This is a local/dev-oriented design.
- In production, move to hardened key management, auth tokens/sessions, database persistence, rate limiting, and HTTPS/TLS everywhere.

---

## Local Development

### Prerequisites
- Node.js 18+
- npm 9+

### Install dependencies
```sh
npm install
```

### Start full dev environment
```sh
npm run dev
```

What starts:
- Vite frontend: `https://localhost:8080`
- Express API: `http://localhost:3000`

### Build frontend
```sh
npm run build
```

---

## Windows PowerShell Quick Start

Use this exact flow on Windows:

```powershell
Set-Location "C:\Users\cheth\Downloads\SDC-MainProject\shadow-message-cipher-main"
npm install
npm run dev
```

---

## Environment Variables

Current state:
- No `.env` file is required to run the project locally.
- The backend port is hardcoded to 3000 in `server/index.js`.
- The frontend dev port is configured to 8080 in `vite.config.ts`.

Suggested production variables:
- `PORT`: backend server port
- `CORS_ORIGIN`: allowed frontend origin(s)
- `DATA_STORE_URL`: database connection string
- `SESSION_SECRET`: session/JWT signing secret
- `NODE_ENV`: environment mode

---

## Available Scripts

- `dev`: Runs frontend and backend concurrently.
- `build`: Creates production frontend build.
- `build:dev`: Creates development-mode build output.
- `preview`: Serves built frontend locally.
- `lint`: Runs ESLint across the project.

---

## Project Structure

- `src/` : Frontend source code.
  - `components/ui/` : shadcn/Radix-based primitives.
  - `components/message/` : Specialized chat components (MessageCard, CameraModal, VoiceRecorderUI).
  - `components/auth/` : Login and registration forms.
  - `components/layout/` : Shared shell components.
  - `context/` : Auth and WebSocket state providers.
  - `pages/` : Full-page route views.
  - `utils/encryption.ts` : Core AES and hashing logic.
- `server/index.js` : Express API server and Socket.IO configuration.
- `server/data.json` : Database storage file.
- `vite.config.ts` : Vite bundler configuration containing SSL and proxy rules.

---

## Operational Behavior

- Current user session is persisted in localStorage key: `user`.
- `sendMessage` encrypts content before transmission via Socket.IO.
- `refreshMessages` loads both inbound and outbound messages for chat continuity on initial load.
- Decrypt flow validates key behavior in UI and keeps encrypted payload untouched in storage.
- Expired messages are removed when messages are requested or dynamically when TTL hits 0 on the client.

---

## Production Considerations

Before deploying publicly, add:

- **Database:** PostgreSQL, MySQL, or MongoDB instead of local JSON.
- **Storage:** Offload encrypted file attachments from Base64 strings to an S3-compatible blob storage bucket to prevent memory bloat.
- **Auth hardening:** JWT/session cookies, refresh handling, CSRF strategy.
- **Request validation middleware** and stricter input constraints.
- **Rate limiting** and brute-force protection.
- **Audit logging** and observability.
- **Secrets management** and environment variable strategy.
- **Secure transport (HTTPS)** and reverse proxy setup natively on the server.

---

## Security Hardening Roadmap

**Phase 1 (Immediate):**
- Add strict request schema validation for all routes.
- Add centralized error handling and response normalization.
- Add basic rate limiting for auth and message endpoints.

**Phase 2 (Short-term):**
- Introduce token/session auth with expiration and refresh flow.
- Replace JSON file storage with managed database.
- Add CORS allowlist and security headers.

**Phase 3 (Mid-term):**
- Add audit logging for auth/message actions.
- Add abuse detection and alerting thresholds.
- Add key management policy and rotation guidance.

**Phase 4 (Production-grade):**
- Add full observability (traces, metrics, dashboards).
- Add backup/restore and disaster recovery runbooks.
- Run periodic dependency and penetration assessments.

---

## Known Limitations

| Area | Current Behavior | Impact | Priority | Suggested Fix |
| --- | --- | --- | --- | --- |
| Storage | Uses file-based `server/data.json` | Not safe/scalable for production | High | Move to PostgreSQL/MySQL with migrations |
| Attachments | Files Base64-encoded to JSON | Memory bloat on large payloads | High | Stream files to encrypted S3 bucket |
| Auth sessions | No JWT/cookie session layer | Limited auth hardening | High | Add secure session strategy and middleware |
| Input validation | Basic field checks in routes | Risk of malformed requests | High | Add schema validation (zod/joi) |
| Rate limiting | No request throttling | Brute-force/spam risk | High | Add IP/user-based rate limit rules |
| Secret key UX | Key mismatch handled at decrypt-time | User confusion during send/decrypt | Medium | Add optional key-strength hints |

---

## Contributing Guide

### Recommended workflow
1. Create a feature branch from your main line.
2. Make focused changes with clear commit messages.
3. Run lint and verify local app behavior before opening PR.
4. Include screenshots for UI-impacting changes.
5. Document API or data model changes in this README.

### Local quality checks
```sh
npm run lint
npm run build
```

### Pull request checklist
- No plaintext secrets committed.
- No breaking route changes without documentation update.
- API request/response changes reflected in README.
- Manual smoke test completed for login, send, fetch, decrypt, and delete flows.

---

## Release Checklist

Use this checklist before tagging a release:
1. Run quality checks: `npm run lint` and `npm run build`.
2. Validate core flow manually: register, login, send media/text, decrypt, delete.
3. Verify no unwanted strings or artifacts in codebase.
4. Update README and changelog entries for the release date.
5. Confirm placeholder and metadata assets are correct.
6. Confirm dependency audit status and triage any critical issues.

---

## Changelog

### 2026-04-29
- **Media Features:** Added Camera capture modal and Voice recording with live animated waveform.
- **UI/UX Polish:** Revamped CSS with slide-up animations, custom cyberpunk scrollbars, and improved button alignment.
- **Security:** Replaced `http` with `https` locally using `@vitejs/plugin-basic-ssl` to ensure hardware permission compatibility.
- **Real-Time:** Fully integrated Socket.IO replacing legacy 5-second polling.
- **Documentation:** Consolidated massive README containing API routes, smoke tests, limitations, and setup flow.

### 2026-04-27
- Removed all Lovable/GPT Engineer traces from project code and metadata.
- Replaced placeholder asset with project-branded `placeholder.svg`.
- Base encryption and TTL logic implemented.

---

## FAQ

**Q: Is this production-ready as-is?**
A: No. It is a strong local/dev baseline and needs auth/session, DB, validation, and security hardening before public deployment.

**Q: Why are messages still visible to sender and receiver?**
A: The UI intentionally returns both sent and received messages for conversation continuity.

**Q: Does the backend store plaintext messages?**
A: No. The backend stores encrypted content and a secret key hash, not plaintext message text.

**Q: Why do messages disappear?**
A: Messages use TTL and are deleted automatically once expiryTime is reached.

**Q: Why do I get a browser privacy warning when opening the app?**
A: To enable Camera and Microphone access over a local network, the Vite dev server uses Basic SSL to create a self-signed HTTPS certificate. You must click "Advanced -> Proceed" to bypass the warning.

---

## License

This project is licensed under the MIT License. See the LICENSE file for details.
