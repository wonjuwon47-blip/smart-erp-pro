const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

let dbType = 'sqlite';
let pgPool = null;
let sqliteDb = null;

// sqlite3 모듈 lazy-load
let sqlite3 = null;
try {
  sqlite3 = require('sqlite3').verbose();
} catch (e) {
  console.warn("sqlite3 모듈을 로드할 수 없습니다. PostgreSQL 모드만 사용 가능합니다.");
}

// Render 등 클라우드 환경에서 DATABASE_URL이 주어지면 PostgreSQL 사용
const connectionString = process.env.DATABASE_URL || "postgresql://smart_erp_db_2o7b_user:OZRggEHCo0AECVqpgzNwGA3Nzx992jTn@dpg-d8j4sjmq1p3s73fbgrjg-a/smart_erp_db_2o7b";

// 디폴트로 SQLite 데이터베이스 준비
const dbPath = path.resolve(__dirname, '../db.sqlite');
if (sqlite3) {
  sqliteDb = new sqlite3.Database(dbPath);
  console.log("로컬 SQLite 백업 드라이버가 준비되었습니다: " + dbPath);
} else {
  console.log("SQLite 드라이버가 준비되지 않아 SQLite 백업이 비활성화되었습니다.");
}

if (connectionString) {
  pgPool = new Pool({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
  });
}

// 공용 쿼리 실행 헬퍼 (SELECT용)
function query(sql, params = []) {
  if (dbType === 'postgres') {
    let index = 1;
    const pgSql = sql.replace(/\?/g, () => `$${index++}`);
    return pgPool.query(pgSql, params).then(res => res.rows);
  } else {
    return new Promise((resolve, reject) => {
      sqliteDb.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

// 공용 수정/삭제 헬퍼 (UPDATE, DELETE용)
function execute(sql, params = []) {
  if (dbType === 'postgres') {
    let index = 1;
    const pgSql = sql.replace(/\?/g, () => `$${index++}`);
    return pgPool.query(pgSql, params).then(res => res.rowCount);
  } else {
    return new Promise((resolve, reject) => {
      sqliteDb.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  }
}

// 공용 삽입 헬퍼 (INSERT 후 생성된 PK id 반환용)
async function executeInsert(sql, params = [], idColumnName = 'id') {
  if (dbType === 'postgres') {
    let index = 1;
    const pgSql = sql.replace(/\?/g, () => `$${index++}`) + ` RETURNING ${idColumnName}`;
    const res = await pgPool.query(pgSql, params);
    return res.rows[0][idColumnName];
  } else {
    return new Promise((resolve, reject) => {
      sqliteDb.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });
  }
}

// 테이블 자동 생성 (DDL 초기화)
async function initDb() {
  if (connectionString) {
    try {
      // 3초 연결 타임아웃 테스트를 통해 PostgreSQL 가용 여부 판별
      const tempPool = new Pool({
        connectionString: connectionString,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 3000
      });
      await tempPool.query('SELECT 1');
      await tempPool.end();
      dbType = 'postgres';
      console.log("PostgreSQL 데이터베이스 연결을 검증하여 활성화했습니다.");
    } catch (e) {
      dbType = 'sqlite';
      console.warn("PostgreSQL 연결 검증 실패 (로컬 개발 환경으로 감지). SQLite 모드로 하이브리드 전환합니다. 사유: " + e.message);
    }
  } else {
    dbType = 'sqlite';
    console.log("데이터베이스 환경변수 미감지. SQLite로 자동 기동합니다.");
  }

  const isPg = dbType === 'postgres';
  const pkType = isPg ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
  const textType = isPg ? 'TEXT' : 'TEXT';
  const numericType = isPg ? 'NUMERIC' : 'NUMERIC';

  try {
    // 1. 회사 테이블
    await execute(`
      CREATE TABLE IF NOT EXISTS companies (
        id ${pkType},
        name VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. 사용자 테이블 (company_id 외래키 연동)
    await execute(`
      CREATE TABLE IF NOT EXISTS users (
        id ${pkType},
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash ${textType} NOT NULL,
        company_id INTEGER,
        role VARCHAR(20) DEFAULT 'staff',
        name VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 3. 거래처 테이블
    await execute(`
      CREATE TABLE IF NOT EXISTS partners (
        id ${pkType},
        company_id INTEGER NOT NULL,
        code VARCHAR(50) NOT NULL,
        name VARCHAR(100) NOT NULL,
        owner VARCHAR(50),
        biz_no VARCHAR(50),
        address ${textType},
        phone VARCHAR(50),
        type VARCHAR(20) NOT NULL, -- '매입처', '매출처', '혼합'
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 4. 기초 품목 테이블
    await execute(`
      CREATE TABLE IF NOT EXISTS products (
        id ${pkType},
        company_id INTEGER NOT NULL,
        code VARCHAR(50) NOT NULL,
        name VARCHAR(100) NOT NULL,
        unit VARCHAR(20) DEFAULT 'EA',
        origin VARCHAR(50) DEFAULT '국내산',
        purchase_price INTEGER DEFAULT 0,
        sales_price INTEGER DEFAULT 0,
        tax_type VARCHAR(20) DEFAULT '과세', -- '과세', '면세'
        stock ${numericType} DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 5. 전표(매출/매입) 테이블
    await execute(`
      CREATE TABLE IF NOT EXISTS invoices (
        id ${pkType},
        company_id INTEGER NOT NULL,
        type VARCHAR(20) NOT NULL, -- 'sales', 'purchase'
        partner_name VARCHAR(100) NOT NULL,
        date VARCHAR(20) NOT NULL,
        total_amount INTEGER DEFAULT 0,
        total_tax INTEGER DEFAULT 0,
        total_sum INTEGER DEFAULT 0,
        status VARCHAR(50) DEFAULT '청구(외상)', -- '청구(외상)', '영수(완납)'
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 6. 전표 상세 품목 테이블
    await execute(`
      CREATE TABLE IF NOT EXISTS invoice_items (
        id ${pkType},
        invoice_id INTEGER NOT NULL,
        name VARCHAR(100) NOT NULL,
        unit VARCHAR(20) DEFAULT 'EA',
        origin VARCHAR(50) DEFAULT '국내산',
        qty ${numericType} DEFAULT 1,
        price INTEGER DEFAULT 0,
        amount INTEGER DEFAULT 0,
        tax INTEGER DEFAULT 0,
        total INTEGER DEFAULT 0,
        is_tax_applied BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 7. 본사(사업소) 테이블
    await execute(`
      CREATE TABLE IF NOT EXISTS headquarters (
        id ${pkType},
        company_id INTEGER NOT NULL,
        name VARCHAR(100) NOT NULL,
        reg_no VARCHAR(50),
        owner VARCHAR(50),
        address ${textType},
        phone VARCHAR(50),
        business VARCHAR(100),
        stamp ${textType},
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 8. 사원 테이블
    await execute(`
      CREATE TABLE IF NOT EXISTS employees (
        id ${pkType},
        company_id INTEGER NOT NULL,
        code VARCHAR(50) NOT NULL,
        name VARCHAR(50) NOT NULL,
        dept VARCHAR(50),
        position VARCHAR(50),
        phone VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 9. 금융 계좌 테이블
    await execute(`
      CREATE TABLE IF NOT EXISTS banks (
        id ${pkType},
        company_id INTEGER NOT NULL,
        name VARCHAR(100) NOT NULL,
        acc_no VARCHAR(100) NOT NULL,
        owner VARCHAR(100),
        balance INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 10. 견적서 마스터 테이블
    await execute(`
      CREATE TABLE IF NOT EXISTS estimates (
        id VARCHAR(50) PRIMARY KEY,
        company_id INTEGER NOT NULL,
        date VARCHAR(20) NOT NULL,
        receiver VARCHAR(100) NOT NULL,
        ref VARCHAR(100),
        receiver_phone VARCHAR(50),
        supplier_name VARCHAR(100),
        supplier_bizno VARCHAR(50),
        supplier_owner VARCHAR(50),
        supplier_address ${textType},
        supplier_biztype VARCHAR(100),
        supplier_bizitem VARCHAR(100),
        supplier_manager VARCHAR(50),
        supplier_phone VARCHAR(50),
        total_amount INTEGER DEFAULT 0,
        total_tax INTEGER DEFAULT 0,
        total_sum INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 11. 견적 상세 품목 테이블
    await execute(`
      CREATE TABLE IF NOT EXISTS estimate_items (
        id ${pkType},
        estimate_id VARCHAR(50) NOT NULL,
        name VARCHAR(100) NOT NULL,
        unit VARCHAR(20) DEFAULT 'EA',
        type VARCHAR(20),
        qty ${numericType} DEFAULT 1,
        price INTEGER DEFAULT 0,
        amount INTEGER DEFAULT 0,
        tax INTEGER DEFAULT 0,
        total INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 12. 외상 수금/지급 누계액 관리 테이블
    await execute(`
      CREATE TABLE IF NOT EXISTS receivables_payments (
        id ${pkType},
        company_id INTEGER NOT NULL,
        partner_name VARCHAR(100) NOT NULL,
        recovered INTEGER DEFAULT 0,
        paid INTEGER DEFAULT 0,
        total_sales INTEGER DEFAULT NULL,
        total_purchases INTEGER DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_company_partner UNIQUE(company_id, partner_name)
      )
    `);

    // 13. 전역 인쇄 및 시스템 설정 테이블
    await execute(`
      CREATE TABLE IF NOT EXISTS settings (
        company_id INTEGER PRIMARY KEY,
        paper_size VARCHAR(20) DEFAULT 'A4',
        margin_top INTEGER DEFAULT 15,
        margin_left INTEGER DEFAULT 15,
        font_size INTEGER DEFAULT 10,
        logo_text VARCHAR(100) DEFAULT '[공급자 보관용]',
        hk_f2 VARCHAR(50) DEFAULT 'sales',
        hk_f4 VARCHAR(50) DEFAULT 'save',
        hk_f7 VARCHAR(50) DEFAULT 'purchase',
        hk_f8 VARCHAR(50) DEFAULT 'receivables',
        hk_f9 VARCHAR(50) DEFAULT 'excel-import',
        active_hq_id INTEGER DEFAULT NULL
      )
    `);

    console.log("데이터베이스 스키마(테이블 구조) 초기화가 완료되었습니다.");
  } catch (err) {
    console.error("데이터베이스 초기화 에러 발생:", err);
  }
}

module.exports = {
  query,
  execute,
  executeInsert,
  initDb,
  dbType
};
