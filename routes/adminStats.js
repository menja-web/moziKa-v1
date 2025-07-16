// routes/adminStats.js
const express = require('express');
const router = express.Router();

router.get('/stats', (req, res) => {
  res.json({ status: 'success', message: 'Statistiques administrateur disponibles.' });
});

module.exports = router;
