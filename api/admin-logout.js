const { clearAdminCookie } = require('./admin-auth');

module.exports = async (req, res) => {
  clearAdminCookie(res);
  return res.status(200).json({ ok: true });
};
