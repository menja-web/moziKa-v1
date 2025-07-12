const express = require('express');
const router = express.Router();
const Music = require('../models/Music');

// 📥 GET toutes les musiques
router.get('/music', async (req, res) => {
  try {
    const musics = await Music.find().populate('uploader', 'username');
    res.json({ status: 'success', musics });
  } catch (err) {
    console.error('Erreur récupération musiques :', err);
    res.status(500).json({ status: 'error', message: 'Impossible de récupérer les musiques' });
  }
});

// 📥 GET une musique par ID
router.get('/music/:id', async (req, res) => {
  try {
    const music = await Music.findById(req.params.id).populate('uploader', 'username');
    if (!music) return res.status(404).json({ status: 'error', message: 'Musique non trouvée' });
    res.json({ status: 'success', music });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Erreur lors de la récupération' });
  }
});

// ❌ DELETE une musique (sans middleware requireLogin)
router.delete('/music/:id', async (req, res) => {
  try {
    const music = await Music.findById(req.params.id);
    if (!music) return res.status(404).json({ status: 'error', message: 'Musique introuvable' });

    // Optionnel : vérifier que l'uploader est bien celui connecté
    if (music.uploader.toString() !== req.session.user?._id) {
      return res.status(403).json({ status: 'error', message: 'Accès refusé' });
    }

    await music.deleteOne();
    res.json({ status: 'success', message: 'Musique supprimée' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Erreur suppression musique' });
  }
});

module.exports = router;
