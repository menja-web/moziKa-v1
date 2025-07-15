// routes/adminStats.js
const express = require('express');
const router = express.Router();
const isAdmin = require('../middlewares/isAdmin');

const Music = require('../models/Music');
const User = require('../models/User');

router.get('/stats', isAdmin, async (req, res) => {
  try {
    const musiques = await Music.find({});
    const totalEcoutes = musiques.reduce((sum, m) => sum + (m.listenCount || 0), 0);
    const totalTelechargements = musiques.reduce((sum, m) => sum + (m.downloadCount || 0), 0);

    const artistes = new Set(musiques.map(m => m.uploader).filter(Boolean));
    const usersActifs = await User.countDocuments({
      $or: [
        { lastListen: { $exists: true } },
        { lastDownload: { $exists: true } }
      ]
    });

    res.json({
      usersActifs,
      artistes: artistes.size,
      musiques: musiques.length,
      totalEcoutes,
      totalTelechargements
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur adminStats.' });
  }
});

module.exports = router;
