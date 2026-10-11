# CoinRush - Authentication System with Node.js & MongoDB

This project features a modern **Login & Registration page** built with **HTML5, CSS3, and JavaScript**, connected to a **Node.js Express** backend and **MongoDB** database to store and authenticate user accounts securely.

---

## 🚀 Features

- **Modern Responsive Login / Sign Up Page (`login.html`)**:
  - Dark cyberpunk glassmorphic design matching CoinRush branding.
  - Interactive tabs to toggle between **Sign In** and **Create Account**.
  - Password visibility toggle (reveal/hide password).
  - Client-side validation for emails, password length (minimum 8 chars), and password confirmation matching.
  - Interactive alerts and loading spinners on submission.
  - Active session detection (shows "Already logged in as [Name]" with direct link to dashboard or quick logout).
- **Backend Authentication & User Persistence (`server.js`)**:
  - Built with **Node.js**, **Express**, **Mongoose**, and **MongoDB**.
  - Secure password hashing using **bcrypt** (salt rounds: 12).
  - Rate limiting on auth endpoints with `express-rate-limit` to prevent brute-force attacks.
  - Session management persisted in MongoDB via `connect-mongo`.
  - Welcome bonus: new registrations receive **100 virtual starter coins** saved directly to MongoDB.
  - Game demo rewards update user balances in MongoDB.
- **Mongoose Data Models (`models/`)**:
  - `User.js`: Schema for users (name, email, passwordHash, virtualCoins, timestamps).
  - `Transaction.js`: Schema for coin credit/debit records.
  - `GameClaim.js`: Schema to prevent spamming game demo rewards.

---

## 🛠️ Prerequisites

1. **Node.js** (v18+ installed)
2. **MongoDB** installed locally (or a free cloud database cluster from [MongoDB Atlas](https://www.mongodb.com/atlas/database))

---

## ⚙️ Configuration (`.env`)

Configure your environment variables in the `.env` file:

```env
# Local MongoDB:
MONGODB_URI=mongodb://127.0.0.1:27017/coinrush

# Or MongoDB Atlas (Cloud Cluster):
# MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/coinrush?retryWrites=true&w=majority

# Session Secret (at least 32 characters)
SESSION_SECRET=myverylongandsecretkeythatisatleast32characters_coinrush_secure

# Server Port
PORT=3000
NODE_ENV=development
```

---

## 🏃 Quick Start

### 1. Start MongoDB
If using local MongoDB on Windows:
```powershell
net start MongoDB
# Or if installed as standalone:
mongod --dbpath="C:\data\db"
```
*(If you are using MongoDB Atlas, simply paste your connection string into `.env` under `MONGODB_URI`.)*

### 2. Start the Server
```powershell
npm start
```
Or:
```powershell
node server.js
```

### 3. Open in Browser
- **Login / Register Page**: [http://localhost:3000/login.html](http://localhost:3000/login.html)
- **Main Dashboard**: [http://localhost:3000/index.html](http://localhost:3000/index.html)

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/register` | Creates a new user document in MongoDB with hashed password and 100 starter coins |
| `POST` | `/api/login` | Validates credentials against MongoDB and establishes a secure session |
| `GET` | `/api/me` | Retrieves current logged-in user profile from session |
| `GET` | `/api/wallet` | Retrieves virtual coin balance and transactions from MongoDB |
| `POST` | `/api/game-reward` | Adds +5 demo coins for playing games and logs transaction in MongoDB |
| `POST` | `/api/logout` | Destroys current session and clears cookies |
