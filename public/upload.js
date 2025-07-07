const express = require("express");
const multer = require("multer");
const fetch = require("node-fetch");
const path = require("path");

const router = express.Router();
const API_URL = "https://script.google.com/macros/s/AKfycbzAQHpV6Vx0n_s9XtCLNbw-ku-t2jhm_MQFRHsf58iMXRAMXuFUDDiYRaaE806CR3aDBg/exec";

// 🎯 Config stockage des fichiers
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "public/uploads"),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = Date.now() + "-" + file.fieldname + ext;
    cb(null, name);
  }
});

const upload = multer({ storage });

router.post("/upload", upload.fields([
  { name: "musicFile", maxCount: 1 },
  { name: "coverImage", maxCount: 1 }
]), async (req, res) => {
  try {
    const { title } = req.body;
    const uploader_email = req.body.uploader_email || "";
    const uploader_name = req.body.uploader_name || "Inconnu";

    if (!title || !req.files.musicFile || !req.files.coverImage) {
      return res.status(400).send("Tous les champs sont requis.");
    }

    const musicUrl = "/uploads/" + req.files.musicFile[0].filename;
    const coverUrl = "/uploads/" + req.files.coverImage[0].filename;

    // 🔗 Envoi vers Apps Script
    const response = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "addMusic",
        data: {
          title,
          url: musicUrl,
          cover: coverUrl,
          uploader_email,
          uploader_name
        }
      })
    });

    const result = await response.json();
    console.log("Réponse Apps Script :", result);

    if (result.status === "success") {
      res.redirect("/accueil.html");
    } else {
      res.send("Erreur : " + result.message);
    }
  } catch (error) {
    console.error("Erreur upload :", error);
    res.status(500).send("Erreur serveur");
  }
});

module.exports = router;
