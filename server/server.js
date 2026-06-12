const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const db = require('./db');

// 환경변수(.env) 파일 로드
dotenv.config();

const app = reportApp();
function reportApp() {
  return express();
}
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// API 라우터 마운트
app.use('/api/auth', require('./routes/auth'));
app.use('/api/erp', require('./routes/erp'));
app.use('/api/ocr', require('./routes/ocr'));

// DB 연결 진단 API
app.get('/api/db-status', (req, res) => {
  res.json({
    dbType: db.dbType,
    lastDbError: db.lastDbError || null,
    timestamp: new Date().toISOString()
  });
});

// 정적 파일 서빙 대상: 프로젝트 루트 디렉토리를 서빙 (index.html, app.js, style.css)
const rootPath = path.resolve(__dirname, '../');
app.use(express.static(rootPath));

// API가 아닌 라우트의 경우 바닐라 JS index.html 반환 (Catch-All)
app.get('*', (req, res) => {
  res.sendFile(path.join(rootPath, 'index.html'));
});

// 데이터베이스 초기화 및 서버 기동
async function startServer() {
  try {
    // 1. DB 초기화 (테이블 자동 생성)
    await db.initDb();
    
    // 2. 서버 포트 리스닝 시작
    app.listen(PORT, () => {
      console.log(`====================================================`);
      console.log(`  AI SMART ERP API 백엔드 서버 가동 중 (포트: ${PORT})`);
      console.log(`  바닐라 JS 프론트엔드가 호스팅되고 있습니다.`);
      console.log(`====================================================`);
    });
  } catch (err) {
    console.error("서버 가동 실패:", err);
    process.exit(1);
  }
}

startServer();
