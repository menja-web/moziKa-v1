// ─── CONFIG ENV & PACKAGES ───────────────────────────────
require('dotenv').config();

const express    = require('express');
const path       = require('path');
const mongoose   = require('mongoose');
const fs         = require('fs');
const session    = require('express-session');
const MongoStore = require('connect-mongo');
const multer     = require('multer');
const bcrypt     = require('bcrypt');
const crypto     = require('crypto');
const cors       = require('cors');
const nodemailer = require('nodemailer');

// ─── MODELS ───────────────────────────────────────────────
const User  = require('./models/User');
const Music = require('./models/Music');

// ─── ROUTES ───────────────────────────────────────────────
const adminRoutes       = require('./routes/admin');
const adminStatsRoutes  = require('./routes/adminStats');
const adminMusicsRoutes = require('./routes/adminMusics');

// ─── INITIALISATION APP ──────────────────────────────────
const app = express();

// ─── TRUST PROXY (RENDER) ────────────────────────────────
app.set('trust proxy', 1);

// ─── CORS CONFIG ─────────────────────────────────────────
const isProd       = process.env.NODE_ENV === 'production';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://mozika-gasy.onrender.com';

app.use(cors({
  origin: FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

// ─── SESSION CONFIG ──────────────────────────────────────
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
  cookie: {
    maxAge: 24 * 60 * 60 * 1000,        // 1 jour
    httpOnly: true,
    secure: isProd,                     // true sur Render
    sameSite: isProd ? 'none' : 'lax'   // none en prod, lax en local
  }
}));

// ─── MIDDLEWARE PARSING & STATIC ─────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ─── ROUTES API ──────────────────────────────────────────
app.use('/api', adminRoutes);
app.use('/api/admin', adminStatsRoutes);
app.use('/api/admin', adminMusicsRoutes);

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
  cookie: {
  maxAge: 24 * 60 * 60 * 1000, // 1 jour
  httpOnly: true,
  secure: isProd,             // true en prod (HTTPS), false en local
  sameSite: isProd ? 'none' : 'lax' // 'none' = cross-site prod / 'lax' = local
}
}));
// ─── INJECTION UTILISATEUR DEPUIS LA SESSION ─────────────
app.use(async (req, res, next) => {
  if (req.session && req.session.userId) {
    try {
      const user = await User.findById(req.session.userId);
      if (user) req.user = user;
    } catch (err) {
      console.error("Erreur lors de l'injection de l'utilisateur :", err);
    }
  }
  next();
});
// ─── TEST DE SESSION /WHOAMI ─────────────────────────────
app.get('/whoami', (req, res) => {
  res.json({ user: req.user || null });
});

// ─── AUTH MIDDLEWARE ──────────────────────────────────────
function requireLogin(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(403).json({ status:'error', message:'Non connecté.' });
  }
  next();
}

// ─── MONGODB CONNECTION ───────────────────────────────────
mongoose.set('bufferCommands', false);
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connecté'))
  .catch(err => console.error('❌ Erreur MongoDB :', err));

// ─── UPLOAD DIRECTORIES ───────────────────────────────────
const uploadDir = path.join(__dirname, 'public', 'uploads');
const facesDir  = path.join(__dirname, 'public', 'faces');
[uploadDir, facesDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});
app.use('/uploads', express.static(uploadDir));
app.use('/faces',   express.static(facesDir));

// ─── CLOUDINARY STORAGE ───────────────────────────────────
const cloudinary = require('./config/cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'mozikafiles',
    resource_type: 'auto',
    allowed_formats: ['jpg','png','jpeg','mp3','wav']
  }
});
const upload = multer({ storage });


// ─── AUTHENTIFICATION ROUTES ──────────────────────────────

// 1) Envoi du code de vérification
app.post('/api/send-code', async (req, res) => {
  const { email, username, password } = req.body;
  if (!email || !username || !password) {
    return res.status(400).json({ status:'error', message:'Champs requis manquants.' });
  }
  if (await User.findOne({ email: email.toLowerCase() })) {
    return res.status(409).json({ status:'error', message:'Email déjà utilisé.' });
  }
  const code = String(Math.floor(100000 + Math.random()*900000));
  try {
    await nodemailer.createTransport({
      service:'gmail',
      auth:{ user:process.env.EMAIL_USER, pass:process.env.EMAIL_PASS }
    }).sendMail({
      from:    `MoziKa <${process.env.EMAIL_USER}>`,
      to:      email,
      subject: '🔐 Ton code MoziKa',
      text:    `Bonjour ${username},\n\nTon code : ${code}`
    });
    req.session.verificationCode = code;
    req.session.pendingUser       = { email, username, password };
    res.json({ status:'success', message:'Code envoyé !' });
  } catch (err) {
    console.error('send-code error:', err);
    res.status(500).json({ status:'error', message:'Échec envoi mail.' });
  }
});

// 2) Validation de l’inscription
app.post('/api/register', async (req, res) => {
  const { code } = req.body;
  const pending  = req.session.pendingUser;
  if (!pending || code !== req.session.verificationCode) {
    return res.status(400).json({ status:'error', message:'Code invalide.' });
  }
  if (await User.findOne({ email: pending.email.toLowerCase() })) {
    return res.status(409).json({ status:'error', message:'Email déjà utilisé.' });
  }
  const hash = await bcrypt.hash(pending.password, 10);
  const u = await User.create({
    username: pending.username,
    email:    pending.email.toLowerCase(),
    password: hash,
    joinedAt: new Date()
  });

  // Stockage de la session
  req.session.user   = {
    id:       u._id.toString(),
    username: u.username,
    email:    u.email
  };
  req.session.userId = u._id.toString();  // ← champ essentiel pour les routes
  delete req.session.pendingUser;
  delete req.session.verificationCode;

  res.json({ status:'success', message:'Inscription réussie !' });
});

// 3) Login
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const u = await User.findOne({ email: email.toLowerCase() });
  if (!u || !(await bcrypt.compare(password, u.password))) {
    return res.status(401).json({ status:'error', message:'Identifiants invalides.' });
  }

  // Stockage de la session
  req.session.user   = {
    id:       u._id.toString(),
    username: u.username,
    email:    u.email
  };
  req.session.userId = u._id.toString();  // ← champ essentiel

  res.json({ status:'success', username: u.username, email: u.email });
});

// 4) Logout
app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ status:'success', message:'Déconnecté.' });
  });
});

// 5) Session & infos utilisateur
app.get('/api/get-session', (req, res) => {
  if (!req.session.userId) {
  return res.status(401).json({ status:'error', message:'Non connecté.' });
}

  res.json({ status:'success', user: req.session.user });
});
app.get('/api/user-info', requireLogin, (req, res) => {
  res.json({
    status:   'success',
    username: req.session.user.username,
    email:    req.session.user.email
  });
});


// ─── MUSIQUES ROUTES ──────────────────────────────────────

// GET toutes les musiques
app.get('/api/musics', async (_req, res) => {
  const docs = await Music.find()
    .populate('uploader', 'username email')
    .lean();
  const musics = docs.map(m => ({
    _id:          m._id,
    title:        m.title,
    category:     m.category,
    uploader:     m.uploader?.username || 'Anonyme',
    listenCount:  m.listenCount  ?? 0,
    downloadCount:m.downloadCount?? 0,
    uploadedAt:   m.uploadedAt,
    path:         m.externalUrl      || m.path,
    cover:        m.externalCoverUrl || m.cover
  }));
  res.json({ status:'success', musics });
});

// GET musiques uploadées par l'utilisateur connecté
app.get('/api/musics-by-user', requireLogin, async (req, res) => {
  try {
    const userId = req.session.userId;
    const docs = await Music.find({ uploader: userId })
      .populate('uploader', 'username')
      .lean();
    const musics = docs.map(m => ({
      _id:      m._id,
      title:    m.title,
      uploader: m.uploader?.username || 'Anonyme',
      path:     m.externalUrl || m.path,
      cover:    m.externalCoverUrl || m.cover
    }));
    res.json({ status:'success', musics });
  } catch (err) {
    console.error('Error /api/musics-by-user:', err);
    res.status(500).json({ status:'error', message:'Erreur serveur.' });
  }
});

// UPLOAD MUSIQUE + COVER (via Cloudinary)
app.post(
  '/api/upload',
  upload.fields([
    { name: 'musicFile', maxCount: 1 },
    { name: 'coverFile', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const musicFile = req.files?.musicFile?.[0];
      const coverFile = req.files?.coverFile?.[0];
      if (!musicFile || !coverFile) {
        return res.status(400).json({
          status:'error',
          message:'Fichier audio et image requis.'
        });
      }

      const { title, category } = req.body;
      if (!title || !category) {
        return res.status(400).json({
          status:'error',
          message:'Titre et catégorie obligatoires.'
        });
      }

      const userId = req.session.userId;
      if (!userId) {
        return res.status(403).json({
          status:'error',
          message:'Utilisateur non connecté.'
        });
      }

      const music = await Music.create({
        title,
        category,
        uploader:     userId,
        path:         musicFile.path,
        cover:        coverFile.path,
        listenCount:  0,
        downloadCount:0,
        uploadedAt:   new Date()
      });

      res.json({ status:'success', music });
    } catch (err) {
      console.error('❌ Upload error:', err);
      res.status(500).json({
        status:'error',
        message:`Échec upload : ${err.message}`
      });
    }
  }
);

// DELETE une musique
app.post('/api/music/delete', requireLogin, async (req, res) => {
  const { id } = req.body;

  try {
    const music = await Music.findById(id);
    if (!music || music.uploader.toString() !== req.session.userId) {
      return res.status(404).json({
        status: 'error',
        message: 'Non autorisé ou introuvable.'
      });
    }

    // Supprimer les fichiers associés (si stockés dans /uploads)
    if (music.path?.startsWith('/uploads')) {
      fs.unlinkSync(path.join(__dirname, 'public', music.path));
    }
    if (music.cover?.startsWith('/uploads')) {
      fs.unlinkSync(path.join(__dirname, 'public', music.cover));
    }

    await Music.findByIdAndDelete(id);
    res.json({ status: 'success', message: 'Musique supprimée.' });

  } catch (err) {
    console.error('Erreur suppression musique :', err);
    res.status(500).json({
      status: 'error',
      message: 'Erreur serveur pendant la suppression.'
    });
  }
});


// ADD musique par URL externe
app.post('/api/add-music-url', requireLogin, async (req, res) => {
  const { title, category, url, coverUrl } = req.body;
  if (!title || !category || !url || !coverUrl) {
    return res.status(400).json({
      status:'error',
      message:'Champs manquants.'
    });
  }
  const music = await Music.create({
    title,
    category,
    uploader:         req.session.userId,
    externalUrl:      url,
    externalCoverUrl: coverUrl,
    listenCount:      0,
    downloadCount:    0,
    uploadedAt:       new Date()
  });
  res.json({ status:'success', music });
});


// ─── FAVORIS ROUTES ────────────────────────────────────────

// Ajout d'un favori
app.post('/api/add-favorite', requireLogin, async (req, res) => {
  const musicId = req.body.id;
  console.log('👉 userId session =', req.session.userId);

  if (!musicId) {
    return res.status(400).json({
      status: 'error',
      message: 'ID de la musique manquant.'
    });
  }

  try {
    const user = await User.findById(req.session.userId);
    if (!user.favorites.includes(musicId)) {
      user.favorites.push(musicId);
      await user.save();
    }
    res.json({ status: 'success' });
  } catch (err) {
    console.error('Erreur ajout favoris :', err);
    res.status(500).json({
      status: 'error',
      message:'Erreur serveur',
      error: err.message
    });
  }
});

// Suppression d'un favori
app.post('/api/remove-favorite', requireLogin, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.session.userId, {
      $pull: { favorites: req.body.id }
    });
    res.json({ status:'success' });
  } catch (err) {
    res.json({
      status:'error',
      message:'Erreur suppression favoris',
      error: err.message
    });
  }
});

// Récupération des favoris
app.get('/api/favorites', requireLogin, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId)
      .populate({ path:'favorites', populate:{ path:'uploader', select:'username' } })
      .lean();

    const favs = (user.favorites || []).map(m => ({
      _id:           m._id,
      title:         m.title,
      category:      m.category || 'Non défini',
      path:          m.externalUrl      || m.path,
      cover:         m.externalCoverUrl || m.cover,
      uploader:      m.uploader?.username|| 'Anonyme',
      listenCount:   m.listenCount      ?? 0,
      downloadCount: m.downloadCount    ?? 0
    }));

    res.json({ status:'success', favorites: favs });
  } catch (err) {
    res.json({
      status:'error',
      message:'Erreur serveur',
      error: err.message
    });
  }
});


// ─── STATS UNIQUES ─────────────────────────────────────────

// Incrémentation des écoutes uniques
app.post('/api/listen', requireLogin, async (req, res) => {
  const { id } = req.body;
  const m = await Music.findOneAndUpdate(
    { _id: id, listenerList: { $ne: req.session.user.email } },
    { $addToSet:{ listenerList: req.session.user.email }, $inc:{ listenCount: 1 } },
    { new: true }
  );
  if (m) return res.json({ status:'success', count: m.listenCount });

  const existing = await Music.findById(id);
  return existing
    ? res.json({ status:'success', count: existing.listenCount })
    : res.status(404).json({ status:'error', message:'Musique introuvable.' });
});

// Incrémentation des téléchargements uniques
app.post('/api/download', requireLogin, async (req, res) => {
  const { id } = req.body;
  const m = await Music.findOneAndUpdate(
    { _id: id, downloaderList: { $ne: req.session.user.email } },
    { $addToSet:{ downloaderList: req.session.user.email }, $inc:{ downloadCount: 1 } },
    { new: true }
  );
  if (m) return res.json({ status:'success', count: m.downloadCount });

  const existing = await Music.findById(id);
  return existing
    ? res.json({ status:'success', count: existing.downloadCount })
    : res.status(404).json({ status:'error', message:'Musique introuvable.' });
});


// ─── TOP 5 MUSIQUES ────────────────────────────────────────
app.get('/api/top', async (_req, res) => {
  const docs = await Music.find().sort({ listenCount:-1 }).limit(5)
    .populate('uploader','username').lean();

const top = docs.map(m => ({
  _id:          m._id,
  title:        m.title,
  path:         m.externalUrl || m.path,
  cover:         m.externalCoverUrl || m.cover,  // ✅ IMAGE FIX // ✅ ce champ doit exister
  listenCount:  m.listenCount,
  uploader:     m.uploader?.username || 'Anonyme',
  downloadCount: m.downloadCount ?? 0  // ✅ CORRECT ici
}));


  res.json({ status:'success', top });
});



// ─── PASSWORD RESET ────────────────────────────────────────
const resetFile = path.join(__dirname, 'resetTokens.json');
if (!fs.existsSync(resetFile)) fs.writeFileSync(resetFile, '[]');

// Demande de réinitialisation
app.post('/api/reset-request', async (req, res) => {
  const { email } = req.body;
  const u = await User.findOne({ email: email.toLowerCase() });
  if (!u) return res.json({ status:'error', message:'Adresse inconnue.' });

  const token     = crypto.randomBytes(24).toString('hex');
  const expiresAt = Date.now() + 15*60*1000;
  const tokens    = JSON.parse(fs.readFileSync(resetFile));
  tokens.push({ email: u.email, token, expiresAt });
  fs.writeFileSync(resetFile, JSON.stringify(tokens, null, 2));

  const base = isProd
    ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME}`
    : `http://localhost:${PORT}`;
  const link = `${base}/new-password.html?token=${token}`;

  try {
    await nodemailer.createTransport({
      service:'gmail',
      auth:{ user:process.env.EMAIL_USER, pass:process.env.EMAIL_PASS }
    }).sendMail({
      from:    `MoziKa <${process.env.EMAIL_USER}>`,
      to:      u.email,
      subject: '🔐 Réinitialisation MoziKa',
      text:    `Bonjour ${u.username},\n\nClique ici : ${link}`
    });
    res.json({ status:'success', message:'Lien envoyé !' });
  } catch(err) {
    console.error('reset-request error:', err);
    res.status(500).json({ status:'error', message:'Échec mail.' });
  }
});

// Application du nouveau mot de passe
app.post('/api/password/update', requireLogin, async (req, res) => {
  const { oldPass, newPass } = req.body;
  const user = await User.findById(req.session.userId);

  const match = await bcrypt.compare(oldPass, user.password);
  if (!match) {
    return res.json({ status: 'error', message: 'Ancien mot de passe incorrect.' });
  }

  const hashed = await bcrypt.hash(newPass, 10);
  user.password = hashed;
  await user.save();

  res.json({ status: 'success', message: 'Mot de passe mis à jour.' });
});



// ─── PROFILE PHOTOS & CREATORS ────────────────────────────
const creatorsFile = path.join(__dirname, 'data', 'createurs.json');
if (!fs.existsSync(path.dirname(creatorsFile))) {
  fs.mkdirSync(path.dirname(creatorsFile), { recursive: true });
}
if (!fs.existsSync(creatorsFile)) {
  fs.writeFileSync(creatorsFile, '[]');
}

const photoUpload = multer({ dest: facesDir });

// Upload / mise à jour de la photo de profil
app.post('/api/update-photo', photoUpload.single('photo'), (req, res) => {
  const { username } = req.body;
  if (!username || !req.file) {
    return res.status(400).json({ success:false, message:'Champs manquants.' });
  }
  const ext     = path.extname(req.file.originalname);
  const newName = req.file.filename + ext;
  const dest    = path.join(facesDir, newName);
  fs.renameSync(req.file.path, dest);

  const creators = JSON.parse(fs.readFileSync(creatorsFile));
  const idx      = creators.findIndex(c => c.username === username);
  if (idx !== -1) creators[idx].photo = `/faces/${newName}`;
  else creators.push({ username, photo:`/faces/${newName}`, streams:0, royalties:0 });
  fs.writeFileSync(creatorsFile, JSON.stringify(creators, null, 2));

  res.json({ success:true, photo:`/faces/${newName}` });
});

// Lister les créateurs (pour stats ou affichage)
app.get('/api/creators', (_req, res) => {
  const data = JSON.parse(fs.readFileSync(creatorsFile));
  res.json({ status:'success', creators: data });
});

// partage link
app.get("/share/:id", async (req, res) => {
  const music = await Music.findById(req.params.id);
  if (!music) return res.status(404).send("Not found");

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta property="og:title" content="🎧 ${music.title} sur MoziKa" />
      <meta property="og:description" content="Catégorie : ${music.category}" />
      <meta property="og:image" content="${music.cover}" />
      <meta property="og:url" content="https://mozika-gasy.onrender.com/share/${music._id}" />
      <meta property="og:type" content="music.song" />
    </head>
    <body>Redirection vers MoziKa…</body>
    <script>window.location.href = "/accueil.html";</script>
    </html>
  `);
});

app.get("/music/:id", async (req, res) => {
  const music = await Music.findById(req.params.id);
  if (!music || !music.cover || !music.path) {
    return res.status(404).send("Musique introuvable ou incomplète");
  }

  res.send(`
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8" />
      <title>${music.title} - MoziKa</title>

      <!-- Balises Open Graph pour le partage réseau -->
      <meta property="og:title" content="🎶 ${music.title} - MoziKa" />
      <meta property="og:description" content="Catégorie : ${music.category}" />
      <meta property="og:image" content="${music.cover}" />
      <meta property="og:url" content="https://mozika-gasy.onrender.com/music/${music._id}" />
      <meta property="og:type" content="music.song" />

      <style>
        body {
          font-family: sans-serif;
          text-align: center;
          padding: 40px;
          background: #f0f2f5;
          color: #333;
        }
        h1 { margin-bottom: 10px; }
        audio { margin: 20px auto; display: block; }
        img {
          width: 240px;
          border-radius: 10px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        }
        .meta {
          margin-top: 10px;
          font-size: 0.95rem;
          color: #666;
        }
      </style>
    </head>
    <body>
      <h1>${music.title}</h1>
      <img src="${music.cover}" alt="Couverture" />
      <audio controls src="${music.path}"></audio>
      <div class="meta">
        Catégorie : ${music.category} <br>
        Écoute : ${music.listenCount || 0} fois <br>
        Téléchargement : ${music.downloadCount || 0} fois
      </div>
    </body>
    </html>
  `);
});


// ─── EXPORT & PING & HOME ─────────────────────────────────
app.get("/download/:id", async (req, res) => {
  const music = await Music.findById(req.params.id);
  if (!music) return res.status(404).send("Fichier introuvable");

  // 🔢 Incrémente le compteur dans MongoDB
  music.downloadCount = (music.downloadCount || 0) + 1;
  await music.save();

  // 🔁 Redirection vers le fichier
  res.redirect(music.path);
});

// Exporter toute la data (users, musics, tokens, creators)
app.get('/api/export-data', async (_req, res) => {
  const users    = await User.find().select('-password').lean();
  const musics   = await Music.find().populate('uploader','username email').lean();
  const tokens   = JSON.parse(fs.readFileSync(resetFile));
  const creators = JSON.parse(fs.readFileSync(creatorsFile));
  res.json({ status:'success', users, musics, tokens, creators });
});

// Ping simple
app.get('/api/ping', (_req, res) => res.json({ pong:true }));

// Page d'accueil statique
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── DÉMARRAGE DU SERVEUR ─────────────────────────────────
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Serveur MoziKa lancé sur le port ${PORT}`);
});

