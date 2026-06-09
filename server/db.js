const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

let dbType = 'sqlite';
let pgPool = null;
let sqliteDb = null;
let sqlite3 = null;

// Render 등 클라우드 환경에서 DATABASE_URL이 주어지면 PostgreSQL 사용
// (대시보드 조작이 번거로우실 경우를 대비해 사용자의 PostgreSQL 주소를 직접 바인딩합니다.)
const connectionString = process.env.DATABASE_URL || "postgresql://smart_erp_db_2o7b_user:OZRggEHCo0AECVqpgzNwGA3Nzx992jTn@dpg-d8j4sjmq1p3s73fbgrjg-a/smart_erp_db_2o7b";

function connectDatabase() {
  if (connectionString) {
    dbType = 'postgres';
    pgPool = new Pool({
      connectionString: connectionString,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 2000 // 2초 이내 연결 안 되면 실패로 간주
    });
    console.log("PostgreSQL 데이터베이스 연결을 준비합니다.");
  } else {
    fallbackToSqlite();
  }
}

function fallbackToSqlite(err) {
  if (err) {
    console.warn("PostgreSQL 연결 실패. SQLite로 폴백합니다. 에러:", err.message || err);
  }
  dbType = 'sqlite';
  try {
    if (!sqlite3) {
      sqlite3 = require('sqlite3').verbose();
    }
    const dbPath = path.resolve(__dirname, '../db.sqlite');
    sqliteDb = new sqlite3.Database(dbPath);
    console.log("SQLite 데이터베이스가 연결되었습니다: " + dbPath);
  } catch (e) {
    console.error("SQLite3 모듈 로드 실패 (의존성 없음). Mock 데이터 모드로 전환하여 기동을 유지합니다. 에러:", e.message);
    dbType = 'mock';
  }
}

connectDatabase();

// 공용 쿼리 실행 헬퍼 (SELECT용)
function query(sql, params = []) {
  if (dbType === 'postgres') {
    let index = 1;
    const pgSql = sql.replace(/\?/g, () => `$${index++}`);
    return pgPool.query(pgSql, params).then(res => res.rows);
  } else if (dbType === 'sqlite') {
    return new Promise((resolve, reject) => {
      sqliteDb.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  } else {
    console.warn("Mock 모드 쿼리 실행:", sql);
    return Promise.resolve([]);
  }
}

// 공용 수정/삭제 헬퍼 (UPDATE, DELETE용)
function execute(sql, params = []) {
  if (dbType === 'postgres') {
    let index = 1;
    const pgSql = sql.replace(/\?/g, () => `$${index++}`);
    return pgPool.query(pgSql, params).then(res => res.rowCount);
  } else if (dbType === 'sqlite') {
    return new Promise((resolve, reject) => {
      sqliteDb.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  } else {
    console.warn("Mock 모드 실행:", sql);
    return Promise.resolve(0);
  }
}

// 공용 삽입 헬퍼 (INSERT 후 생성된 PK id 반환용)
async function executeInsert(sql, params = [], idColumnName = 'id') {
  if (dbType === 'postgres') {
    let index = 1;
    const pgSql = sql.replace(/\?/g, () => `$${index++}`) + ` RETURNING ${idColumnName}`;
    const res = await pgPool.query(pgSql, params);
    return res.rows[0][idColumnName];
  } else if (dbType === 'sqlite') {
    return new Promise((resolve, reject) => {
      sqliteDb.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });
  } else {
    console.warn("Mock 모드 삽입:", sql);
    return Promise.resolve(1);
  }
}

// 테이블 자동 생성 (DDL 초기화)
async function initDb() {
  if (dbType === 'postgres') {
    try {
      await pgPool.query("SELECT 1");
      console.log("PostgreSQL 데이터베이스가 활성화 상태입니다.");
    } catch (err) {
      fallbackToSqlite(err);
    }
  }

  if (dbType === 'mock') {
    console.warn("Mock 데이터베이스 상태이므로 스키마 초기화를 생략합니다.");
    return;
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

    // 7. 본사 정보 테이블
    await execute(`
      CREATE TABLE IF NOT EXISTS headquarters (
        id ${pkType},
        company_id INTEGER NOT NULL,
        name VARCHAR(100) NOT NULL,
        reg_no VARCHAR(50) NOT NULL,
        owner VARCHAR(50) NOT NULL,
        address ${textType},
        phone VARCHAR(50),
        business VARCHAR(100),
        stamp ${textType},
        is_active BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 8. 사원 정보 테이블
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
        owner VARCHAR(50),
        balance INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 10. 견적서 테이블
    await execute(`
      CREATE TABLE IF NOT EXISTS estimates (
        id ${pkType},
        company_id INTEGER NOT NULL,
        serial_no VARCHAR(50) NOT NULL,
        date VARCHAR(20) NOT NULL,
        receiver VARCHAR(100) NOT NULL,
        ref VARCHAR(100),
        receiver_phone VARCHAR(50),
        supplier_name VARCHAR(100),
        supplier_biz_no VARCHAR(50),
        supplier_owner VARCHAR(50),
        supplier_address ${textType},
        supplier_biz_type VARCHAR(100),
        supplier_biz_item VARCHAR(100),
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
        estimate_id INTEGER NOT NULL,
        name VARCHAR(100) NOT NULL,
        unit VARCHAR(50),
        type VARCHAR(50),
        qty ${numericType} DEFAULT 1,
        price INTEGER DEFAULT 0,
        amount INTEGER DEFAULT 0,
        tax INTEGER DEFAULT 0,
        total INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 12. 외상/미수금 보정 테이블
    await execute(`
      CREATE TABLE IF NOT EXISTS receivables_payments (
        id ${pkType},
        company_id INTEGER NOT NULL,
        partner_name VARCHAR(100) NOT NULL,
        total_sales_adjust INTEGER,
        total_purchases_adjust INTEGER,
        recovered INTEGER DEFAULT 0,
        paid INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 13. ERP 설정 테이블
    await execute(`
      CREATE TABLE IF NOT EXISTS erp_settings (
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
        print_seal_image ${textType} DEFAULT ''
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
