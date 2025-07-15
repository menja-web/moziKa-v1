module.exports = (req, res, next) => {
  console.log("🛡️ Middleware isAdmin →", req.user);
  if (req.user?.isAdmin === true) return next();
  return res.status(403).json({ error: 'Accès refusé : admin requis.' });
};
