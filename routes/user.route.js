const express = require("express");
const router = express.Router();
const requireLogin = require("../middleware/requireLogin");
const bcrypt = require("bcrypt");
const User = require("../models/User"); // modèle User pour la modif de mot de passe

// 📥 Récupérer les infos de l’utilisateur connecté
router.get("/user-info", requireLogin, (req, res) => {
  const user = req.session.user;
  res.json({
    status: "success",
    email: user.email,
    username: user.username,
    role: user.role || "auditeur"
  });
});

// 📥 Récupérer la session
router.get("/get-session", (req, res) => {
  if (!req.session || !req.session.user) {
    return res.json({ status: "error", message: "Session inactive" });
  }
  res.json({ status: "success", user: req.session.user });
});

// ❌ Se déconnecter
router.post("/logout", requireLogin, (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ status: "error", message: "Erreur lors de la déconnexion." });
    res.clearCookie("connect.sid");
    res.json({ status: "success", message: "Déconnecté avec succès." });
  });
});

// 🔐 Modifier le mot de passe
router.post("/change-password", requireLogin, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.session.user._id;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ status: "error", message: "Utilisateur introuvable." });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ status: "error", message: "Mot de passe actuel incorrect." });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    res.json({ status: "success", message: "Mot de passe mis à jour avec succès." });
  } catch (err) {
    console.error("Erreur changement mot de passe :", err);
    res.status(500).json({ status: "error", message: "Erreur serveur." });
  }
});

module.exports = router;
