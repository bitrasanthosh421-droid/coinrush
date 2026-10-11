require("dotenv").config();

const express = require("express");
const path = require("path");
const os = require("os");
const helmet = require("helmet");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const session = require("express-session");
const { MongoStore } = require("connect-mongo");
const { rateLimit } = require("express-rate-limit");

// Models
const User = require("./models/User");
const Transaction = require("./models/Transaction");
const GameClaim = require(models/GameClaim");

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/coinrush";
const SESSION_SECRET = process.env.SESSION_SECRET || "default_coinrush_super_secret_session_key_32_chars";
const PORT = Number(process.env.PORT) || 3000;
const production = process.env.NODE_ENV === "production";

const app = express();

// Security & Parsing
app.disable("x-powered-by");
if (production) {
  app.set("trust proxy", 1);
}
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// Connect to MongoDB Atlas
const mongoConnectPromise = mongoose
  .connect(MONGODB_URI, { serverSelectionTimeoutMS: 15000 })
  .then(() => {
    console.log("✅ Successfully connected to MongoDB Atlas database!");
    return mongoose.connection.getClient();
  })
  .catch((err) => {
    console.error("⚠️ MongoDB connection error:", err.message);
    throw err;
  });

// Session Management with MongoStore
const sessionConfig = {
  name: "coinrush.sid",
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    clientPromise: mongoConnectPromise,
    collectionName: "user_sessions",
    ttl: 7 * 24 * 60 * 60
  }),
  cookie: {
    httpOnly: true,
    secure: production,
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  }
};

app.use(session(sessionConfig));

// Static Files & Page Routes
app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "login.html"));
});

app.get("/login.html", (req, res) => {
  res.sendFile(path.join(__dirname, "login.html"));
});

// Rate limiter for authentication routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: { error: "Too many authentication attempts. Please try again after 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false
});

// Auth Guard Middleware
function requireLogin(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Please log in first." });
  }
  next();
}

function validEmail(email) {
  return typeof email === "string" && email.length <= 255 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ----------------------------------------------------
// AUTHENTICATION ROUTES (MongoDB Powered)
// ----------------------------------------------------

// 1. REGISTER NEW USER (Saves to MongoDB)
app.post("/api/register", authLimiter, async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    // Input Validations
    if (name.length < 2 || name.length > 80) {
      return res.status(400).json({ error: "Name must be between 2 and 80 characters." });
    }
    if (!validEmail(email)) {
      return res.status(400).json({ error: "Please provide a valid email address." });
    }
    if (password.length < 8 || Buffer.byteLength(password, "utf8") > 72) {
      return res.status(400).json({ error: "Password must be at least 8 characters long." });
    }

    // Check if user already exists in MongoDB
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ error: "This email address is already registered. Please sign in." });
    }

    // Hash password with bcrypt
    const passwordHash = await bcrypt.hash(password, 12);

    // Create & save new user in MongoDB
    const newUser = new User({
      name,
      email,
      passwordHash,
      virtualCoins: 100 // Welcome starter coins
    });

    const savedUser = await newUser.save();

    // Record welcome bonus transaction in MongoDB
    await Transaction.create({
      userId: savedUser._id,
      amount: 100,
      transactionType: "signup_bonus",
      description: "Welcome starter bonus"
    }).catch(err => console.error("Initial transaction log error:", err.message));

    // Establish user session
    req.session.regenerate((error) => {
      if (error) {
        return res.status(500).json({ error: "Session creation error." });
      }

      req.session.userId = savedUser._id.toString();
      req.session.save((saveError) => {
        if (saveError) {
          return res.status(500).json({ error: "Session save error." });
        }
        return res.status(201).json({
          message: "User successfully registered and saved to MongoDB!",
          user: savedUser.toPublicJSON()
        });
      });
    });

  } catch (error) {
    console.error("Register Error:", error);
    if (error.code === 11000) {
      return res.status(409).json({ error: "Email already registered in database." });
    }
    return res.status(500).json({ error: "Registration failed. Database error: " + error.message });
  }
});

// 2. LOGIN USER (Authenticates against MongoDB)
app.post("/api/login", authLimiter, async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!validEmail(email) || !password) {
      return res.status(400).json({ error: "Please enter a valid email and password." });
    }

    // Retrieve user from MongoDB
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    // Compare hashed password
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    // Regenerate and save session
    req.session.regenerate((error) => {
      if (error) {
        return res.status(500).json({ error: "Session creation failed." });
      }

      req.session.userId = user._id.toString();
      req.session.save((saveError) => {
        if (saveError) {
          return res.status(500).json({ error: "Session save failed." });
        }
        return res.json({
          message: "Login successful!",
          user: user.toPublicJSON()
        });
      });
    });

  } catch (error) {
    console.error("Login Error:", error);
    return res.status(500).json({ error: "Login failed: " + error.message });
  }
});

// 3. GET CURRENT LOGGED-IN USER SESSION
app.get("/api/me", async (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.json({ user: null });
  }

  try {
    const user = await User.findById(req.session.userId);
    if (!user) {
      return res.json({ user: null });
    }
    return res.json({ user: user.toPublicJSON() });
  } catch (error) {
    console.error("Session check error:", error.message);
    return res.status(500).json({ error: "Could not restore session." });
  }
});

// 4. GET DETAILED PROFILE
app.get("/api/profile", requireLogin, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }
    return res.json({
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        virtualCoins: user.virtualCoins,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error("Profile Error:", error.message);
    return res.status(500).json({ error: "Could not load profile." });
  }
});

// 5. GET VIRTUAL WALLET & TRANSACTIONS
app.get("/api/wallet", requireLogin, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const transactions = await Transaction.find({ userId: req.session.userId })
      .sort({ createdAt: -1 })
      .limit(50);

    return res.json({
      virtualCoins: user.virtualCoins,
      transactions: transactions.map((t) => ({
        amount: t.amount,
        transactionType: t.transactionType,
        description: t.description,
        createdAt: t.createdAt
      }))
    });
  } catch (error) {
    console.error("Wallet Error:", error.message);
    return res.status(500).json({ error: "Could not load wallet." });
  }
});

// 6. DEMO GAME REWARD (Increases coins in MongoDB)
app.post("/api/game-reward", requireLogin, async (req, res) => {
  const gameId = Number(req.body.gameId);
  if (!Number.isInteger(gameId) || gameId < 1 || gameId > 4) {
    return res.status(400).json({ error: "Invalid game ID." });
  }

  try {
    // Check 60 second rate limit per game
    const sixtySecondsAgo = new Date(Date.now() - 60 * 1000);
    const recentClaim = await GameClaim.findOne({
      userId: req.session.userId,
      gameId: gameId,
      claimedAt: { $gt: sixtySecondsAgo }
    });

    if (recentClaim) {
      return res.status(429).json({
        error: "Please wait 60 seconds before claiming another reward for this game."
      });
    }

    const reward = 5;

    // Record game claim
    await GameClaim.create({
      userId: req.session.userId,
      gameId: gameId,
      claimedAt: new Date()
    });

    // Update user coins
    const updatedUser = await User.findByIdAndUpdate(
      req.session.userId,
      { $inc: { virtualCoins: reward } },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ error: "User not found." });
    }

    // Record transaction
    await Transaction.create({
      userId: req.session.userId,
      amount: reward,
      transactionType: "game_reward",
      description: "Virtual demo game reward"
    });

    return res.json({
      virtualCoins: updatedUser.virtualCoins,
      reward
    });
  } catch (error) {
    console.error("Reward Error:", error.message);
    return res.status(500).json({ error: "Could not process reward." });
  }
});

// 7. LOGOUT
app.post("/api/logout", requireLogin, (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      return res.status(500).json({ error: "Logout failed." });
    }

    res.clearCookie("coinrush.sid", {
      httpOnly: true,
      secure: production,
      sameSite: "lax"
    });
    return res.json({ message: "Logged out successfully." });
  });
});

// 404 Handler for APIs
app.use("/api", (req, res) => {
  res.status(404).json({ error: "API endpoint not found." });
});

function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "localhost";
}

// Start Web Server
async function startServer() {
  const localIp = getLocalIpAddress();

  try {
    await mongoConnectPromise;
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 CoinRush server running on all network interfaces:`);
      console.log(`💻 Local computer:         http://localhost:${PORT}`);
      console.log(`📱 Other devices on Wi-Fi: http://${localIp}:${PORT}`);
      console.log(`📄 Login page:             http://${localIp}:${PORT}/login.html`);
      console.log(`🎮 Dashboard:              http://${localIp}:${PORT}/index.html`);
    });
  } catch (error) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 CoinRush server running on http://${localIp}:${PORT} (Database connection pending)`);
    });
  }
}

startServer();
