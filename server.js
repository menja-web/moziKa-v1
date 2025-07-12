// server.js
require('dotenv').config();
const express    = require('express');
const mongoose   = require('mongoose');
const path       = require('path');
const fs         = require('fs');
const session    = require('express-session');
const MongoStore = require('connect-mongo');
const multer     = require('multer');
const bcrypt     = require('bcrypt');
const crypto     = require('crypto');
const cors       = require('cors');
const nodemailer = require('nodemailer');

const User  = require('./models/User');
const Music = require('./models/Music');

const app    = express();
const PORT   = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

app.use(cors({
  origin: "https://mozika-gasy.onrender.com",
  credentials: true
}));


// ─── CORS & SESSION ──────────────────────────────────────
app.set('trust proxy', 1);
app.use(cors({
  origin:        process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials:   true,
  methods:       ['GET','POST','OPTIONS'],
  allowedHeaders:['Content-Type']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret:            process.env.SESSION_SECRET,
  resave:            false,
  saveUninitialized: false,
  store:             MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
  cookie: {
    maxAge:   24 * 60 * 60 * 1000,
    httpOnly: true,
    secure:   false,
    sameSite: 'Lax'
  }
}));

function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.status(403).json({ status:'error', message:'Non connecté.' });
  }
  next();
}
app.use("/api", require("./routes/user.route.js"));

// ─── MONGODB CONNECTION ───────────────────────────────────
mongoose.set('bufferCommands', false);
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connecté'))
  .catch(err => console.error('❌ Erreur MongoDB :', err));

// ─── STATICS & UPLOAD DIRS ────────────────────────────────
app.use(express.static(path.join(__dirname,'public')));
const uploadDir = path.join(__dirname,'public','uploads');
const facesDir  = path.join(__dirname,'public','faces');
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

// ─── AUTHENTIFICATION ─────────────────────────────────────

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
  req.session.user = { id:u._id.toString(), username:u.username, email:u.email };
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
  req.session.user = { id:u._id.toString(), username:u.username, email:u.email };
  res.json({ status:'success', username:u.username, email:u.email });
});

// 4) Logout
app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ status:'success', message:'Déconnecté.' });
  });
});

// 5) Session & infos
app.get('/api/get-session', (req, res) => {
  if (!req.session.user) {
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

// ─── MUSIQUES ──────────────────────────────────────────────

// GET toutes les musiques
app.get('/api/musics', async (_req, res) => {
  const docs = await Music.find()
    .populate('uploader','username email')
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

// GET musiques par user
app.get('/api/musics-by-user', requireLogin, async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.session.user.id);
    const docs = await Music.find({ uploader: userId })
      .populate('uploader','username')
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

// UPLOAD MUSIQUE + COVER (Cloudinary)
app.post(
  '/api/upload',
  upload.fields([
    { name: 'musicFile', maxCount: 1 },
    { name: 'coverFile', maxCount: 1 }
  ]),
  async (req, res) => {
    console.log('📦 Upload body:',  req.body);
    console.log('📂 Upload files:', req.files);

    try {
      const musicFile = req.files?.musicFile?.[0];
      const coverFile = req.files?.coverFile?.[0];
      if (!musicFile || !coverFile) {
        return res.status(400).json({
          status: 'error',
          message:'Fichier audio et image requis.'
        });
      }

      const { title, category } = req.body;
      if (!title || !category) {
        return res.status(400).json({
          status: 'error',
          message:'Titre et catégorie obligatoires.'
        });
      }

      const userId = req.session?.user?.id;
      if (!userId) {
        return res.status(403).json({
          status: 'error',
          message:'Utilisateur non connecté.'
        });
      }

      const music = await Music.create({
        title,
        category,
        uploader:      userId,
        path:           musicFile.path,
        cover:          coverFile.path,
        listenCount:    0,
        downloadCount:  0,
        uploadedAt:     new Date()
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

// DELETE musique
app.post('/api/delete', requireLogin, async (req, res) => {
  const { id } = req.body;
  const m = await Music.findById(id);
  if (!m || m.uploader.toString() !== req.session.user.id) {
    return res.status(404).json({
      status:'error', message:'Non autorisé ou introuvable.'
    });
  }
  if (m.path.startsWith('/uploads'))
    fs.unlinkSync(path.join(__dirname,'public', m.path));
  if (m.cover.startsWith('/uploads'))
    fs.unlinkSync(path.join(__dirname,'public', m.cover));
  await Music.findByIdAndDelete(id);
  res.json({ status:'success', message:'Musique supprimée.' });
});

// ADD musique par URL externe
app.post('/api/add-music-url', requireLogin, async (req, res) => {
  const { title, category, url, coverUrl } = req.body;
  if (!title||!category||!url||!coverUrl) {
    return res.status(400).json({ status:'error', message:'Champs manquants.' });
  }
  const music = await Music.create({
    title,   category,
    uploader:         req.session.user.id,
    externalUrl:      url,
    externalCoverUrl: coverUrl,
    listenCount:      0,
    downloadCount:    0,
    uploadedAt:       new Date()
  });
  res.json({ status:'success', music });
});

// ─── FAVORIS ───────────────────────────────────────────────
app.post('/api/add-favorite',   requireLogin, async (req, res) => {
  await User.findByIdAndUpdate(req.session.user.id, {
    $addToSet: { favorites: req.body.id }
  });
  res.json({ status:'success' });
});
app.post('/api/remove-favorite',requireLogin, async (req, res) => {
  await User.findByIdAndUpdate(req.session.user.id, {
    $pull: { favorites: req.body.id }
  });
  res.json({ status:'success' });
});
app.get('/api/favorites', requireLogin, async (req, res) => {
  const u = await User.findById(req.session.user.id)
    .populate({
      path:'favorites',
      populate:{ path:'uploader', select:'username' }
    })
    .lean();
  const favs = u.favorites.map(m => ({
    _id:           m._id,
    title:         m.title,
    path:          m.externalUrl || m.path,
    cover:         m.externalCoverUrl || m.cover,
    uploader:      m.uploader?.username || 'Anonyme',
    listenCount:   m.listenCount  ?? 0,
    downloadCount: m.downloadCount?? 0
  }));
  res.json({ status:'success', favorites: favs });
});

// ─── STATS UNIQUES ─────────────────────────────────────────
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

// ─── TOP 5 ──────────────────────────────────────────────────
app.get('/api/top', async (_req, res) => {
  const docs = await Music.find().sort({ listenCount:-1 }).limit(5)
    .populate('uploader','username').lean();
  const top = docs.map(m => ({
    _id:        m._id,
    title:      m.title,
    path:       m.externalUrl||m.path,
    cover:      m.externalCoverUrl||m.cover,
    listenCount:m.listenCount,
    uploader:   m.uploader?.username || 'Anonyme'
  }));
  res.json({ status:'success', top });
});

// ─── PASSWORD RESET ────────────────────────────────────────
const resetFile = path.join(__dirname,'resetTokens.json');
if (!fs.existsSync(resetFile)) fs.writeFileSync(resetFile,'[]');

app.post('/api/reset-request', async (req, res) => {
  const { email } = req.body;
  const u = await User.findOne({ email: email.toLowerCase() });
  if (!u) return res.json({ status:'error', message:'Adresse inconnue.' });

  const token     = crypto.randomBytes(24).toString('hex');
  const expiresAt = Date.now() + 15*60*1000;
  const tokens    = JSON.parse(fs.readFileSync(resetFile));
  tokens.push({ email: u.email, token, expiresAt });
  fs.writeFileSync(resetFile, JSON.stringify(tokens,null,2));

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

app.post('/api/reset-password', (req, res) => {
  const { token, newPassword } = req.body;
  const tokens = JSON.parse(fs.readFileSync(resetFile));
  const entry  = tokens.find(t => t.token === token);
  if (!entry || Date.now() > entry.expiresAt) {
    return res.status(400).json({ status:'error', message:'Lien invalide ou expiré.' });
  }
  User.findOne({ email: entry.email })
    .then(u => {
      u.password = bcrypt.hashSync(newPassword, 10);
      return u.save();
    })
    .then(() => {
      const remaining = tokens.filter(t => t.token !== token);
      fs.writeFileSync(resetFile, JSON.stringify(remaining,null,2));
      res.json({ status:'success', message:'Mot de passe modifié !' });
    })
    .catch(err => {
      console.error('reset-password error:', err);
      res.status(500).json({ status:'error', message:'Erreur serveur.' });
    });
});

// ─── PROFILE PHOTOS & CREATORS ─────────────────────────────
const creatorsFile = path.join(__dirname,'data','createurs.json');
if (!fs.existsSync(path.dirname(creatorsFile))) {
  fs.mkdirSync(path.dirname(creatorsFile), { recursive:true });
}
if (!fs.existsSync(creatorsFile)) {
  fs.writeFileSync(creatorsFile,'[]');
}
const photoUpload = multer({ dest: facesDir });

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
  fs.writeFileSync(creatorsFile, JSON.stringify(creators,null,2));
  res.json({ success:true, photo:`/faces/${newName}` });
});
app.get('/api/creators', (_req, res) => {
  const data = JSON.parse(fs.readFileSync(creatorsFile));
  res.json({ status:'success', creators: data });
});

// ─── EXPORT, PING & DÉMARRAGE ─────────────────────────────
app.get('/api/export-data', async (_req, res) => {
  const users    = await User.find().select('-password').lean();
  const musics   = await Music.find().populate('uploader','username email').lean();
  const tokens   = JSON.parse(fs.readFileSync(resetFile));
  const creators = JSON.parse(fs.readFileSync(creatorsFile));
  res.json({ status:'success', users, musics, tokens, creators });
});
app.get('/api/ping', (_req, res) => res.json({ pong:true }));
app.get('/', (_req, res) => res.sendFile(path.join(__dirname,'public','index.html')));

app.listen(PORT, () => console.log(`🚀 Serveur MoziKa sur http://localhost:${PORT}`));
