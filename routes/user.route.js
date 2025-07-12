const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");           // Pour validation ObjectId si besoin
const User = require("../models/User");
const Music = require("../models/Music");       // ← Pense à créer models/Music.js

// 📥 Récupérer la session
router.get("/get-session", (req, res) => {
  if (!req.session?.user) {
    return res.json({ status: "error", message: "Session inactive" });
  }
  res.json({ status: "success", user: req.session.user });
});

// ❌ Se déconnecter
router.post("/logout", (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ status: "error", message: "Erreur lors de la déconnexion." });
    }
    res.clearCookie("connect.sid");
    res.json({ status: "success", message: "Déconnecté avec succès." });
  });
});

// 📊 Infos utilisateur
router.get("/user-info", (req, res) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ status: "error", message: "Utilisateur non connecté." });
  }
  res.json({
    status: "success",
    email: user.email,
    username: user.username,
    role: user.role || "auditeur"
  });
});

// 🔐 Modifier mot de passe
router.post("/change-password", async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.session?.user?._id;

  if (!userId) {
    return res.status(401).json({ status: "error", message: "Session invalide." });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ status: "error", message: "Utilisateur introuvable." });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ status: "error", message: "Mot de passe actuel incorrect." });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ status: "success", message: "Mot de passe mis à jour avec succès." });
  } catch (err) {
    console.error("❌ Erreur changement mot de passe :", err);
    res.status(500).json({ status: "error", message: "Erreur serveur." });
  }
});

// 🎵 Récupérer la liste des favoris
router.get("/favorites", async (req, res) => {
  const userId = req.session?.user?._id;
  if (!userId) {
    return res.status(401).json({ status: "error", message: "Utilisateur non connecté." });
  }

  try {
    // ← AJOUT de .populate pour obtenir les objets Music complets
    const user = await User.findById(userId).populate("favorites");
    if (!user) {
      return res.status(404).json({ status: "error", message: "Utilisateur introuvable." });
    }

    res.json({
      status: "success",
      favorites: user.favorites || []
    });
  } catch (err) {
    console.error("❌ Erreur récupération favoris :", err);
    res.status(500).json({ status: "error", message: "Erreur serveur lors du chargement des favoris." });
  }
});

// ➕ Ajouter un favori
router.post("/favorites/add", async (req, res) => {
  const userId = req.session?.user?._id;
  const { musicId } = req.body;

  if (!userId) {
    return res.status(401).json({ status: "error", message: "Utilisateur non connecté." });
  }
  if (!musicId || !mongoose.Types.ObjectId.isValid(musicId)) {
    return res.status(400).json({ status: "error", message: "ID musique invalide." });
  }

  try {
    await User.findByIdAndUpdate(userId, { $addToSet: { favorites: musicId } });
    res.json({ status: "success", message: "Ajouté aux favoris." });
  } catch (err) {
    console.error("❌ Erreur ajout favoris :", err);
    res.status(500).json({ status: "error", message: "Erreur serveur." });
  }
});

// ➖ Retirer un favori
router.post("/favorites/remove", async (req, res) => {
  const userId = req.session?.user?._id;
  const { musicId } = req.body;

  if (!userId) {
    return res.status(401).json({ status: "error", message: "Utilisateur non connecté." });
  }
  if (!musicId || !mongoose.Types.ObjectId.isValid(musicId)) {
    return res.status(400).json({ status: "error", message: "ID musique invalide." });
  }

  try {
    await User.findByIdAndUpdate(userId, { $pull: { favorites: musicId } });
    res.json({ status: "success", message: "Musique retirée des favoris." });
  } catch (err) {
    console.error("❌ Erreur suppression favori :", err);
    res.status(500).json({ status: "error", message: "Erreur serveur." });
  }
});

// 🗑️ Supprimer un upload (music)
router.post("/music/delete", async (req, res) => {
  const userId = req.session?.user?._id;
  const { musicId } = req.body;

  if (!userId) {
    return res.status(401).json({ status: "error", message: "Utilisateur non connecté." });
  }
  if (!musicId || !mongoose.Types.ObjectId.isValid(musicId)) {
    return res.status(400).json({ status: "error", message: "ID musique invalide." });
  }

  try {
    await Music.findByIdAndDelete(musicId);
    await User.findByIdAndUpdate(userId, { $pull: { uploads: musicId } });
    res.json({ status: "success", message: "Musique supprimée." });
  } catch (err) {
    console.error("❌ Erreur suppression musique :", err);
    res.status(500).json({ status: "error", message: "Erreur serveur." });
  }
});

module.exports = router;
