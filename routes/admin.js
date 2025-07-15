const express = require('express');
const router = express.Router();
const Music = require('../models/Music');
const User = require('../models/User');
const isAdmin = require('../middlewares/isAdmin'); // si tu l’as

// ─── Liste des musiques ─────────────────────────────
router.get('/admin/musics', isAdmin, async (req, res) => {
  try {
    const musics = await Music.find().sort({ listenCount: -1 });
    res.json({ musics });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── Statistiques pour dashboard ───────────────────
router.get('/admin/stats', isAdmin, async (req, res) => {
  try {
    const userCount = await User.countDocuments();
    const musicCount = await Music.countDocuments();
    res.json({ userCount, musicCount });
  } catch (err) {
    res.status(500).json({ error: 'Erreur stats' });
  }
});

module.exports = router;
