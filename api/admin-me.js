const { getAdmin } = require('./admin-auth');

module.exports = async (req, res) => {
  const admin = getAdmin(req);
  if (!admin) return res.status(401).json({ authenticated: false });
  return res.status(200).json({ authenticated: true, email: admin.email });
};
