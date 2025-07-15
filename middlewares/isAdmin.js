router.get('/', async (req, res) => {
  if (!req.user || req.user.isAdmin !== true) {
    return res.status(403).json({ error: "Accès refusé : admin requis." });
  }

  console.log("✅ Accès manuel →", req.user.username);

  try {
    const musics = await Music.find()
      .populate('uploader', 'username')
      .sort({ uploadedAt: -1 })
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
