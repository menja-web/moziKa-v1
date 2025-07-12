const express = require("express");
const router = express.Router();
const requireLogin = require("../middleware/requireLogin");

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

module.exports = router;
