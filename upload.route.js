const express = require("express");
const router  = express.Router();
const multer  = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary"); // ton fichier config
const Music = require("../models/music.model");     // ton modèle MongoDB

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "mozikafiles", // nom du dossier dans ton Cloudinary
    resource_type: "auto", // audio, image
    allowed_formats: ["jpg", "png", "jpeg", "mp3", "wav"]
  }
});

const upload = multer({ storage });

router.post("/upload", upload.fields([
  { name: "musicFile" },
  { name: "coverFile" }
]), async (req, res) => {
  try {
    const musicFile = req.files.musicFile[0];
    const coverFile = req.files.coverFile[0];

    const newMusic = await Music.create({
      title:    req.body.title,
      category: req.body.category,
      path:     musicFile.path,   // lien Cloudinary du MP3
      cover:    coverFile.path,   // lien Cloudinary de la cover
      uploader: req.session.user?.username || "inconnu"
    });

    res.json({ status: "success", music: newMusic });
  } catch (err) {
    console.error("Erreur upload Cloudinary :", err);
    res.status(500).json({ status: "error", message: "Échec de l'upload" });
  }
});

module.exports = router;
