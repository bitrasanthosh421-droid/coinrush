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

// ========================================================
// Mongoose Models
// (Defined inline to ensure seamless execution on Render / Linux
// without file-path or case-sensitivity errors like 'models/user')
// ========================================================
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters long"],
      maxlength: [80, "Name must not exceed 80 characters"]
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Please enter a valid email address"]
    },
    passwordHash: {
      type: String,
      required: [true, "Password hash is required"]
    },
    virtualCoins: {
      type: Number,
      default: 100,
      min: [0, "Coins balance cannot be negative"]
    }
  },
  {
    timestamps: true
  }
);

userSchema.methods.toPublicJSON = function () {
  return {
    id: this._id.toString(),
    name: this.name,
    email: this.email,
    virtualCoins: this.virtualCoins,
    createdAt: this.createdAt
  };
};

const transactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    amount: {
      type: Number,
      required: true
    },
    transactionType: {
      type: String,
      required: true,
      enum: ["game_reward", "signup_bonus", "spend", "transfer", "withdraw"]
    },
    description: {
      type: String,
      default: ""
    }
  },
  {
    timestamps: true
  }
);

const gameClaimSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  gameId: {
    type: Number,
    required: true
  },
  claimedAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

const withdrawalSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    referenceId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    coinsDeducted: {
      type: Number,
      required: true,
      min: 1
    },
    amountINR: {
      type: Number,
      required: true,
      min: 1
    },
    payoutMethod: {
      type: String,
      required: true,
      enum: ["upi", "bank_transfer"]
    },
    payoutDetails: {
      upiId: { type: String, trim: true },
      accountNumber: { type: String, trim: true },
      accountHolderName: { type: String, trim: true },
      ifscCode: { type: String, trim: true },
      bankName: { type: String, trim: true }
    },
    status: {
      type: String,
      default: "Processing",
      enum: ["Processing", "Completed", "Failed", "Under Review"]
    },
    utrNumber: { type: String, trim: true, default: "" },
    adminNotes: { type: String, trim: true, default: "" },
    processedAt: { type: Date }
  },
  {
    timestamps: true
  }
);

const User = mongoose.models.User || mongoose.model("User", userSchema);
const Transaction = mongoose.models.Transaction || mongoose.model("Transaction", transactionSchema);
const GameClaim = mongoose.models.GameClaim || mongoose.model("GameClaim", gameClaimSchema);
const Withdrawal = mongoose.models.Withdrawal || mongoose.model("Withdrawal", withdrawalSchema);

const MONGODB_URI =
  process.env.MONGODB_URI ||
  "mongodb+srv://bitrasanthosh421_db_user:LagVfh6Fbd7bzhAD@cluster0.xakh9xr.mongodb.net/coinrush?retryWrites=true&w=majority&appName=Cluster0";
const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  "myverylongandsecretkeythatisatleast32characters_coinrush_secure";
const PORT = Number(process.env.PORT) || 3000;
const production = process.env.NODE_ENV === "production";

const app = express();

const cors = require("cors");

// Security & Parsing
app.disable("x-powered-by");
if (production) {
  app.set("trust proxy", 1);
}
app.use(cors({ origin: true, credentials: true }));
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
    return null;
  });

// Session Management with MongoStore
const sessionStore = MongoStore.create({
  clientPromise: mongoConnectPromise,
  collectionName: "user_sessions",
  ttl: 7 * 24 * 60 * 60
});

sessionStore.on("error", (error) => {
  console.warn("⚠️ Session store event:", error.message);
});

const sessionConfig = {
  name: "coinrush.sid",
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
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

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "admin.html"));
});

app.get("/admin.html", (req, res) => {
  res.sendFile(path.join(__dirname, "admin.html"));
});

app.get("/privacy", (req, res) => {
  res.sendFile(path.join(__dirname, "privacy.html"));
});

app.get("/privacy.html", (req, res) => {
  res.sendFile(path.join(__dirname, "privacy.html"));
});

app.get("/terms", (req, res) => {
  res.sendFile(path.join(__dirname, "terms.html"));
});

app.get("/terms.html", (req, res) => {
  res.sendFile(path.join(__dirname, "terms.html"));
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

// 6. GAME REWARD (Max 50 coins per match, 5-minute play duration cooldown)
app.get("/api/game-reward/status", requireLogin, async (req, res) => {
  try {
    const FIVE_MINUTES = 5 * 60 * 1000;
    const fiveMinutesAgo = new Date(Date.now() - FIVE_MINUTES);
    const recentClaim = await GameClaim.findOne({
      userId: req.session.userId,
      claimedAt: { $gt: fiveMinutesAgo }
    }).sort({ claimedAt: -1 });

    if (recentClaim) {
      const elapsed = Date.now() - recentClaim.claimedAt.getTime();
      const remainingSeconds = Math.max(0, Math.ceil((FIVE_MINUTES - elapsed) / 1000));
      return res.json({ canClaim: false, remainingSeconds });
    }
    return res.json({ canClaim: true, remainingSeconds: 0 });
  } catch (e) {
    return res.json({ canClaim: true, remainingSeconds: 0 });
  }
});

app.post("/api/game-reward", requireLogin, async (req, res) => {
  const gameId = Number(req.body.gameId);
  if (!Number.isInteger(gameId) || gameId < 1 || gameId > 10) {
    return res.status(400).json({ error: "Invalid game ID." });
  }

  try {
    const FIVE_MINUTES = 5 * 60 * 1000;
    const fiveMinutesAgo = new Date(Date.now() - FIVE_MINUTES);

    // Check if user already claimed a game reward in the last 5 minutes
    const recentClaim = await GameClaim.findOne({
      userId: req.session.userId,
      claimedAt: { $gt: fiveMinutesAgo }
    }).sort({ claimedAt: -1 });

    if (recentClaim) {
      const elapsed = Date.now() - recentClaim.claimedAt.getTime();
      const remainingSeconds = Math.max(1, Math.ceil((FIVE_MINUTES - elapsed) / 1000));
      const mins = Math.floor(remainingSeconds / 60);
      const secs = remainingSeconds % 60;
      const user = await User.findById(req.session.userId);
      return res.status(429).json({
        error: `5-minute duration active. Next 50 coins available in ${mins}m ${secs}s.`,
        cooldownActive: true,
        remainingSeconds,
        virtualCoins: user ? user.virtualCoins : 0
      });
    }

    // Read play time period and requested reward
    const playedSeconds = Math.max(0, Number(req.body.playedSeconds) || 0);
    let reward = Math.min(50, Math.max(0, Number(req.body.reward) || 10));

    // If played duration > 5 minutes (300s), ensure reward is above 30 coins (up to 50 coins)
    if (playedSeconds >= 300 && reward <= 30) {
      reward = 35;
    }

    // Update user coins in database
    const updatedUser = await User.findByIdAndUpdate(
      req.session.userId,
      { $inc: { virtualCoins: reward } },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ error: "User not found." });
    }

    // Record game claim
    await GameClaim.create({
      userId: req.session.userId,
      gameId: gameId,
      claimedAt: new Date()
    });

    // Record transaction
    if (reward > 0) {
      const durLabel = playedSeconds > 0 ? ` (${Math.floor(playedSeconds/60)}m ${playedSeconds%60}s played)` : "";
      await Transaction.create({
        userId: req.session.userId,
        amount: reward,
        transactionType: "game_reward",
        description: `Game #${gameId} reward: +${reward} coins${durLabel}`
      });
    }

    return res.json({
      virtualCoins: updatedUser.virtualCoins,
      reward,
      cooldownSeconds: 300,
      playedSeconds,
      message: `Earned +${reward} coins! Next match reward available in 5 minutes.`
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

// 8. LEADERBOARD & PLAYERS HISTORY (Ranking by highest coins)
app.get("/api/leaderboard", async (req, res) => {
  try {
    const totalPlayers = await User.countDocuments();
    const topUsers = await User.find({})
      .select("name email virtualCoins createdAt")
      .sort({ virtualCoins: -1, createdAt: 1 })
      .limit(100);

    const leaderboard = topUsers.map((u, index) => ({
      rank: index + 1,
      id: u._id.toString(),
      name: u.name,
      email: u.email,
      virtualCoins: u.virtualCoins,
      createdAt: u.createdAt
    }));

    return res.json({
      totalPlayers,
      leaderboard
    });
  } catch (error) {
    console.error("Leaderboard Error:", error.message);
    return res.status(500).json({ error: "Could not load leaderboard." });
  }
});

// Rate limiter for withdrawal requests
const withdrawLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 6,
  message: { error: "Too many withdrawal attempts. Please wait a minute before trying again." }
});

// 9. SUBMIT SECURE WITHDRAWAL (1,000 Coins = 10 INR)
app.post("/api/withdraw", requireLogin, withdrawLimiter, async (req, res) => {
  try {
    const coins = Math.floor(Number(req.body.coins));
    const payoutMethod = String(req.body.payoutMethod || "").trim().toLowerCase();

    // 1000 Coins = 10 INR (100 coins = 1 INR)
    const MIN_COINS = 1000;
    const CONVERSION_RATE = 100;

    if (!Number.isInteger(coins) || coins < MIN_COINS) {
      return res.status(400).json({
        error: `Minimum withdrawal is ${MIN_COINS} coins (₹${MIN_COINS / CONVERSION_RATE} INR).`
      });
    }

    const amountINR = Number((coins / CONVERSION_RATE).toFixed(2));

    if (!["upi", "bank_transfer"].includes(payoutMethod)) {
      return res.status(400).json({ error: "Please select a valid payout method (UPI or Bank Transfer)." });
    }

    const payoutDetails = {};

    if (payoutMethod === "upi") {
      const upiId = String(req.body.upiId || "").trim();
      const upiRegex = /^[\w.\-_]{2,256}@[a-zA-Z]{2,64}$/;
      if (!upiId || !upiRegex.test(upiId)) {
        return res.status(400).json({ error: "Please enter a valid UPI ID (e.g. yourname@oksbi or 9876543210@ybl)." });
      }
      payoutDetails.upiId = upiId;
    } else {
      const accountNumber = String(req.body.accountNumber || "").trim();
      const confirmAccount = String(req.body.confirmAccount || "").trim();
      const accountHolder = String(req.body.accountHolder || "").trim();
      const ifscCode = String(req.body.ifscCode || "").trim().toUpperCase();
      const bankName = String(req.body.bankName || "").trim();

      if (!accountHolder || accountHolder.length < 3) {
        return res.status(400).json({ error: "Please provide a valid Account Holder Name." });
      }
      if (!/^\d{9,18}$/.test(accountNumber)) {
        return res.status(400).json({ error: "Bank Account Number must be between 9 and 18 digits." });
      }
      if (accountNumber !== confirmAccount) {
        return res.status(400).json({ error: "Bank Account Numbers do not match. Please verify." });
      }
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode)) {
        return res.status(400).json({ error: "Invalid IFSC Code. Example: SBIN0001234 or HDFC0001234." });
      }

      payoutDetails.accountNumber = accountNumber;
      payoutDetails.accountHolderName = accountHolder;
      payoutDetails.ifscCode = ifscCode;
      payoutDetails.bankName = bankName || "Bank";
    }

    // Atomic Balance Check and Deduction (prevents double-spending)
    const updatedUser = await User.findOneAndUpdate(
      {
        _id: req.session.userId,
        virtualCoins: { $gte: coins }
      },
      {
        $inc: { virtualCoins: -coins }
      },
      {
        new: true
      }
    );

    if (!updatedUser) {
      return res.status(400).json({
        error: "Insufficient coin balance for this withdrawal."
      });
    }

    // Unique Reference ID
    const referenceId = "WDR-CR-" + Date.now().toString(36).toUpperCase() + "-" + Math.floor(1000 + Math.random() * 9000);

    // Save Payout Record
    const withdrawal = await Withdrawal.create({
      userId: req.session.userId,
      referenceId,
      coinsDeducted: coins,
      amountINR,
      payoutMethod,
      payoutDetails,
      status: "Processing"
    });

    // Record Transaction Audit Log
    await Transaction.create({
      userId: req.session.userId,
      amount: -coins,
      transactionType: "withdraw",
      description: `Payout ₹${amountINR} (${payoutMethod.toUpperCase()}) Ref: ${referenceId}`
    }).catch(err => console.error("Withdrawal transaction log error:", err.message));

    return res.status(201).json({
      success: true,
      message: `Withdrawal request for ₹${amountINR} (${coins} coins) submitted successfully!`,
      referenceId,
      amountINR,
      coinsDeducted: coins,
      newBalance: updatedUser.virtualCoins,
      remainingCoins: updatedUser.virtualCoins,
      status: withdrawal.status,
      withdrawal: {
        referenceId,
        amountINR,
        coinsDeducted: coins,
        status: withdrawal.status,
        createdAt: withdrawal.createdAt
      },
      createdAt: withdrawal.createdAt
    });

  } catch (error) {
    console.error("Withdraw Error:", error);
    return res.status(500).json({ error: "Failed to process withdrawal request: " + error.message });
  }
});

// 10. GET WITHDRAWAL HISTORY
app.get("/api/withdraw/history", requireLogin, async (req, res) => {
  try {
    const list = await Withdrawal.find({ userId: req.session.userId })
      .sort({ createdAt: -1 })
      .limit(50);

    const formatted = list.map(w => ({
      id: w._id.toString(),
      referenceId: w.referenceId,
      coinsDeducted: w.coinsDeducted,
      amountINR: w.amountINR,
      payoutMethod: w.payoutMethod,
      target: w.payoutMethod === "upi"
        ? w.payoutDetails?.upiId
        : `A/C ending in ...${String(w.payoutDetails?.accountNumber || "").slice(-4)} (${w.payoutDetails?.ifscCode || ""})`,
      upiId: w.payoutDetails?.upiId || null,
      status: w.status,
      utrNumber: w.utrNumber || "",
      adminNotes: w.adminNotes || "",
      createdAt: w.createdAt
    }));

    return res.json({
      history: formatted,
      withdrawals: formatted
    });
  } catch (error) {
    console.error("History Error:", error.message);
    return res.status(500).json({ error: "Could not load withdrawal history." });
  }
});

// ========================================================
// 11. HOST ADMIN DASHBOARD & PAYOUT PROCESSING
// ========================================================
const ADMIN_SECRET = process.env.ADMIN_SECRET || "coinrush_admin_2026";

function requireAdmin(req, res, next) {
  const key = req.headers["x-admin-key"] || req.query.adminKey || req.body.adminKey;
  if (!key || key !== ADMIN_SECRET) {
    return res.status(403).json({ error: "Unauthorized: Invalid Host Admin Key." });
  }
  next();
}

// GET all withdrawals and stats for Host Dashboard
app.get("/api/admin/withdrawals", requireAdmin, async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find({})
      .populate("userId", "name email virtualCoins")
      .sort({ createdAt: -1 });

    const totalUsers = await User.countDocuments();
    const pendingList = withdrawals.filter(w => w.status === "Processing" || w.status === "Under Review");
    const completedList = withdrawals.filter(w => w.status === "Completed");
    const failedList = withdrawals.filter(w => w.status === "Failed");

    const totalPendingINR = pendingList.reduce((acc, w) => acc + (w.amountINR || 0), 0);
    const totalCompletedINR = completedList.reduce((acc, w) => acc + (w.amountINR || 0), 0);

    return res.json({
      stats: {
        totalPlayers: totalUsers,
        pendingCount: pendingList.length,
        pendingINR: Number(totalPendingINR.toFixed(2)),
        completedCount: completedList.length,
        completedINR: Number(totalCompletedINR.toFixed(2)),
        failedCount: failedList.length
      },
      withdrawals: withdrawals.map(w => ({
        id: w._id.toString(),
        referenceId: w.referenceId,
        userName: w.userId ? w.userId.name : "Unknown Player",
        userEmail: w.userId ? w.userId.email : "Unknown Email",
        userCoins: w.userId ? w.userId.virtualCoins : 0,
        amountINR: w.amountINR,
        coinsDeducted: w.coinsDeducted,
        payoutMethod: w.payoutMethod,
        payoutDetails: w.payoutDetails,
        status: w.status,
        utrNumber: w.utrNumber || "",
        adminNotes: w.adminNotes || "",
        createdAt: w.createdAt,
        processedAt: w.processedAt || null
      }))
    });
  } catch (error) {
    console.error("Admin Withdrawals Error:", error.message);
    return res.status(500).json({ error: "Failed to load admin withdrawals: " + error.message });
  }
});

// MARK WITHDRAWAL AS COMPLETED (Host sends money via PhonePe / GPay and marks completed)
app.post("/api/admin/withdrawals/:id/complete", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const utrNumber = String(req.body.utrNumber || "").trim();
    const notes = String(req.body.notes || "").trim();

    const withdrawal = await Withdrawal.findById(id);
    if (!withdrawal) {
      return res.status(404).json({ error: "Withdrawal record not found." });
    }

    withdrawal.status = "Completed";
    withdrawal.utrNumber = utrNumber || "HOST_UPI_TRANSFER";
    withdrawal.adminNotes = notes || "Payment sent by host via PhonePe / Google Pay";
    withdrawal.processedAt = new Date();
    await withdrawal.save();

    return res.json({
      success: true,
      message: `Withdrawal ${withdrawal.referenceId} marked as Completed! User will see status updated.`,
      withdrawal
    });
  } catch (error) {
    console.error("Admin Complete Error:", error.message);
    return res.status(500).json({ error: "Could not complete withdrawal: " + error.message });
  }
});

// REJECT WITHDRAWAL & REFUND COINS (If player entered invalid UPI or cheated)
app.post("/api/admin/withdrawals/:id/reject", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const reason = String(req.body.reason || "Invalid UPI / Bank details or rejected by host").trim();

    const withdrawal = await Withdrawal.findById(id);
    if (!withdrawal) {
      return res.status(404).json({ error: "Withdrawal record not found." });
    }

    if (withdrawal.status === "Completed") {
      return res.status(400).json({ error: "Cannot reject a withdrawal that has already been marked Completed." });
    }

    if (withdrawal.status === "Failed") {
      return res.status(400).json({ error: "Withdrawal is already marked Failed / Refunded." });
    }

    // Refund coins back to player
    const refundedUser = await User.findByIdAndUpdate(
      withdrawal.userId,
      { $inc: { virtualCoins: withdrawal.coinsDeducted } },
      { new: true }
    );

    withdrawal.status = "Failed";
    withdrawal.adminNotes = reason;
    withdrawal.processedAt = new Date();
    await withdrawal.save();

    // Log refund transaction
    await Transaction.create({
      userId: withdrawal.userId,
      amount: withdrawal.coinsDeducted,
      transactionType: "refund",
      description: `Refund +${withdrawal.coinsDeducted} coins for rejected payout ${withdrawal.referenceId}: ${reason}`
    }).catch(e => console.error("Refund transaction log error:", e.message));

    return res.json({
      success: true,
      message: `Withdrawal ${withdrawal.referenceId} rejected and ${withdrawal.coinsDeducted} coins refunded to player!`,
      refundedUserBalance: refundedUser ? refundedUser.virtualCoins : null,
      withdrawal
    });
  } catch (error) {
    console.error("Admin Reject Error:", error.message);
    return res.status(500).json({ error: "Could not reject withdrawal: " + error.message });
  }
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
function startServer() {
  const localIp = getLocalIpAddress();

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 CoinRush server running on port ${PORT}:`);
    console.log(`💻 Local computer:         http://localhost:${PORT}`);
    console.log(`📱 Other devices on Wi-Fi: http://${localIp}:${PORT}`);
    console.log(`📄 Login page:             http://${localIp}:${PORT}/login.html`);
    console.log(`🎮 Dashboard:              http://${localIp}:${PORT}/index.html`);
  });

  server.on("error", (err) => {
    console.error("❌ Server listen error:", err.message);
  });
}

startServer();