// server.js

require('dotenv').config();             // Charge les variables d'environnement
const mongoose    = require('mongoose');
const express     = require('express');
const path        = require('path');
const fs          = require('fs');
const session     = require('express-session');
const MongoStore  = require('connect-mongo');  // Stockage persistant des sessions
const multer      = require('multer');
const nodemailer  = require('nodemailer');
const bcrypt      = require('bcrypt');
const crypto      = require('crypto');

// 1️⃣ Connexion à MongoDB (Atlas)
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connexion à MongoDB réussie'))
  .catch(err => console.error('❌ Erreur MongoDB :', err));

const app  = express();
const PORT = process.env.PORT || 3000;

// 📁 Chemins vers dossiers et fichiers
const uploadDir     = path.join(__dirname, 'uploads');
const usersFile     = path.join(__dirname, 'users.json');
const musicsFile    = path.join(__dirname, 'musics.json');
const resetFile     = path.join(__dirname, 'resetTokens.json');
const favoritesFile = path.join(__dirname, 'favorites.json');

// 🧩 Création des dossiers / fichiers s'ils n'existent pas
if (!fs.existsSync(uploadDir))       fs.mkdirSync(uploadDir);
if (!fs.existsSync(usersFile))       fs.writeFileSync(usersFile, JSON.stringify([]));
if (!fs.existsSync(musicsFile))      fs.writeFileSync(musicsFile, JSON.stringify([]));
if (!fs.existsSync(resetFile))       fs.writeFileSync(resetFile, JSON.stringify([]));
if (!fs.existsSync(favoritesFile))   fs.writeFileSync(favoritesFile, JSON.stringify([]));

// Chargement initial des musiques
let musics = JSON.parse(fs.readFileSync(musicsFile));

// 2️⃣ Middlewares généraux
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ← Remplace MemoryStore par MongoStore pour les sessions
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    ttl: 24 * 60 * 60    // 1 jour en secondes
  }),
  cookie: {
    maxAge: 3600000,       // 1 heure en ms
    sameSite: 'lax',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production'
  }
}));

// Servir les fichiers statiques
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadDir));
app.use('/data', express.static(path.join(__dirname, 'data')));

// Configuration Multer pour uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext    = path.extname(file.originalname);
    const unique = Date.now() + '-' + Math.floor(Math.random() * 10000);
    const prefix = file.fieldname === 'musicFile' ? 'music-' : 'cover-';
    cb(null, prefix + unique + ext);
  }
});
const upload = multer({ storage });

// Middleware pour routes protégées
function requireLogin(req, res, next) {
  if (!req.session.user) return res.status(403).send("Connecte-toi pour accéder.");
  next();
}

// ─── PARTIE 2 : Authentification & Inscription ───

// Envoi du code de vérification par e-mail
app.post('/api/send-code', async (req, res) => {
  const { email, username, password } = req.body;
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'menjaniainarandriamaharitra1@gmail.com',
        pass: 'mexu pndj laak vivo'
      }
    });
    await transporter.sendMail({
      from: 'MoziKa <menjaniainarandriamaharitra@gmail.com>',
      to: email,
      subject: '🔐 Ton code de vérification MoziKa',
      text: `Bonjour ${username},\n\nMerci d’avoir rejoint MoziKa 🎵\nVoici ton code : ${code}\n\nÀ bientôt !`
    });
    req.session.verificationCode = code;
    req.session.pendingUser = { email, username, password };
    res.json({ status: "success", message: "✅ Code envoyé !" });
  } catch (err) {
    console.error("Erreur envoi email :", err);
    res.status(500).json({ status: "error", message: "Erreur d’envoi du mail." });
  }
});

// Validation du code et création du compte
app.post('/api/register', (req, res) => {
  const { code }        = req.body;
  const savedUser       = req.session.pendingUser;
  const validCode       = req.session.verificationCode;
  if (!savedUser || !code || code !== validCode) {
    return res.status(400).json({ status: "error", message: "Code invalide ou expiré." });
  }
  try {
    const users = JSON.parse(fs.readFileSync(usersFile));
    if (users.find(u => u.email.toLowerCase() === savedUser.email.toLowerCase())) {
      return res.status(409).json({ status: "error", message: "Email déjà utilisé." });
    }
    const hash = bcrypt.hashSync(savedUser.password, 10);
    users.push({
      username: savedUser.username,
      email: savedUser.email,
      password: hash,
      joinedAt: new Date().toISOString()
    });
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
    req.session.user = { username: savedUser.username, email: savedUser.email };
    delete req.session.pendingUser;
    delete req.session.verificationCode;
    res.json({ status: "success", message: "Compte créé avec succès !" });
  } catch (err) {
    console.error("Erreur création compte :", err);
    res.status(500).json({ status: "error", message: "Erreur serveur." });
  }
});

// Connexion
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  try {
    const users = JSON.parse(fs.readFileSync(usersFile));
    const user  = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ status: "error", message: "Identifiants invalides." });
    }
    req.session.user = { username: user.username, email: user.email };
    res.json({ status: "success", username: user.username, email: user.email });
  } catch (err) {
    console.error("Erreur login :", err);
    res.status(500).json({ status: "error", message: "Erreur serveur." });
  }
});

// ─── PARTIE 3 : Gestion des musiques ───

// Upload musique + couverture
app.post('/api/upload', requireLogin, upload.fields([
  { name: 'musicFile', maxCount: 1 },
  { name: 'coverFile', maxCount: 1 }
]), (req, res) => {
  const user       = req.session.user;
  const { title, category } = req.body;
  const musicFile  = req.files['musicFile']?.[0];
  const coverFile  = req.files['coverFile']?.[0];
  if (!title || !category || !musicFile || !coverFile) {
    return res.status(400).json({ status: "error", message: "Champs ou fichiers manquants." });
  }
  const newMusic = {
    title,
    category,
    uploader_email: user.email,
    uploader_name: user.username,
    path: "/uploads/" + musicFile.filename,
    cover: "/uploads/" + coverFile.filename,
    listenCount: 0,
    downloadCount: 0,
    uploadedAt: new Date().toISOString()
  };
  musics.push(newMusic);
  fs.writeFileSync(musicsFile, JSON.stringify(musics, null, 2));
  res.json({ status: "success", message: "Musique ajoutée avec succès !", music: newMusic });
});

// Enregistrement d'une écoute
app.post('/api/listen', (req, res) => {
  const { path } = req.body;
  const user     = req.session.user;
  if (!user || !path) return res.status(400).json({ status: "error" });
  if (!req.session.listened) req.session.listened = [];
  const music = musics.find(m => m.path === path);
  if (!music) return res.status(404).json({ status: "error" });
  if (!req.session.listened.includes(path)) {
    music.listenCount++;
    req.session.listened.push(path);
    fs.writeFileSync(musicsFile, JSON.stringify(musics, null, 2));
  }
  res.json({ status: "success", count: music.listenCount });
});

// Téléchargement
app.post('/api/download', (req, res) => {
  const { path } = req.body;
  const music    = musics.find(m => m.path === path);
  if (!music) return res.status(404).json({ status: "error" });
  music.downloadCount++;
  fs.writeFileSync(musicsFile, JSON.stringify(musics, null, 2));
  res.json({ status: "success", count: music.downloadCount });
});

// Suppression de musique
app.post('/api/delete', (req, res) => {
  const { path: musicPath } = req.body;
  const user = req.session.user;
  if (!user || !musicPath) return res.status(400).json({ status: "error" });
  const index = musics.findIndex(m => m.path === musicPath && m.uploader_email === user.email);
  if (index === -1) return res.status(403).json({ status: "error" });
  const music     = musics[index];
  const filePath  = path.join(uploadDir, music.path.replace("/uploads/", ""));
  const coverPath = path.join(uploadDir, music.cover.replace("/uploads/", ""));
  if (fs.existsSync(filePath))  fs.unlinkSync(filePath);
  if (fs.existsSync(coverPath)) fs.unlinkSync(coverPath);
  musics.splice(index, 1);
  fs.writeFileSync(musicsFile, JSON.stringify(musics, null, 2));
  res.json({ status: "success" });
});

// Réinitialisation : demande de lien
app.post("/api/reset-request", async (req, res) => {
  const { email } = req.body;
  const users     = JSON.parse(fs.readFileSync(usersFile));
  const user      = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user) return res.json({ status: "error", message: "Adresse inconnue" });
  const token     = crypto.randomBytes(24).toString("hex");
  const expiresAt = Date.now() + 15 * 60 * 1000;  // 15 minutes
  const resetTokens = JSON.parse(fs.readFileSync(resetFile));
  resetTokens.push({ email: user.email, token, expiresAt });
  fs.writeFileSync(resetFile, JSON.stringify(resetTokens, null, 2));
  const resetLink = `http://localhost:${PORT}/new-password.html?token=${token}`;
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'menjaniainarandriamaharitra1@gmail.com',
        pass: 'mexu pndj laak vivo'
      }
    });
    await transporter.sendMail({
      from: 'MoziKa <menjaniainarandriamaharitra@gmail.com>',
      to: user.email,
      subject: '🔐 Réinitialisation du mot de passe MoziKa',
      text: `Bonjour ${user.username},\n\nVoici ton lien : ${resetLink}\nValable 15 minutes.\n\nMoziKa 💙`
    });
    res.json({ status: "success", message: "Lien envoyé !" });
  } catch (err) {
    console.error("Erreur reset-request :", err);
    res.status(500).json({ status: "error", message: "Erreur d’envoi du mail." });
  }
});

// ─── PARTIE 4 : Changer / Réinitialiser mot de passe & Favoris ───

// Traitement du lien de réinitialisation
app.post("/api/reset-password", (req, res) => {
  const { token, newPassword } = req.body;
  const resetTokens = JSON.parse(fs.readFileSync(resetFile));
  const users       = JSON.parse(fs.readFileSync(usersFile));
  const entry       = resetTokens.find(r => r.token === token);
  if (!entry) return res.status(400).json({ status: "error", message: "Lien invalide." });
  if (Date.now() > entry.expiresAt) {
    return res.status(400).json({ status: "error", message: "Lien expiré." });
  }
  const user = users.find(u => u.email === entry.email);
  if (!user) return res.status(400).json({ status: "error", message: "Utilisateur non trouvé." });
  user.password = bcrypt.hashSync(newPassword, 10);
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
  const updatedTokens = resetTokens.filter(r => r.token !== token);
  fs.writeFileSync(resetFile, JSON.stringify(updatedTokens, null, 2));
  res.json({ status: "success", message: "Mot de passe modifié avec succès !" });
});

// Changement de mot de passe connecté
app.post("/api/change-password", (req, res) => {
  const sessionUser = req.session.user;
  const { oldPassword, newPassword } = req.body;
  if (!sessionUser) return res.status(401).json({ status: "error", message: "Non connecté." });
  const users = JSON.parse(fs.readFileSync(usersFile));
  const user  = users.find(u => u.email === sessionUser.email);
  if (!user) return res.status(404).json({ status: "error", message: "Utilisateur introuvable." });
  if (!bcrypt.compareSync(oldPassword, user.password)) {
    return res.status(403).json({ status: "error", message: "Ancien mot de passe incorrect." });
  }
  user.password = bcrypt.hashSync(newPassword, 10);
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
  res.json({ status: "success", message: "Mot de passe mis à jour ✅" });
});

// Ajouter un favori
app.post("/api/add-favorite", (req, res) => {
  const musicPath   = req.body.path;
  const sessionUser = req.session.user;
  if (!sessionUser || !musicPath) return res.status(400).json({ status: "error" });
  const users = JSON.parse(fs.readFileSync(usersFile));
  const user  = users.find(u => u.email === sessionUser.email);
  if (!user) return res.status(404).json({ status: "error" });
  user.favorites = user.favorites || [];
  if (!user.favorites.includes(musicPath)) user.favorites.push(musicPath);
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
  res.json({ status: "success" });
});

// Récupérer les favoris
app.get("/api/favorites", (req, res) => {
  const sessionUser = req.session.user;
  if (!sessionUser) return res.status(401).json({ status: "error" });
  const users = JSON.parse(fs.readFileSync(usersFile));
  const user  = users.find(u => u.email === sessionUser.email);
  if (!user) return res.status(404).json({ status: "error" });
  const favs      = user.favorites || [];
  const favMusics = musics.filter(m => favs.includes(m.path));
  res.json({ status: "success", favorites: favMusics });
});

// ─── PARTIE 5 : Routes publiques & démarrage ───

// Top 5 musiques
app.get("/api/top", (req, res) => {
  const top = musics
    .filter(m => typeof m.listenCount === "number")
    .sort((a, b) => b.listenCount - a.listenCount)
    .slice(0, 5);
  res.json({ top });
});

// Récupérer l’email en session
app.get("/api/user-email", (req, res) => {
  const sessionUser = req.session.user;
  res.json({ email: sessionUser?.email || "" });
});

// Vérifier session active
app.get("/api/get-session", (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ status: "error", message: "Non connecté." });
  }
  res.json({ status: "success", user: req.session.user });
});

// Toutes les musiques (accueil)
app.get('/api/musics', (req, res) => {
  const all = JSON.parse(fs.readFileSync(musicsFile));
  res.json({ musics: all });
});

// Route créateurs externe
const createurListRoute = require("./routes/get-createurs");
app.use(createurListRoute);

// Mise à jour de la photo de profil
const photoUpload = multer({ dest: path.join(__dirname, 'public/faces/') });
app.post("/api/update-photo", photoUpload.single("photo"), (req, res) => {
  const { username } = req.body;
  const file        = req.file;
  if (!username || !file) return res.json({ success: false });
  const ext         = path.extname(file.originalname);
  const newFilename = file.filename.replace(ext, "") + ext;
  const photoPath   = "./faces/" + newFilename;
  const fullPath    = path.join(__dirname, "public", "faces", newFilename);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.renameSync(file.path, fullPath);
  const createursPath = path.join(__dirname, "data", "createurs.json");
  if (!fs.existsSync(createursPath)) fs.writeFileSync(createursPath, JSON.stringify([]));
  const createurs = JSON.parse(fs.readFileSync(createursPath));
  const idx       = createurs.findIndex(c => c.username === username);
  if (idx !== -1) {
    createurs[idx].photo = photoPath;
    fs.writeFileSync(createursPath, JSON.stringify(createurs, null, 2));
    return res.json({ success: true, newPath: photoPath });
  }
  res.json({ success: false });
});

// Musiques par utilisateur
app.get('/api/musics-by-user', (req, res) => {
  const sessionUser = req.session.user;
  if (!sessionUser) {
    return res.status(401).json({ status: "error", message: "Non connecté." });
  }
  const all     = JSON.parse(fs.readFileSync(musicsFile));
  const uploads = all.filter(m => m.uploader_email === sessionUser.email);
  res.json({ status: "success", musics: uploads });
});

// Retirer un favori (JSON file)
app.post("/api/remove-favorite", (req, res) => {
  const { path }     = req.body;
  const sessionUser  = req.session.user;
  if (!sessionUser || !sessionUser.email) {
    return res.status(401).json({ status: "error" });
  }
  try {
    const favorites = JSON.parse(fs.readFileSync(favoritesFile));
    const updated   = favorites.filter(f => !(f.path === path && f.email === sessionUser.email));
    fs.writeFileSync(favoritesFile, JSON.stringify(updated, null, 2));
    res.json({ status: "success" });
  } catch (err) {
    console.error("Erreur retrait favori :", err);
    res.status(500).json({ status: "error" });
  }
});

// Mettre à jour le compteur d'écoutes via AJAX
app.post("/api/update-listen", (req, res) => {
  const { path, email } = req.body;
  const all  = JSON.parse(fs.readFileSync(musicsFile));
  const idx  = all.findIndex(m => m.path === path);
  if (idx === -1) return res.status(404).json({ status: "error", message: "Musique introuvable." });
  const music = all[idx];
  music.listeners = music.listeners || [];
  if (!music.listeners.includes(email)) {
    music.listenCount++;
    music.listeners.push(email);
    fs.writeFileSync(musicsFile, JSON.stringify(all, null, 2));
  }
  res.json({ status: "success", listenCount: music.listenCount });
});

// 🚀 Lancement du serveur
app.listen(PORT, () => {
  console.log(`🎵 Serveur MoziKa actif sur http://localhost:${PORT}`);
});
