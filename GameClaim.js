const mongoose = require("mongoose");

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

module.exports = mongoose.model("GameClaim", gameClaimSchema);
