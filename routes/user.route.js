const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const User = require("../models/User");

// 🔓 Connexion utilisateur
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ status: "error", message: "Email incorrect." });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ status: "error", message: "Mot de passe incorrect." });

    // ✅ Stockage session AVEC _id
    req.session.user = {
      _id: user._id,
      username: user.username,
      email: user.email,
      role: user.role || "auditeur"
    };

    res.json({ status: "success", message: "Connexion réussie." });
  } catch (err) {
    console.error("Erreur login :", err);
    res.status(500).json({ status: "error", message: "Erreur serveur." });
  }
});

module.exports = router;
