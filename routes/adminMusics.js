// routes/adminMusics.js
const express = require('express');
const router = express.Router();
const isAdmin = require('../middlewares/isAdmin');
const Music = require('../models/Music');

router.get('/musics', isAdmin, async (req, res) => {
  try {
    const musics = await Music.find({});
    console.log('→ Musiques trouvées :', musics.length);
    res.json({ musics });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la récupération des musiques.' });
  }
});

router.delete('/musics/:id', isAdmin, async (req, res) => {
  try {
    const music = await Music.findById(req.params.id);
    if (!music) return res.status(404).json({ error: 'Musique introuvable.' });

    await Music.deleteOne({ _id: req.params.id });
    res.json({ status: 'success', message: 'Musique supprimée.' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur lors de la suppression.' });
  }
});

module.exports = router;
