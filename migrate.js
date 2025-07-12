// migrate.js
require('dotenv').config()
const mongoose = require('mongoose')
const fs       = require('fs')
const path     = require('path')

// Import des modèles
const User  = require('./models/User')
const Music = require('./models/Music')

// Chemins vers les JSON et dossier d’uploads
const usersFile  = path.join(__dirname, 'users.json')
const musicsFile = path.join(__dirname, 'data', 'musics.json')

async function migrate() {
  // 1) Connexion à MongoDB
  await mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
  console.log('✅ Connecté à MongoDB')

  // 2) Vider les collections existantes
  await User.deleteMany({})
  await Music.deleteMany({})

  // 3) Charger les données JSON
  const usersData  = JSON.parse(fs.readFileSync(usersFile,  'utf8'))
  const musicsData = JSON.parse(fs.readFileSync(musicsFile, 'utf8'))

  // 4) Créer les utilisateurs
  const userMap = new Map() // email → User doc
  for (const u of usersData) {
    const doc = await User.create({
      username: u.username,
      email:    u.email,
      password: u.password,
      joinedAt: u.joinedAt ? new Date(u.joinedAt) : undefined
    })
    userMap.set(u.email, doc)
  }
  console.log(`🧍 ${userMap.size} utilisateurs migrés`)

  // 5) Créer les musiques
  const musicMap = new Map() // path → Music doc
  for (const m of musicsData) {
    const uploader = userMap.get(m.uploader_email)
    if (!uploader) {
      console.warn(`⚠️ Uploader inconnu pour "${m.title}"`)
      continue
    }

    // Détecter URL externe
    const isExt   = m.path.startsWith('http')
    const isExtCv = m.cover.startsWith('http')

    const doc = await Music.create({
      title:           m.title,
      category:        m.category,
      uploader:        uploader._id,
      path:            isExt   ? undefined : m.path,
      cover:           isExtCv ? undefined : m.cover,
      externalUrl:     isExt   ? m.path  : null,
      externalCoverUrl:isExtCv ? m.cover : null,
      listenCount:     m.listenCount  || 0,
      downloadCount:   m.downloadCount|| 0,
      listeners:       m.listeners    || [],
      downloaders:     m.downloaders  || [],
      uploadedAt:      m.uploadedAt   ? new Date(m.uploadedAt) : undefined
    })

    // Sauvegarder en map pour les favoris plus tard
    musicMap.set(m.path, doc)
  }
  console.log(`🎵 ${musicMap.size} musiques migrées`)

  // 6) Mettre à jour les favoris
  let favCount = 0
  for (const u of usersData) {
    const doc = userMap.get(u.email)
    if (!u.favorites || !u.favorites.length) continue

    const favIds = u.favorites
      .map(fp => musicMap.get(fp)?._id)
      .filter(Boolean)

    if (favIds.length) {
      doc.favorites = favIds
      await doc.save()
      favCount += favIds.length
    }
  }
  console.log(`❤️ ${favCount} favoris liés aux utilisateurs`)

  console.log('🎉 Migration terminée')
  process.exit(0)
}

migrate().catch(err => {
  console.error('❌ Erreur de migration :', err)
  process.exit(1)
})
