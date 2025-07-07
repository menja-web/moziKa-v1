const express = require('express');
const path = require('path');
const app = express();
const PORT = 3001;

app.use(express.static(path.join(__dirname, 'public'))); // dossier contenant upload.html

app.listen(PORT, () => {
  console.log(`Frontend servi sur http://localhost:${PORT}`);
});
