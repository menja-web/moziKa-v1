// routes/admin.js
const express = require('express');
const router = express.Router();

router.get('/dashboard', (req, res) => {
  res.json({ status: 'success', message: 'Admin dashboard actif.' });
});

module.exports = router;
