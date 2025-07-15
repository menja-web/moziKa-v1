module.exports = (req, res, next) => {
  if (req.user?.isAdmin) return next();
  return res.status(403).json({ error: 'Accès refusé : admin requis.' });
};
