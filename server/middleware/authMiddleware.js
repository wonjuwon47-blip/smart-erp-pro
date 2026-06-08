const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'smart-erp-secret-key-xyz';

function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  
  if (!authHeader) {
    return res.status(401).json({ error: "인증 토큰이 누락되었습니다. 로그인이 필요합니다." });
  }

  const tokenParts = authHeader.split(' ');
  if (tokenParts.length !== 2 || tokenParts[0] !== 'Bearer') {
    return res.status(401).json({ error: "올바르지 않은 토큰 규격입니다. 'Bearer <token>' 형식을 따르세요." });
  }

  const token = tokenParts[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // req.user에 사용자 고유 정보 바인딩
    req.user = {
      id: decoded.id,
      username: decoded.username,
      company_id: decoded.company_id,
      role: decoded.role,
      name: decoded.name
    };
    next();
  } catch (err) {
    console.error("JWT Verification Error:", err.message);
    return res.status(401).json({ error: "유효하지 않거나 만료된 세션 토큰입니다. 다시 로그인해 주세요." });
  }
}

// 특정 권한 보유자 제한 미들웨어 팩토리
function roleMiddleware(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "로그인이 필요합니다." });
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "해당 기능을 실행할 수 있는 권한이 없습니다." });
    }
    
    next();
  };
}

module.exports = {
  authMiddleware,
  roleMiddleware
};
