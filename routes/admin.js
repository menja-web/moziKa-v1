const express = require('express');
const router = express.Router();
const Music = require('../models/Music');
const User = require('../models/User');

// ─── Vérification admin interne ─────────────────────
function checkAdmin(req, res, next) {
  if (req.user?.isAdmin === true) return next();
  return res.status(403).json({ error: 'Accès refusé : admin requis.' });
}

// ─── /api/admin/musics ──────────────────────────────
router.get('/musics', checkAdmin, async (req, res) => {
  try {
    const musics = await Music.find().populate('uploader', 'username').sort({ uploadedAt: -1 }).lean();
    const formatted = musics.map(m => ({
      _id: m._id,
      title: m.title,
      category: m.category,
      uploader: m.uploader?.username || 'Anonyme',
      uploadedAt: m.uploadedAt,
      listenCount: m.listenCount || 0,
      downloadCount: m.downloadCount || 0
    }));
    res.json({ musics: formatted });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── /api/admin/musics/:id DELETE ───────────────────
router.delete('/musics/:id', checkAdmin, async (req, res) => {
  try {
    await Music.findByIdAndDelete(req.params.id);
    res.json({ status: 'success', message: 'Musique supprimée.' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur suppression.' });
  }
});

// ─── /api/admin/stats ───────────────────────────────
router.get('/stats', checkAdmin, async (req, res) => {
  try {
    const musiques = await Music.find({});
    const totalEcoutes = musiques.reduce((sum, m) => sum + (m.listenCount || 0), 0);
    const totalTelechargements = musiques.reduce((sum, m) => sum + (m.downloadCount || 0), 0);
    const artistes = new Set(musiques.map(m => m.uploader).filter(Boolean));

    const usersActifs = await User.countDocuments({
      $or: [{ lastListen: { $exists: true } }, { lastDownload: { $exists: true } }]
    });

    res.json({
      usersActifs,
      artistes: artistes.size,
      musiques: musiques.length,
      totalEcoutes,
      totalTelechargements
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur stats.' });
  }
});

module.exports = router;
