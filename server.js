// server.js

// 1) Chargement des variables d’environnement
require('dotenv').config()

// 2) Import des modules
const express    = require('express')
const mongoose   = require('mongoose')
const path       = require('path')
const fs         = require('fs')
const session    = require('express-session')
const MongoStore = require('connect-mongo')
const multer     = require('multer')
const nodemailer = require('nodemailer')
const bcrypt     = require('bcrypt')
const crypto     = require('crypto')
const cors       = require('cors')

// 3) Initialisation de l’app
const app    = express()
const PORT   = process.env.PORT || 3000
const isProd = process.env.NODE_ENV === 'production'

// 4) Si derrière un proxy (Render), pour secure cookies
app.set('trust proxy', 1)

// 5) CORS – n’autorise que l’URL frontale configurée
app.use(cors({
  origin:      process.env.FRONTEND_URL || `http://localhost:${PORT}`,
  credentials: true
}))

// 6) Connexion à MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connecté'))
  .catch(err => console.error('❌ Erreur MongoDB :', err))

// 7) Préparation des dossiers & fichiers JSON
const uploadDir    = path.join(__dirname, 'uploads')
const dataDir      = path.join(__dirname, 'data')
const usersFile    = path.join(__dirname, 'users.json')
const musicsFile   = path.join(__dirname, 'musics.json')
const resetFile    = path.join(__dirname, 'resetTokens.json')
const creatorsFile = path.join(dataDir, 'createurs.json')

// Création si nécessaire
;[uploadDir, dataDir].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d) })
;[usersFile, musicsFile, resetFile, creatorsFile].forEach(f => {
  if (!fs.existsSync(f)) fs.writeFileSync(f, JSON.stringify([]))
})

// Chargement initial en mémoire
let musics = JSON.parse(fs.readFileSync(musicsFile))

// 8) Middlewares globaux
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use(session({
  secret:            process.env.SESSION_SECRET || 'mozika-secret-dev',
  resave:            false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl:    process.env.MONGODB_URI,
    ttl:         24 * 60 * 60,      // 1 jour en secondes
    autoRemove:  'native'
  }),
  cookie: {
    maxAge:   24 * 60 * 60 * 1000,   // 1 jour en ms
    httpOnly: true,
    secure:   isProd,               // HTTPS only en prod
    sameSite: isProd ? 'None' : 'Lax'
  }
}))

// 9) Fichiers statiques
app.use(express.static(path.join(__dirname, 'public')))
app.use('/uploads', express.static(uploadDir))
app.use('/data',    express.static(dataDir))

// 10) Multer – upload musique & cover
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename:    (req, file, cb) => {
    const ext    = path.extname(file.originalname)
    const uniq   = Date.now() + '-' + Math.floor(Math.random() * 1e4)
    const prefix = file.fieldname.startsWith('music') ? 'music-' : 'cover-'
    cb(null, prefix + uniq + ext)
  }
})
const upload = multer({ storage })

// 11) Middleware de protection
function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.status(403).json({ status: "error", message: "Non connecté." })
  }
  next()
}

// ────────────────────────────────────
//           ROUTES API
// ────────────────────────────────────

// 1) Envoi du code de vérification
app.post('/api/send-code', async (req, res) => {
  const { email, username, password } = req.body
  const code = Math.floor(100000 + Math.random() * 900000).toString()
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth:    { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    })
    await transporter.sendMail({
      from:    `MoziKa <${process.env.EMAIL_USER}>`,
      to:      email,
      subject: '🔐 Ton code MoziKa',
      text:    `Bonjour ${username},\n\nTon code : ${code}`
    })
    req.session.verificationCode = code
    req.session.pendingUser       = { email, username, password }
    res.json({ status: "success", message: "Code envoyé !" })
  } catch (err) {
    console.error('send-code error:', err)
    res.status(500).json({ status: "error", message: "Échec envoi mail." })
  }
})

// 2) Validation & création de compte
app.post('/api/register', (req, res) => {
  const { code } = req.body
  const pending  = req.session.pendingUser
  if (!pending || code !== req.session.verificationCode) {
    return res.status(400).json({ status: "error", message: "Code invalide." })
  }
  const users = JSON.parse(fs.readFileSync(usersFile))
  if (users.find(u => u.email.toLowerCase() === pending.email.toLowerCase())) {
    return res.status(409).json({ status: "error", message: "Email déjà utilisé." })
  }
  const hash = bcrypt.hashSync(pending.password, 10)
  users.push({
    username: pending.username,
    email:    pending.email,
    password: hash,
    joinedAt: new Date().toISOString(),
    favorites: []
  })
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2))
  req.session.user = { username: pending.username, email: pending.email }
  delete req.session.pendingUser
  delete req.session.verificationCode
  res.json({ status: "success", message: "Inscription réussie !" })
})

// 3) Connexion
app.post('/api/login', (req, res) => {
  const { email, password } = req.body
  const users               = JSON.parse(fs.readFileSync(usersFile))
  const u                   = users.find(u => u.email.toLowerCase() === email.toLowerCase())
  if (!u || !bcrypt.compareSync(password, u.password)) {
    return res.status(401).json({ status: "error", message: "Identifiants invalides." })
  }
  req.session.user = { username: u.username, email: u.email }
  res.json({ status: "success", username: u.username, email: u.email })
})

// 4) Déconnexion
app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.redirect('/')
    res.clearCookie('connect.sid')
    res.redirect('/')
  })
})

// 5) Session & user info
app.get('/api/get-session', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ status: "error", message: "Non connecté." })
  }
  res.json({ status: "success", user: req.session.user })
})
app.get('/api/user-email', (req, res) => {
  res.json({ email: req.session.user?.email || "" })
})

// 6) Toutes les musiques
app.get('/api/musics', (req, res) => {
  res.json({ musics })
})

// 7) Upload musique + cover
app.post(
  '/api/upload',
  requireLogin,
  upload.fields([
    { name: 'musicFile', maxCount: 1 },
    { name: 'coverFile', maxCount: 1 }
  ]),
  (req, res) => {
    const { title, category } = req.body
    const mf = req.files['musicFile']?.[0]
    const cf = req.files['coverFile']?.[0]
    if (!title || !category || !mf || !cf) {
      return res.status(400).json({ status: "error", message: "Champs manquants." })
    }
    const newMusic = {
      title,
      category,
      uploader_email: req.session.user.email,
      uploader_name:  req.session.user.username,
      path:           "/uploads/" + mf.filename,
      cover:          "/uploads/" + cf.filename,
      listenCount:    0,
      downloadCount:  0,
      listeners:      [],
      downloaders:    [],
      uploadedAt:     new Date().toISOString()
    }
    musics.push(newMusic)
    fs.writeFileSync(musicsFile, JSON.stringify(musics, null, 2))
    res.json({ status: "success", music: newMusic })
  }
)

// 8) Écoute unique
app.post('/api/listen', requireLogin, (req, res) => {
  const { path } = req.body
  const m        = musics.find(m => m.path === path)
  if (!m) return res.status(404).json({ status: "error" })
  m.listeners = m.listeners || []
  if (!m.listeners.includes(req.session.user.email)) {
    m.listenCount++
    m.listeners.push(req.session.user.email)
    fs.writeFileSync(musicsFile, JSON.stringify(musics, null, 2))
  }
  res.json({ status: "success", count: m.listenCount })
})

// 9) Download unique
app.post('/api/download', requireLogin, (req, res) => {
  const { path } = req.body
  const m        = musics.find(m => m.path === path)
  if (!m) return res.status(404).json({ status: "error" })
  m.downloaders = m.downloaders || []
  if (!m.downloaders.includes(req.session.user.email)) {
    m.downloadCount++
    m.downloaders.push(req.session.user.email)
    fs.writeFileSync(musicsFile, JSON.stringify(musics, null, 2))
  }
  res.json({ status: "success", count: m.downloadCount })
})

// 10) Suppression de musique (corrigée)
// … au-dessus, rien ne change …

// 10) Suppression de musique (patch corrigé)
app.post('/api/delete', requireLogin, (req, res) => {
  console.log('[DELETE] user:', req.session.user, 'body:', req.body)

  const musicPath = req.body.path
  if (!musicPath) {
    return res
      .status(400)
      .json({ status: "error", message: "Champ `path` manquant." })
  }

  // On recherche l’index de la musique à supprimer
  const idx = musics.findIndex(item =>
    item.path === musicPath &&
    item.uploader_email === req.session.user.email
  )
  if (idx === -1) {
    return res
      .status(404)
      .json({ status: "error", message: "Musique non trouvée ou non autorisée." })
  }

  // Suppression des fichiers audio + cover
  const target = musics[idx]
  for (const rel of [target.path, target.cover]) {
    const relClean = rel.replace(/^\/+/, '')            // supprime le slash initial
    const fullPath = path.join(uploadDir, relClean)
    if (fs.existsSync(fullPath)) {
      try {
        fs.unlinkSync(fullPath)
        console.log('[DELETE] fichier supprimé:', fullPath)
      } catch (err) {
        console.error('[DELETE] erreur unlinkSync:', err)
      }
    }
  }

  // On retire l’entrée de la liste et on écrit dans le JSON
  musics.splice(idx, 1)
  fs.writeFileSync(musicsFile, JSON.stringify(musics, null, 2))
  console.log('[DELETE] musics.json mis à jour')

  return res.json({ status: "success", message: "Musique supprimée." })
})

// … le reste du server.js reste inchangé …


// 11) Favoris
app.post('/api/add-favorite', requireLogin, (req, res) => {
  const { path } = req.body
  const users    = JSON.parse(fs.readFileSync(usersFile))
  const u        = users.find(u => u.email === req.session.user.email)
  u.favorites    = u.favorites || []
  if (!u.favorites.includes(path)) u.favorites.push(path)
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2))
  res.json({ status: "success" })
})
app.post('/api/remove-favorite', requireLogin, (req, res) => {
  const { path } = req.body
  const users    = JSON.parse(fs.readFileSync(usersFile))
  const u        = users.find(u => u.email === req.session.user.email)
  u.favorites    = (u.favorites||[]).filter(p => p !== path)
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2))
  res.json({ status: "success" })
})
app.get('/api/favorites', requireLogin, (req, res) => {
  const users = JSON.parse(fs.readFileSync(usersFile))
  const u     = users.find(u => u.email === req.session.user.email)
  res.json({ status: "success", favorites: musics.filter(m => u.favorites?.includes(m.path)) })
})

// 12) Top 5 musiques
app.get('/api/top', (req, res) => {
  const top = [...musics].sort((a,b) => b.listenCount - a.listenCount).slice(0,5)
  res.json({ top })
})

// 13) Musiques par utilisateur
app.get('/api/musics-by-user', requireLogin, (req, res) => {
  res.json({ status: "success", musics: musics.filter(m => m.uploader_email === req.session.user.email) })
})

// 14) Reset password – request
app.post('/api/reset-request', async (req, res) => {
  const { email } = req.body
  const users     = JSON.parse(fs.readFileSync(usersFile))
  const u         = users.find(u => u.email.toLowerCase() === email.toLowerCase())
  if (!u) return res.json({ status: "error", message: "Adresse inconnue." })
  const token     = crypto.randomBytes(24).toString('hex')
  const expiresAt = Date.now() + 15 * 60 * 1000
  const tokens    = JSON.parse(fs.readFileSync(resetFile))
  tokens.push({ email: u.email, token, expiresAt })
  fs.writeFileSync(resetFile, JSON.stringify(tokens, null, 2))
  const baseUrl = isProd ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME}` : `http://localhost:${PORT}`
  const link    = `${baseUrl}/new-password.html?token=${token}`
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth:    { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    })
    await transporter.sendMail({
      from:    `MoziKa <${process.env.EMAIL_USER}>`,
      to:      u.email,
      subject: '🔐 Réinitialisation MoziKa',
      text:    `Bonjour ${u.username},\n\nVoici ton lien : ${link}\nValable 15 min.`
    })
    res.json({ status: "success", message: "Lien envoyé !" })
  } catch (err) {
    console.error('reset-request error:', err)
    res.status(500).json({ status: "error", message: "Échec envoi mail." })
  }
})

// 15) Reset password – change
app.post('/api/reset-password', (req, res) => {
  const { token, newPassword } = req.body
  const tokens                 = JSON.parse(fs.readFileSync(resetFile))
  const entry                  = tokens.find(t => t.token === token)
  if (!entry || Date.now() > entry.expiresAt) {
    return res.status(400).json({ status: "error", message: "Lien invalide ou expiré." })
  }
  const users = JSON.parse(fs.readFileSync(usersFile))
  const u     = users.find(u => u.email === entry.email)
  if (!u) return res.status(400).json({ status: "error", message: "Utilisateur introuvable." })
  u.password = bcrypt.hashSync(newPassword, 10)
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2))
  fs.writeFileSync(resetFile, JSON.stringify(tokens.filter(t => t.token !== token), null, 2))
  res.json({ status: "success", message: "Mot de passe modifié !" })
})

// 16) Change password (connecté)
app.post('/api/change-password', requireLogin, (req, res) => {
  const { oldPassword, newPassword } = req.body
  const users = JSON.parse(fs.readFileSync(usersFile))
  const u     = users.find(u => u.email === req.session.user.email)
  if (!u) return res.status(404).json({ status: "error", message: "Utilisateur introuvable." })
  if (!bcrypt.compareSync(oldPassword, u.password)) {
    return res.status(403).json({ status: "error", message: "Ancien mot de passe incorrect." })
  }
  u.password = bcrypt.hashSync(newPassword, 10)
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2))
  res.json({ status: "success", message: "Mot de passe mis à jour !" })
})

// 17) Update photo profil
const photoUpload = multer({ dest: path.join(__dirname, 'public/faces/') })
app.post('/api/update-photo', photoUpload.single('photo'), (req, res) => {
  const { username } = req.body
  if (!username || !req.file) return res.json({ success: false })
  const ext      = path.extname(req.file.originalname)
  const newName  = req.file.filename + ext
  const destPath = path.join(__dirname, 'public', 'faces', newName)
  fs.mkdirSync(path.dirname(destPath), { recursive: true })
  fs.renameSync(req.file.path, destPath)
  const creators = JSON.parse(fs.readFileSync(creatorsFile))
  const idx      = creators.findIndex(c => c.username === username)
  if (idx !== -1) {
    creators[idx].photo = './faces/' + newName
    fs.writeFileSync(creatorsFile, JSON.stringify(creators, null, 2))
    return res.json({ success: true, newPath: './faces/' + newName })
  }
  res.json({ success: false })
})

// 18) Route liste créateurs externe
app.use(require('./routes/get-createurs'))

// 19) Démarrage du serveur
app.listen(PORT, () => {
  console.log(`🎵 MoziKa actif sur http://localhost:${PORT}`)
})
