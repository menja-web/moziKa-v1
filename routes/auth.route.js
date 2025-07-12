const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const User = require("../models/User");

// 🔓 Connexion
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ status: "error", message: "Email incorrect." });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ status: "error", message: "Mot de passe incorrect." });

    // ✅ Stockage session avec _id
    req.session.user = {
      _id: user._id,
      username: user.username,
      email: user.email,
      role: user.role || "auditeur"
    };

    res.json({
      status: "success",
      message: "Connexion réussie.",
      username: user.username,
      email: user.email
    });
  } catch (err) {
    console.error("❌ Erreur login :", err);
    res.status(500).json({ status: "error", message: "Erreur serveur." });
  }
});

// 🆕 Inscription
router.post("/register", async (req, res) => {
  const { email, username, password } = req.body;

  try {
    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ status: "error", message: "Email déjà utilisé." });

    const hashed = await bcrypt.hash(password, 10);
    const newUser = await User.create({ email, username, password: hashed });

    // ✅ Session directe après inscription
    req.session.user = {
      _id: newUser._id,
      username: newUser.username,
      email: newUser.email,
      role: newUser.role || "auditeur"
    };

    res.json({
      status: "success",
      message: "Inscription réussie.",
      username: newUser.username,
      email: newUser.email
    });
  } catch (err) {
    console.error("❌ Erreur register :", err);
    res.status(500).json({ status: "error", message: "Erreur serveur." });
  }
});

module.exports = router;
