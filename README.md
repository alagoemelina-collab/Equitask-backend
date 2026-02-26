# techdivas-equitask
# EquiTask AI — Backend API (Capstone)
 
Backend service for EquiTask AI: task creation, assignment, proof submission (text/file), review workflow (approve/reject), notifications, authentication (JWT) and optional 2FA.
 
---
 
## ✅ Features
 
- JWT Authentication (Register/Login)
- Role-based access control (User / Manager)
- Task CRUD (create, view, update, delete)
- Proof submission:
  - Text proof
  - File proof (image/audio upload using Multer)
- Review proof workflow (Manager approves/rejects)
- Notifications created automatically for important actions
- 2FA endpoints (if enabled in your sprint)
 
---
 
## 🧰 Tech Stack
 
- Node.js
- Express.js
- MongoDB + Mongoose
- JWT + bcrypt
- Multer (uploads)
- dotenv
 
---
 
## 📁 Project Structure (Folders & Files Explained)
 
> Your structure may look slightly different, but this explains the common EquiTask layout.
 
### ✅ Root Level
- **server.js**
  - Main entry point.
  - Starts Express server.
  - Connects MongoDB.
  - Registers all route modules:
    - `/api/auth`
    - `/api/tasks`
    - `/api/proof`
    - `/api/notifications`
    - `/api/2fa` (if used)
  - Serves uploaded files:
    - `app.use("/uploads", express.static("uploads"))`
 
- **.env**
  - Stores environment variables (DB URL, JWT secret, etc.)
 
- **package.json**
  - Defines dependencies and run scripts
  - Example scripts:
    - `npm run dev` (nodemon)
    - `npm start`
 
---
 
### ✅ /routes
This folder contains the API endpoints.
 
- **routes/auth.js**
  - Register user
  - Login user
  - Returns token (JWT)
  - Often includes `/me` or `/profile` route to fetch logged-in user
 
- **routes/tasks.js**
  - CRUD operations on tasks
  - Create task (usually manager only)
  - Get tasks (assigned tasks / all tasks depending on role)
 
- **routes/proof.js**
  - Submit proof for a task
  - Text proof endpoint:
    - `POST /api/proof/:taskId/text`
  - File proof endpoint:
    - `POST /api/proof/:taskId/file` (multipart/form-data)
  - Review endpoint (manager):
    - `POST /api/proof/:taskId/review`
 
- **routes/notifications.js**
  - Fetch notifications for a logged-in user
  - Example:
    - `GET /api/notifications`
 
- **routes/twoFactor.js** (if you created it)
  - Handles 2FA generation & verification
  - Example:
    - `POST /api/2fa/setup`
    - `POST /api/2fa/verify`
 
---
 
### ✅ /models
Database schemas (MongoDB collections).
 
- **models/User.js**
  - Stores user info (name, email, password hash, role)
  - Optional:
    - 2FA secret
    - verified flags
 
- **models/Tasks.js**
  - Stores tasks:
    - title, description
    - assignedTo
    - createdBy
    - dueDate
    - status (not_started/in_progress/etc.)
    - proof object
    - managerReview object
 
- **models/Notification.js**
  - Stores notifications per user:
    - user
    - title
    - message
    - type
    - task reference
    - createdAt
 
---
 
### ✅ /middleware
Reusable middleware (logic that runs before routes).
 
- **middleware/auth.js**
  - `protect` middleware:
    - Reads `Authorization: Bearer <token>`
    - Verifies JWT
    - Adds `req.user`
 
- **middleware/rbac.js**
  - Role checking middleware:
    - `allowRoles("manager")`
    - Blocks users that are not allowed
 
---
 
### ✅ /config
Configuration utilities (optional depending on your project).
 
- **config/database.js**
  - Connects to MongoDB using Mongoose
  - Called from server.js
 
---
 
### ✅ /uploads
- Folder where files are stored after upload (image/audio proof)
- Automatically created in your proof route (recommended)
 
---
 
## ⚙️ Setup Instructions
 
### 1) Install dependencies
```bash
npm install
 
