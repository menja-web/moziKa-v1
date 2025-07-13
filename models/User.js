// models/User.js

const mongoose = require('mongoose')

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  joinedAt: {
    type: Date,
    default: Date.now
  },
favorites: [{
  type: mongoose.Schema.Types.ObjectId,
  ref: 'Music'
}]
})

module.exports = mongoose.model('User', userSchema)
