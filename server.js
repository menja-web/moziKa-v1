require('dotenv').config();
const express    = require('express');
const mongoose   = require('mongoose');
const path       = require('path');
const fs         = require('fs');
const session    = require('express-session');
const MongoStore = require('connect-mongo');
const multer     = require('multer');
const nodemailer = require('nodemailer');
const bcrypt     = require('bcrypt');
const crypto     = require('crypto');

// --- Connexion MongoDB ---
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connecté'))
  .catch(err => console.error('❌ Erreur MongoDB :', err));

const app  = express();
const PORT = process.env.PORT || 3000;

// --- Fichiers et dossiers ---
const uploadDir     = path.join(__dirname, 'uploads');
const usersFile     = path.join(__dirname, 'users.json');
const musicsFile    = path.join(__dirname, 'musics.json');
const resetFile     = path.join(__dirname, 'resetTokens.json');
const favoritesFile = path.join(__dirname, 'favorites.json');

if (!fs.existsSync(uploadDir))     fs.mkdirSync(uploadDir);
if (!fs.existsSync(usersFile))     fs.writeFileSync(usersFile, JSON.stringify([]));
if (!fs.existsSync(musicsFile))    fs.writeFileSync(musicsFile, JSON.stringify([]));
if (!fs.existsSync(resetFile))     fs.writeFileSync(resetFile, JSON.stringify([]));
if (!fs.existsSync(favoritesFile)) fs.writeFileSync(favoritesFile, JSON.stringify([]));

let musics = JSON.parse(fs.readFileSync(musicsFile));

// --- Middlewares ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    ttl: 24 * 60 * 60
  }),
  cookie: {
    maxAge: 3600000,
    sameSite: 'lax',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production'
  }
}));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadDir));
app.use('/data', express.static(path.join(__dirname, 'data')));

// Multer pour upload fichiers
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename:    (req, file, cb) => {
    const ext    = path.extname(file.originalname);
    const uniq   = Date.now() + '-' + Math.floor(Math.random() * 10000);
    const prefix = file.fieldname === 'musicFile' ? 'music-' : 'cover-';
    cb(null, prefix + uniq + ext);
  }
});
const upload = multer({ storage });

// Vérification de session
function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.status(403).json({ status: "error", message: "Non connecté." });
  }
  next();
}

// --- PARTIE 1 : Authentification ---

// 1. Envoi du code de vérification
app.post('/api/send-code', async (req, res) => {
  const { email, username, password } = req.body;
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });
    await transporter.sendMail({
      from: 'MoziKa <' + process.env.EMAIL_USER + '>',
      to: email,
      subject: '🔐 Ton code de vérification MoziKa',
      text: `Bonjour ${username},\n\nTon code MoziKa : ${code}`
    });
    req.session.verificationCode = code;
    req.session.pendingUser       = { email, username, password };
    res.json({ status: "success", message: "Code envoyé !" });
  } catch (err) {
    console.error('send-code error:', err);
    res.status(500).json({ status: "error", message: "Échec envoi mail." });
  }
});

// 2. Validation du code et inscription
app.post('/api/register', (req, res) => {
  const { code } = req.body;
  const pending  = req.session.pendingUser;
  if (!pending || code !== req.session.verificationCode) {
    return res.status(400).json({ status: "error", message: "Code invalide." });
  }
  const users = JSON.parse(fs.readFileSync(usersFile));
  if (users.find(u => u.email.toLowerCase() === pending.email.toLowerCase())) {
    return res.status(409).json({ status: "error", message: "Email déjà utilisé." });
  }
  const hash = bcrypt.hashSync(pending.password, 10);
  users.push({
    username: pending.username,
    email:    pending.email,
    password: hash,
    joinedAt: new Date().toISOString()
  });
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
  req.session.user = { username: pending.username, email: pending.email };
  delete req.session.pendingUser;
  delete req.session.verificationCode;
  res.json({ status: "success", message: "Inscription réussie !" });
});

// 3. Connexion
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const users = JSON.parse(fs.readFileSync(usersFile));
  const u     = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!u || !bcrypt.compareSync(password, u.password)) {
    return res.status(401).json({ status: "error", message: "Identifiants invalides." });
  }
  req.session.user = { username: u.username, email: u.email };
  res.json({ status: "success", username: u.username, email: u.email });
});

// 4. Déconnexion
app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.redirect('/');
    res.clearCookie('connect.sid');
    res.redirect('/');
  });
});

// --- PARTIE 2 : Upload & Écoutes ---

// 5. Upload musique + cover
app.post('/api/upload', requireLogin, upload.fields([
  { name: 'musicFile', maxCount: 1 },
  { name: 'coverFile', maxCount: 1 }
]), (req, res) => {
  const user       = req.session.user;
  const { title, category } = req.body;
  const mf         = req.files['musicFile']?.[0];
  const cf         = req.files['coverFile']?.[0];
  if (!title || !category || !mf || !cf) {
    return res.status(400).json({ status: "error", message: "Champs manquants." });
  }
  const newMusic = {
    title,
    category,
    uploader_email: user.email,
    uploader_name:  user.username,
    path:           "/uploads/" + mf.filename,
    cover:          "/uploads/" + cf.filename,
    listenCount:    0,
    downloadCount:  0,
    listeners:      [],
    downloaders:    [],
    uploadedAt:     new Date().toISOString()
  };
  musics.push(newMusic);
  fs.writeFileSync(musicsFile, JSON.stringify(musics, null, 2));
  res.json({ status: "success", music: newMusic });
});

// 6. Compteur d’écoute (unique par user & musique)
app.post('/api/listen', requireLogin, (req, res) => {
  const user = req.session.user;
  const { path } = req.body;
  if (!path) return res.status(400).json({ status: "error" });

  const m = musics.find(m => m.path === path);
  if (!m) return res.status(404).json({ status: "error" });

  m.listeners = m.listeners || [];
  if (!m.listeners.includes(user.email)) {
    m.listenCount++;
    m.listeners.push(user.email);
    fs.writeFileSync(musicsFile, JSON.stringify(musics, null, 2));
  }

  res.json({ status: "success", count: m.listenCount });
});

// --- PARTIE 3 : Téléchargement, suppression, mot de passe ---

// 7. Téléchargement (unique par user & musique)
app.post('/api/download', requireLogin, (req, res) => {
  const user = req.session.user;
  const { path } = req.body;
  if (!path) return res.status(400).json({ status: "error" });

  const m = musics.find(m => m.path === path);
  if (!m) return res.status(404).json({ status: "error" });

  m.downloaders = m.downloaders || [];
  if (!m.downloaders.includes(user.email)) {
    m.downloadCount++;
    m.downloaders.push(user.email);
    fs.writeFileSync(musicsFile, JSON.stringify(musics, null, 2));
  }

  res.json({ status: "success", count: m.downloadCount });
});

// 8. Suppression de musique
app.post('/api/delete', requireLogin, (req, res) => {
  const user   = req.session.user;
  const { path: musicPath } = req.body;
  const idx    = musics.findIndex(m => m.path === musicPath
                                   && m.uploader_email === user.email);
  if (idx === -1) return res.status(403).json({ status: "error" });

  const m = musics[idx];
  // Supprime fichiers physiques
  [m.path, m.cover].forEach(rel => {
    const file = path.join(uploadDir, rel.replace("/uploads/", ""));
    if (fs.existsSync(file)) fs.unlinkSync(file);
  });

  musics.splice(idx, 1);
  fs.writeFileSync(musicsFile, JSON.stringify(musics, null, 2));
  res.json({ status: "success" });
});

// 9. Demande de réinitialisation
app.post('/api/reset-request', async (req, res) => {
  const { email } = req.body;
  const users     = JSON.parse(fs.readFileSync(usersFile));
  const u         = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!u) return res.json({ status: "error", message: "Adresse inconnue." });

  const token     = crypto.randomBytes(24).toString('hex');
  const expiresAt = Date.now() + 15 * 60 * 1000;
  const tokens    = JSON.parse(fs.readFileSync(resetFile));
  tokens.push({ email: u.email, token, expiresAt });
  fs.writeFileSync(resetFile, JSON.stringify(tokens, null, 2));

  const link = `http://localhost:${PORT}/new-password.html?token=${token}`;
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });
    await transporter.sendMail({
      from: 'MoziKa <' + process.env.EMAIL_USER + '>',
      to: u.email,
      subject: '🔐 Réinitialisation MoziKa',
      text: `Bonjour ${u.username},\n\nVoici ton lien : ${link}\nValable 15 minutes.`
    });
    res.json({ status: "success", message: "Lien envoyé !" });
  } catch (err) {
    console.error('reset-request error:', err);
    res.status(500).json({ status: "error", message: "Échec envoi mail." });
  }
});

// 10. Réinitialisation du mot de passe
app.post('/api/reset-password', (req, res) => {
  const { token, newPassword } = req.body;
  const tokens = JSON.parse(fs.readFileSync(resetFile));
  const entry  = tokens.find(t => t.token === token);
  if (!entry || Date.now() > entry.expiresAt) {
    return res.status(400).json({ status: "error", message: "Lien invalide ou expiré." });
  }
  const users = JSON.parse(fs.readFileSync(usersFile));
  const u     = users.find(u => u.email === entry.email);
  if (!u) return res.status(400).json({ status: "error", message: "Utilisateur introuvable." });

  u.password = bcrypt.hashSync(newPassword, 10);
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
  // On purge le token utilisé
  fs.writeFileSync(resetFile,
    JSON.stringify(tokens.filter(t => t.token !== token), null, 2)
  );

  res.json({ status: "success", message: "Mot de passe modifié !" });
});

// 11. Changement de mot de passe (depuis profil)
app.post('/api/change-password', requireLogin, (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const users = JSON.parse(fs.readFileSync(usersFile));
  const u     = users.find(u => u.email === req.session.user.email);
  if (!u) {
    return res.status(404).json({ status: "error", message: "Utilisateur introuvable." });
  }
  if (!bcrypt.compareSync(oldPassword, u.password)) {
    return res.status(403).json({ status: "error", message: "Ancien mot de passe incorrect." });
  }
  u.password = bcrypt.hashSync(newPassword, 10);
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
  res.json({ status: "success", message: "Mot de passe mis à jour !" });
});

// --- PARTIE 4 : Favoris, Top, Session, Profil ---

// 12. Ajouter un favori
app.post("/api/add-favorite", requireLogin, (req, res) => {
  const { path } = req.body;
  const users    = JSON.parse(fs.readFileSync(usersFile));
  const u        = users.find(u => u.email === req.session.user.email);
  u.favorites    = u.favorites || [];
  if (!u.favorites.includes(path)) u.favorites.push(path);
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
  res.json({ status: "success" });
});

// 13. Récupérer les favoris
app.get("/api/favorites", requireLogin, (req, res) => {
  const users = JSON.parse(fs.readFileSync(usersFile));
  const u     = users.find(u => u.email === req.session.user.email);
  const favs  = u.favorites || [];
  const favMusics = musics.filter(m => favs.includes(m.path));
  res.json({ status: "success", favorites: favMusics });
});

// 14. Musiques uploadées par l’utilisateur
app.get('/api/musics-by-user', requireLogin, (req, res) => {
  const list = JSON.parse(fs.readFileSync(musicsFile));
  const own  = list.filter(m => m.uploader_email === req.session.user.email);
  res.json({ status: "success", musics: own });
});

// 15. Top 5 musiques les plus écoutées
app.get("/api/top", (req, res) => {
  const top = musics
    .filter(m => typeof m.listenCount === 'number')
    .sort((a, b) => b.listenCount - a.listenCount)
    .slice(0, 5);
  res.json({ top });
});

// 16. Vérifier session
app.get("/api/get-session", (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ status: "error", message: "Non connecté." });
  }
  res.json({ status: "success", user: req.session.user });
});

// 17. Récupérer email de session
app.get("/api/user-email", (req, res) => {
  res.json({ email: req.session.user?.email || "" });
});

// 18. Toutes les musiques (accueil)
app.get('/api/musics', (req, res) => {
  const list = JSON.parse(fs.readFileSync(musicsFile));
  res.json({ musics: list });
});

// 19. Retirer un favori
app.post("/api/remove-favorite", requireLogin, (req, res) => {
  const { path } = req.body;
  const users    = JSON.parse(fs.readFileSync(usersFile));
  const u        = users.find(u => u.email === req.session.user.email);
  u.favorites    = (u.favorites || []).filter(p => p !== path);
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
  res.json({ status: "success" });
});

// 20. Mise à jour écoute via AJAX (alternative)
/* Si tu utilises `/api/update-listen` depuis le front,
   ça fait la même chose que /api/listen, mais tu peux garder cette route. */
app.post("/api/update-listen", requireLogin, (req, res) => {
  const { path, email } = req.body;
  const list = JSON.parse(fs.readFileSync(musicsFile));
  const idx  = list.findIndex(m => m.path === path);
  if (idx === -1) return res.status(404).json({ status: "error" });
  const m = list[idx];
  m.listeners = m.listeners || [];
  if (!m.listeners.includes(email)) {
    m.listenCount++;
    m.listeners.push(email);
    fs.writeFileSync(musicsFile, JSON.stringify(list, null, 2));
  }
  res.json({ status: "success", listenCount: m.listenCount });
});

// 21. Mise à jour photo profil
const photoUpload = multer({ dest: path.join(__dirname, 'public/faces/') });
app.post("/api/update-photo", photoUpload.single("photo"), (req, res) => {
  const { username } = req.body;
  const file        = req.file;
  if (!username || !file) return res.json({ success: false });
  const ext       = path.extname(file.originalname);
  const newName   = file.filename + ext;
  const destPath  = path.join(__dirname, 'public', 'faces', newName);
  fs.renameSync(file.path, destPath);
  const publicPath = './faces/' + newName;

  const creatorsFile = path.join(__dirname, 'data', 'createurs.json');
  if (!fs.existsSync(creatorsFile)) fs.writeFileSync(creatorsFile, JSON.stringify([]));
  const creators = JSON.parse(fs.readFileSync(creatorsFile));
  const idx      = creators.findIndex(c => c.username === username);
  if (idx !== -1) {
    creators[idx].photo = publicPath;
    fs.writeFileSync(creatorsFile, JSON.stringify(creators, null, 2));
    return res.json({ success: true, newPath: publicPath });
  }
  res.json({ success: false });
});

// 22. Route liste des créateurs (externe)
const createurListRoute = require("./routes/get-createurs");
app.use(createurListRoute);

// --- Lancement du serveur ---
app.listen(PORT, () => {
  console.log(`🎵 Serveur MoziKa actif sur http://localhost:${PORT}`);
});
