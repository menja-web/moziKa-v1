const express = require('express');
const router  = express.Router();
const Music   = require('../models/Music');
const isAdmin = require('../middlewares/isAdmin'); // protection admin

// Route GET /api/admin/musics
router.get('/', isAdmin, async (req, res) => {
  try {
    const musics = await Music.find()
      .populate('uploader', 'username') // on affiche le nom d'uploader
      .sort({ uploadedAt: -1 })         // plus récentes en premier
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
    console.error('Erreur admin/musics :', err);
    res.status(500).json({ status:'error', message:'Erreur serveur' });
  }
});

// Route DELETE /api/admin/musics/:id
router.delete('/:id', isAdmin, async (req, res) => {
  try {
    await Music.findByIdAndDelete(req.params.id);
    res.json({ status:'success', message:'Musique supprimée.' });
  } catch (err) {
    console.error('Erreur suppression admin :', err);
    res.status(500).json({ status:'error', message:'Échec suppression.' });
  }
});

module.exports = router;
