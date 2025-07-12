const mongoose = require('mongoose');

const musicSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    trim: true
  },
  uploader: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // URL Cloudinary ou chemin local
  path: {
    type: String,
    required: true
  },
  cover: {
    type: String,
    required: true
  },
  listenCount: {
    type: Number,
    default: 0
  },
  downloadCount: {
    type: Number,
    default: 0
  },
  listenerList: [   // ← anciennement 'listeners'
    {
      type: String,
      lowercase: true,
      trim: true
    }
  ],
  downloaderList: [ // ← anciennement 'downloaders'
    {
      type: String,
      lowercase: true,
      trim: true
    }
  ],
  uploadedAt: {
    type: Date,
    default: Date.now
  },
  externalUrl: {
    type: String,
    default: null
  },
  externalCoverUrl: {
    type: String,
    default: null
  }
}, {
  timestamps: true // Ajoute createdAt et updatedAt automatiquement
});

module.exports = mongoose.model('Music', musicSchema);
