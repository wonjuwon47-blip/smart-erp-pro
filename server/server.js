const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const db = require('./db');

// 환경변수(.env) 파일 로드
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// CORS 및 미들웨어 설정
app.use(cors());
app.use(express.json());

// API 라우터 마운트
app.use('/api/auth', require('./routes/auth'));
app.use('/api/erp', require('./routes/erp'));
app.use('/api/ocr', require('./routes/ocr'));

// 빌드된 프론트엔드 static 파일 호스팅 (Vite React 빌드 아웃풋)
const distPath = path.resolve(__dirname, '../dist');
app.use(express.static(distPath));

// API가 아닌 라우트의 경우 React SPA 라우팅을 지원하기 위해 index.html 반환 (Catch-All)
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// 데이터베이스 초기화 및 서버 기동
async function startServer() {
  try {
    // 1. DB 초기화 (테이블 자동 생성)
    await db.initDb();
    
    // 2. 서버 포트 리스닝 시작
    app.listen(PORT, () => {
      console.log(`====================================================`);
      console.log(`  Smart ERP Pro API 백엔드 서버 가동 중 (포트: ${PORT})`);
      console.log(`  배포 타겟: Render (PostgreSQL / SQLite 하이브리드 지원)`);
      console.log(`====================================================`);
    });
  } catch (err) {
    console.error("서버 가동 실패:", err);
    process.exit(1);
  }
}

startServer();
