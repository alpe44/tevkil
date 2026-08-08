const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET;
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
console.log(`[jwt] JWT_EXPIRES_IN ham değer = ${JSON.stringify(process.env.JWT_EXPIRES_IN)}, kullanılan = ${JSON.stringify(EXPIRES_IN)}`);

if (!SECRET) {
  throw new Error('JWT_SECRET tanımlı değil (.env dosyasını kontrol edin).');
}

function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN });
}

function verifyToken(token) {
  return jwt.verify(token, SECRET);
}

module.exports = { signToken, verifyToken };
