const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();

router.get("/api/createurs", (req, res) => {
  const filePath = path.join(__dirname, "../data/createurs.json");

  fs.readFile(filePath, "utf8", (err, data) => {
    if (err) {
      console.error("Erreur lecture createurs.json :", err);
      return res.status(500).json({ error: "Impossible de lire le fichier." });
    }

    try {
      const createurs = JSON.parse(data);
      res.json(createurs);
    } catch (parseError) {
      console.error("Erreur parsing JSON :", parseError);
      res.status(500).json({ error: "Format JSON invalide." });
    }
  });
});

module.exports = router;
