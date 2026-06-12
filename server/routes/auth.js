const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { authMiddleware } = require('../middleware/authMiddleware');

const JWT_SECRET = process.env.JWT_SECRET || 'smart-erp-secret-key-xyz';

// 회원가입 API (신규 회사 동시 개설)
router.post('/register', async (req, res) => {
  const { username, password, companyName, name } = req.body;

  if (!username || !password || !companyName || !name) {
    return res.status(400).json({ error: "아이디, 비밀번호, 회사명, 성명을 모두 입력해 주세요." });
  }

  try {
    // 1. 기존 유저 ID 중복 체크
    const existingUsers = await db.query("SELECT id FROM users WHERE username = ?", [username]);
    if (existingUsers.length > 0) {
      return res.status(400).json({ error: "이미 존재하는 아이디입니다." });
    }

    // 2. 신규 회사 생성 및 회사 ID(company_id) 획득
    const companyId = await db.executeInsert("INSERT INTO companies (name) VALUES (?)", [companyName]);

    // 3. 비밀번호 해싱
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // 4. 새 사용자 추가 (최초 가입자는 admin 권한 부여)
    await db.executeInsert(
      "INSERT INTO users (username, password_hash, company_id, role, name) VALUES (?, ?, ?, 'admin', ?)",
      [username, passwordHash, companyId, name]
    );

    res.status(201).json({ success: true, message: "회원가입 및 회사 등록이 성공적으로 완료되었습니다." });
  } catch (err) {
    console.error("Registration Error:", err);
    res.status(500).json({ error: "서버 오류로 인해 회원가입에 실패했습니다." });
  }
});

// 로그인 API
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "아이디와 비밀번호를 입력해 주세요." });
  }

  try {
    // 1. 유저 조회
    const users = await db.query(
      "SELECT u.*, c.name AS company_name, c.parent_id FROM users u JOIN companies c ON u.company_id = c.id WHERE u.username = ?",
      [username]
    );

    if (users.length === 0) {
      return res.status(400).json({ error: "존재하지 않는 아이디이거나 비밀번호가 틀렸습니다." });
    }

    const user = users[0];

    // 2. 비밀번호 매칭 검증
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: "존재하지 않는 아이디이거나 비밀번호가 틀렸습니다." });
    }

    // 3. 사용자가 전환 가능한 본사 및 모든 지사 목록 조회
    const rootCompanyId = user.parent_id || user.company_id;
    const branches = await db.query(
      "SELECT id, name, parent_id FROM companies WHERE id = ? OR parent_id = ? ORDER BY parent_id ASC, id ASC",
      [rootCompanyId, rootCompanyId]
    );

    // 4. JWT 토큰 서명
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        company_id: user.company_id,
        role: user.role,
        name: user.name
      },
      JWT_SECRET,
      { expiresIn: '7d' } // 7일 유효
    );

    res.json({
      success: true,
      token: token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        companyId: user.company_id,
        companyName: user.company_name,
        rootCompanyId: rootCompanyId,
        role: user.role
      },
      branches: branches.map(b => ({
        id: b.id,
        name: b.name,
        isParent: b.parent_id === null || b.parent_id === undefined
      }))
    });
  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ error: "서버 오류로 인해 로그인에 실패했습니다." });
  }
});

// 내 정보 세션 확인 API
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const rootCompanyId = req.user.root_company_id;
    
    // 1. 사용자가 전환 가능한 본사 및 모든 지사 목록 조회
    const branches = await db.query(
      "SELECT id, name, parent_id FROM companies WHERE id = ? OR parent_id = ? ORDER BY parent_id ASC, id ASC",
      [rootCompanyId, rootCompanyId]
    );

    // 2. 현재 활성화된 세션 회사 정보 조회
    const companies = await db.query("SELECT name, parent_id FROM companies WHERE id = ?", [req.user.company_id]);
    const companyName = companies.length > 0 ? companies[0].name : "미지정 회사";
    const isBranch = companies.length > 0 ? (companies[0].parent_id !== null && companies[0].parent_id !== undefined) : false;
    
    res.json({
      success: true,
      user: {
        id: req.user.id,
        username: req.user.username,
        name: req.user.name,
        companyId: req.user.company_id,
        companyName: companyName,
        rootCompanyId: rootCompanyId,
        isBranch: isBranch,
        role: req.user.role
      },
      branches: branches.map(b => ({
        id: b.id,
        name: b.name,
        isParent: b.parent_id === null || b.parent_id === undefined
      }))
    });
  } catch (err) {
    console.error("Session profile load error:", err);
    res.status(500).json({ error: "서버 오류로 인해 세션 정보를 로드하지 못했습니다." });
  }
});

module.exports = router;
