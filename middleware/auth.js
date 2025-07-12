function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.status(403).json({ status: 'error', message: 'Non connecté.' });
  }
  next();
}

module.exports = requireLogin;
