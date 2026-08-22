module.exports = async (req, res) => {
  res.setHeader('Set-Cookie', 'mh_access=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure');
  return res.status(200).json({ ok: true });
};
