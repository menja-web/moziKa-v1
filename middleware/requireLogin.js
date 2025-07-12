function requireLogin(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(403).json({
      status: 'error',
      message: 'Non connecté. Veuillez vous authentifier.'
    });
  }
  next();
}

module.exports = requireLogin;
