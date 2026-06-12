const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'smart-erp-secret-key-xyz';

async function authMiddleware(req, res, next) {
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
    const db = require('../db');
    
    // 1. 해당 유저가 소속된 기본 회사의 parent_id 정보를 DB에서 직접 실시간 조회하여 root_company_id 특정
    const comps = await db.query("SELECT id, parent_id FROM companies WHERE id = ?", [decoded.company_id]);
    if (comps.length === 0) {
      return res.status(401).json({ error: "존재하지 않거나 삭제된 회사 계정 소속입니다." });
    }
    
    const myComp = comps[0];
    const rootCompanyId = myComp.parent_id || myComp.id;
    
    let activeCompanyId = decoded.company_id;
    const clientActiveId = req.headers['x-active-company-id'];
    
    // 2. 만약 클라이언트가 활성화 지사 전환을 명시했을 경우 권한 검사 수행
    if (clientActiveId) {
      const activeIdInt = parseInt(clientActiveId, 10);
      if (activeIdInt === rootCompanyId) {
        // 본사 데이터로 전환
        activeCompanyId = rootCompanyId;
      } else {
        // 하위 지사인지 확인
        const activeComps = await db.query("SELECT id, parent_id FROM companies WHERE id = ?", [activeIdInt]);
        if (activeComps.length > 0 && activeComps[0].parent_id === rootCompanyId) {
          activeCompanyId = activeIdInt;
        } else {
          return res.status(403).json({ error: "지정한 본사/지사 데이터에 접근할 권한이 없습니다." });
        }
      }
    }
    
    // req.user에 사용자 고유 정보 바인딩
    req.user = {
      id: decoded.id,
      username: decoded.username,
      company_id: activeCompanyId,       // 현재 작업 중인 본점/지점 ID
      root_company_id: rootCompanyId,    // 대표 본점 ID (공유 데이터 조회용)
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
