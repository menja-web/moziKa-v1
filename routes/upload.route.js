const express = require("express");
const router  = express.Router();
const multer  = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");
const Music = require("../models/Music");

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "mozikafiles",
    resource_type: "auto",
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
      path:     musicFile.path,
      cover:    coverFile.path,
      uploader: req.session.user?.username || "inconnu"
    });

    res.json({ status: "success", music: newMusic });
  } catch (err) {
    console.error("Erreur upload Cloudinary :", err);
    res.status(500).json({ status: "error", message: "Échec de l'upload" });
  }
});

module.exports = router;
