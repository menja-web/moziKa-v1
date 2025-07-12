const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ["auditeur", "artiste", "admin"],
    default: "auditeur"
  },
  favorites: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Music"
  }],
  uploads: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Music"
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("User", userSchema);
