require('dotenv').config(); // Charge les variables d'environnement
const mongoose = require('mongoose'); // Librairie MongoDB

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connexion à MongoDB Atlas réussie'))
  .catch((err) => console.error('❌ Erreur MongoDB :', err));
// 📦 Modules nécessaires
const express = require('express');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const multer = require('multer');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

// 🚀 Express App
const app = express();
const PORT = 3000;

// 📁 Fichiers & dossiers
const uploadDir = path.join(__dirname, 'uploads');
const usersFile = path.join(__dirname, 'users.json');
const musicsFile = path.join(__dirname, 'musics.json');
const resetFile = path.join(__dirname, 'resetTokens.json');
const favoritesFile = path.join(__dirname, 'favorites.json');

// 🧩 Création des fichiers si manquants
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
if (!fs.existsSync(usersFile)) fs.writeFileSync(usersFile, JSON.stringify([]));
if (!fs.existsSync(musicsFile)) fs.writeFileSync(musicsFile, JSON.stringify([]));
if (!fs.existsSync(resetFile)) fs.writeFileSync(resetFile, JSON.stringify([]));

// 🎵 Lecture des musiques
let musics = JSON.parse(fs.readFileSync(musicsFile));

// 🧱 Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'moziKaSecretKey',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 3600000, sameSite: 'lax' }
}));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadDir));
app.use("/data", express.static(path.join(__dirname, "data")));

// 📤 Configuration upload musiques & couvertures
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const unique = Date.now() + '-' + Math.floor(Math.random() * 10000);
    const prefix = file.fieldname === 'musicFile' ? 'music-' : 'cover-';
    cb(null, prefix + unique + ext);
  }
});
const upload = multer({ storage });

// 🔐 Middleware : connexion requise
function requireLogin(req, res, next) {
  if (!req.session.user) return res.status(403).send("Connecte-toi pour uploader.");
  next();
}

// 🔐 Connexion sécurisée
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  try {
    const users = JSON.parse(fs.readFileSync(usersFile));
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());

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

// 📩 Envoi du code par e-mail
app.post('/api/send-code', async (req, res) => {
  const { email, username, password } = req.body;
  const code = Math.floor(100000 + Math.random() * 900000).toString();

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'menjaniainarandriamaharitra1@gmail.com',
      pass: 'mexu pndj laak vivo'
    }
  });

  const mailOptions = {
    from: 'MoziKa <menjaniainarandriamaharitra@gmail.com>',
    to: email,
    subject: '🔐 Ton code de vérification MoziKa',
    text: `Bonjour ${username},\n\nMerci d’avoir rejoint MoziKa 🎵\nVoici ton code : ${code}\n\nÀ bientôt sur MoziKa 💫`
  };

  try {
    await transporter.sendMail(mailOptions);
    req.session.verificationCode = code;
    req.session.pendingUser = { email, username, password };
    res.json({ status: "success", message: "✅ Code envoyé !" });
  } catch (err) {
    console.error("Erreur envoi email :", err);
    res.status(500).json({ status: "error", message: "Erreur d’envoi du mail." });
  }
});

// 🧾 Validation du code + création de compte
app.post('/api/register', (req, res) => {
  const { code } = req.body;
  const savedUser = req.session.pendingUser;
  const validCode = req.session.verificationCode;

  if (!savedUser || !code || code !== validCode) {
    return res.status(400).json({ status: "error", message: "Code invalide ou expiré." });
  }

  try {
    const users = JSON.parse(fs.readFileSync(usersFile));
    const exists = users.find(u => u.email.toLowerCase() === savedUser.email.toLowerCase());
    if (exists) {
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
// 🔐 Connexion sécurisée
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  try {
    const users = JSON.parse(fs.readFileSync(usersFile));
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());

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

// 📩 Envoi du code par e-mail
app.post('/api/send-code', async (req, res) => {
  const { email, username, password } = req.body;
  const code = Math.floor(100000 + Math.random() * 900000).toString();

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'menjaniainarandriamaharitra1@gmail.com',
      pass: 'mexu pndj laak vivo'
    }
  });

  const mailOptions = {
    from: 'MoziKa <menjaniainarandriamaharitra@gmail.com>',
    to: email,
    subject: '🔐 Ton code de vérification MoziKa',
    text: `Bonjour ${username},\n\nMerci d’avoir rejoint MoziKa 🎵\nVoici ton code : ${code}\n\nÀ bientôt sur MoziKa 💫`
  };

  try {
    await transporter.sendMail(mailOptions);
    req.session.verificationCode = code;
    req.session.pendingUser = { email, username, password };
    res.json({ status: "success", message: "✅ Code envoyé !" });
  } catch (err) {
    console.error("Erreur envoi email :", err);
    res.status(500).json({ status: "error", message: "Erreur d’envoi du mail." });
  }
});

// 🧾 Validation du code + création de compte
app.post('/api/register', (req, res) => {
  const { code } = req.body;
  const savedUser = req.session.pendingUser;
  const validCode = req.session.verificationCode;

  if (!savedUser || !code || code !== validCode) {
    return res.status(400).json({ status: "error", message: "Code invalide ou expiré." });
  }

  try {
    const users = JSON.parse(fs.readFileSync(usersFile));
    const exists = users.find(u => u.email.toLowerCase() === savedUser.email.toLowerCase());
    if (exists) {
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
// 🎧 Upload musique
app.post('/api/upload', requireLogin, upload.fields([
  { name: 'musicFile', maxCount: 1 },
  { name: 'coverFile', maxCount: 1 }
]), (req, res) => {
  const user = req.session.user;
  const { title, category } = req.body;
  const musicFile = req.files['musicFile']?.[0];
  const coverFile = req.files['coverFile']?.[0];

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

// 📈 Écoute d'une musique
app.post('/api/listen', (req, res) => {
  const { path } = req.body;
  const user = req.session.user;
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

// 📥 Télécharger musique
app.post('/api/download', (req, res) => {
  const { path } = req.body;
  const music = musics.find(m => m.path === path);
  if (!music) return res.status(404).json({ status: "error" });

  music.downloadCount++;
  fs.writeFileSync(musicsFile, JSON.stringify(musics, null, 2));
  res.json({ status: "success", count: music.downloadCount });
});

// 🗑 Supprimer musique
app.post('/api/delete', (req, res) => {
  const { path: musicPath } = req.body;
  const user = req.session.user;
  if (!user || !musicPath) return res.status(400).json({ status: "error" });

  const index = musics.findIndex(m => m.path === musicPath && m.uploader_email === user.email);
  if (index === -1) return res.status(403).json({ status: "error" });

  const music = musics[index];
  try {
    const filePath = path.join(uploadDir, music.path.replace("/uploads/", ""));
    const coverPath = path.join(uploadDir, music.cover.replace("/uploads/", ""));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    if (fs.existsSync(coverPath)) fs.unlinkSync(coverPath);
    musics.splice(index, 1);
    fs.writeFileSync(musicsFile, JSON.stringify(musics, null, 2));
    res.json({ status: "success" });
  } catch (err) {
    console.error("Erreur suppression :", err);
    res.status(500).json({ status: "error" });
  }
});

// 🔁 Réinitialisation du mot de passe
app.post("/api/reset-request", async (req, res) => {
  const { email } = req.body;
  const users = JSON.parse(fs.readFileSync(usersFile));
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());

  if (!user) return res.json({ status: "error", message: "Adresse inconnue" });

  const token = crypto.randomBytes(24).toString("hex");
  const expiresAt = Date.now() + 15 * 60 * 1000;
  const resetTokens = JSON.parse(fs.readFileSync(resetFile));
  resetTokens.push({ email: user.email, token, expiresAt });
  fs.writeFileSync(resetFile, JSON.stringify(resetTokens, null, 2));

  const resetLink = `http://localhost:${PORT}/new-password.html?token=${token}`;
  const mailOptions = {
    from: 'MoziKa <menjaniainarandriamaharitra@gmail.com>',
    to: user.email,
    subject: '🔐 Réinitialisation du mot de passe MoziKa',
    text: `Bonjour ${user.username},\n\nVoici ton lien : ${resetLink}\nValable 15 minutes.\n\nMoziKa 💙`
  };

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'menjaniainarandriamaharitra1@gmail.com',
        pass: 'mexu pndj laak vivo'
      }
    });

    await transporter.sendMail(mailOptions);
    res.json({ status: "success", message: "Lien envoyé !" });
  } catch (err) {
    console.error("Erreur reset-request :", err);
    res.status(500).json({ status: "error", message: "Erreur d’envoi du mail." });
  }
});

// 🔐 Modifier mot de passe avec le lien
app.post("/api/reset-password", (req, res) => {
  const { token, newPassword } = req.body;
  const resetTokens = JSON.parse(fs.readFileSync(resetFile));
  const users = JSON.parse(fs.readFileSync(usersFile));

  const entry = resetTokens.find(r => r.token === token);
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

// 🔐 Changer mot de passe connecté
app.post("/api/change-password", (req, res) => {
  const userSession = req.session.user;
  const { oldPassword, newPassword } = req.body;
  if (!userSession) return res.status(401).json({ status: "error", message: "Non connecté." });

  const users = JSON.parse(fs.readFileSync(usersFile));
  const user = users.find(u => u.email === userSession.email);
  if (!user) return res.status(404).json({ status: "error", message: "Utilisateur introuvable." });

  if (!bcrypt.compareSync(oldPassword, user.password)) {
    return res.status(403).json({ status: "error", message: "Ancien mot de passe incorrect." });
  }

  user.password = bcrypt.hashSync(newPassword, 10);
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));

  res.json({ status: "success", message: "Mot de passe mis à jour ✅" });
});
// ❤️ Ajouter favori
app.post("/api/add-favorite", (req, res) => {
  const musicPath = req.body.path;
  const sessionUser = req.session.user;
  if (!sessionUser || !musicPath) return res.status(400).json({ status: "error" });

  const users = JSON.parse(fs.readFileSync(usersFile));
  const user = users.find(u => u.email === sessionUser.email);
  if (!user) return res.status(404).json({ status: "error" });

  user.favorites = user.favorites || [];
  if (!user.favorites.includes(musicPath)) user.favorites.push(musicPath);

  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
  res.json({ status: "success" });
});

// ❤️ Récupérer les favoris
app.get("/api/favorites", (req, res) => {
  const sessionUser = req.session.user;
  if (!sessionUser) return res.status(401).json({ status: "error" });

  const users = JSON.parse(fs.readFileSync(usersFile));
  const user = users.find(u => u.email === sessionUser.email);
  if (!user) return res.status(404).json({ status: "error" });

  const favorites = user.favorites || [];
  const favMusics = musics.filter(m => favorites.includes(m.path));
  res.json({ status: "success", favorites: favMusics });
});

// 📊 Top musiques
app.get("/api/top", (req, res) => {
  const top = musics
    .filter(m => typeof m.listenCount === "number")
    .sort((a, b) => b.listenCount - a.listenCount)
    .slice(0, 5);
  res.json({ top });
});

// 📧 Récupérer l’email en session
app.get("/api/user-email", (req, res) => {
  const sessionUser = req.session?.user;
  res.json({ email: sessionUser?.email || "" });
});

// 👤 Vérifier session active
app.get("/api/get-session", (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ status: "error", message: "Non connecté." });
  }
  res.json({ status: "success", user: req.session.user });
});

// 🛠 Route pour afficher toutes les musiques (accueil)
app.get('/api/musics', (req, res) => {
  const musics = JSON.parse(fs.readFileSync(musicsFile));
  res.json({ musics });
});

// 🔗 Route des créateurs
const createurListRoute = require("./routes/get-createurs");
app.use(createurListRoute);

// ✅ ✅ ✅ 🖼️ Route ajoutée ici — mise à jour de la photo de profil
const photoUpload = multer({ dest: path.join(__dirname, 'public/faces/') });

app.post("/api/update-photo", photoUpload.single("photo"), (req, res) => {
  const { username } = req.body;
  const file = req.file;

  if (!username || !file) return res.json({ success: false });

  try {
    const ext = path.extname(file.originalname);
    const newFilename = file.filename.replace(ext, "") + ext;
    const photoPath = "./faces/" + newFilename;
    const fullPath = path.join(__dirname, "public", "faces", newFilename);

    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.renameSync(file.path, fullPath);

    const createursPath = path.join(__dirname, "data", "createurs.json");
    if (!fs.existsSync(createursPath)) fs.writeFileSync(createursPath, JSON.stringify([]));

    const createurs = JSON.parse(fs.readFileSync(createursPath));
    const index = createurs.findIndex(c => c.username === username);

    if (index !== -1) {
      createurs[index].photo = photoPath;
      fs.writeFileSync(createursPath, JSON.stringify(createurs, null, 2));
      return res.json({ success: true, newPath: photoPath });
    }

    return res.json({ success: false });
  } catch (err) {
    console.error("❌ Erreur update-photo :", err);
    return res.json({ success: false });
  }
});

// 🚀 Lancement du serveur
app.listen(PORT, () => {
  console.log(`🎵 Serveur MoziKa actif sur http://localhost:${PORT}`);
});

// 📥 Musiques par utilisateur
app.get('/api/musics-by-user', (req, res) => {
  const sessionUser = req.session?.user;
  if (!sessionUser || !sessionUser.email) {
    return res.status(401).json({ status: "error", message: "Utilisateur non connecté." });
  }

  const musics = JSON.parse(fs.readFileSync(musicsFile));
  const uploads = musics.filter(m => m.uploader_email === sessionUser.email);
  res.json({ status: "success", musics: uploads });
});

// ❤️ Supprimer des favoris (double implémentation, conservée intacte)
app.post("/api/remove-favorite", (req, res) => {
  const { path } = req.body;
  const sessionUser = req.session?.user;

  if (!sessionUser || !sessionUser.email) {
    return res.status(401).json({ status: "error" });
  }

  try {
    const users = JSON.parse(fs.readFileSync(usersFile));
    const userIndex = users.findIndex(u => u.email === sessionUser.email);
    if (userIndex === -1) return res.status(404).json({ status: "error" });

    const favs = users[userIndex].favorites || [];
    users[userIndex].favorites = favs.filter(p => p !== path);

    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
    res.json({ status: "success" });
  } catch (err) {
    console.error("Erreur retrait favori serveur :", err);
    res.status(500).json({ status: "error" });
  }
});

app.post("/api/delete", (req, res) => {
  const { path } = req.body;
  const sessionUser = req.session?.user;

  if (!sessionUser || !sessionUser.email) {
    return res.status(401).json({ status: "error", message: "Utilisateur non connecté." });
  }

  try {
    const musics = JSON.parse(fs.readFileSync(musicsFile));
    const updated = musics.filter(m => !(m.path === path && m.uploader_email === sessionUser.email));

    fs.writeFileSync(musicsFile, JSON.stringify(updated, null, 2));
    res.json({ status: "success" });
  } catch (err) {
    console.error("Erreur suppression serveur :", err);
    res.status(500).json({ status: "error", message: "Erreur interne serveur." });
  }
});

app.post("/api/remove-favorite", (req, res) => {
  const { path } = req.body;
  const sessionUser = req.session?.user;

  if (!sessionUser || !sessionUser.email) {
    return res.status(401).json({ status: "error", message: "Utilisateur non connecté." });
  }

  try {
    const favorites = JSON.parse(fs.readFileSync(favoritesFile));
    const updated = favorites.filter(fav => !(fav.path === path && fav.email === sessionUser.email));

    fs.writeFileSync(favoritesFile, JSON.stringify(updated, null, 2));
    res.json({ status: "success" });
  } catch (err) {
    console.error("Erreur retrait favori serveur :", err);
    res.status(500).json({ status: "error", message: "Erreur interne serveur." });
  }
});

app.post("/api/update-listen", (req, res) => {
  const { path, email } = req.body;
  const musics = JSON.parse(fs.readFileSync(musicsFile));
  const index = musics.findIndex(m => m.path === path);
  if (index === -1) return res.status(404).json({ status: "error", message: "Musique introuvable." });

  const music = musics[index];
  if (!music.listeners) music.listeners = [];

  if (!music.listeners.includes(email)) {
    music.listenCount++;
    music.listeners.push(email);
    fs.writeFileSync(musicsFile, JSON.stringify(musics, null, 2));
  }

  res.json({ status: "success", listenCount: music.listenCount });
});
require("dotenv").config();


// Connexion à MongoDB Atlas
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Connexion à MongoDB réussie"))
  .catch(err => console.error("❌ Échec de connexion à MongoDB", err));
