// routes/adminMusicsRoutes.js
const express  = require('express');
const router   = express.Router();
const Music    = require('../models/Music');
const isAdmin  = require('../middlewares/isAdmin'); // middleware de sécurité
router.get('/debug', async (req, res) => {
  res.json({ user: req.user, session: req.session });
});

// GET toutes les musiques (admin only)
router.get('/', isAdmin, async (req, res) => {
  console.log("🛡️ Admin Check →", req.user?.username, "isAdmin =", req.user?.isAdmin);

  try {
    const musics = await Music.find()
      .populate('uploader', 'username') // récupérer le nom de l'uploader
      .sort({ uploadedAt: -1 })         // les plus récentes d'abord
      .lean();

    const formatted = musics.map(m => ({
      _id:           m._id,
      title:         m.title,
      category:      m.category,
      uploader:      m.uploader?.username || 'Anonyme',
      uploadedAt:    m.uploadedAt,
      listenCount:   m.listenCount ?? 0,
      downloadCount: m.downloadCount ?? 0
    }));

    res.json({ status: 'success', musics: formatted });
  } catch (err) {
    console.error('❌ Erreur dans admin/musics :', err);
    res.status(500).json({ status: 'error', message: 'Erreur serveur' });
  }
});

// DELETE une musique par son ID (admin only)
router.delete('/:id', isAdmin, async (req, res) => {
  try {
    await Music.findByIdAndDelete(req.params.id);
    res.json({ status: 'success', message: 'Musique supprimée.' });
  } catch (err) {
    console.error('❌ Erreur suppression admin :', err);
    res.status(500).json({ status: 'error', message: 'Échec suppression.' });
  }
});

module.exports = router;
