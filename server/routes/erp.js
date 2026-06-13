const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/authMiddleware');

// 모든 ERP API 라우터는 JWT 세션 검증 필수
router.use(authMiddleware);

// ==========================================
// 1. 거래처 (Partners) API
// ==========================================

// 거래처 목록 조회
router.get('/partners', async (req, res) => {
  try {
    const partners = await db.query(
      "SELECT * FROM partners WHERE company_id = ? ORDER BY id DESC",
      [req.user.root_company_id]
    );
    res.json(partners);
  } catch (err) {
    console.error("Fetch Partners Error:", err);
    res.status(500).json({ error: "거래처 정보를 조회하지 못했습니다." });
  }
});

// 거래처 신규 등록
router.post('/partners', async (req, res) => {
  const { code, name, abbreviation, owner, bizNo, address, phone, type } = req.body;

  if (!code || !name || !type) {
    return res.status(400).json({ error: "거래처 코드, 상호명, 거래처 구분은 필수 입력 값입니다." });
  }

  try {
    // 동일 회사 내 코드 중복 조회
    const existing = await db.query(
      "SELECT id FROM partners WHERE company_id = ? AND code = ?",
      [req.user.root_company_id, code]
    );
    if (existing.length > 0) {
      return res.status(400).json({ error: "이미 등록된 거래처 코드입니다." });
    }

    const partnerId = await db.executeInsert(
      "INSERT INTO partners (company_id, code, name, abbreviation, owner, biz_no, address, phone, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [req.user.root_company_id, code, name, abbreviation || null, owner || '', bizNo || '', address || '', phone || '', type]
    );

    res.status(201).json({ success: true, id: partnerId, message: "거래처가 성공적으로 등록되었습니다." });
  } catch (err) {
    console.error("Create Partner Error:", err);
    res.status(500).json({ error: "거래처 등록에 실패했습니다." });
  }
});

// 거래처 수정
router.put('/partners/:id', async (req, res) => {
  const { code, name, abbreviation, owner, bizNo, address, phone, type } = req.body;
  const partnerId = req.params.id;

  try {
    // 소유권 검사
    const target = await db.query(
      "SELECT id FROM partners WHERE company_id = ? AND id = ?",
      [req.user.root_company_id, partnerId]
    );
    if (target.length === 0) {
      return res.status(404).json({ error: "해당 거래처 정보를 찾을 수 없거나 수정 권한이 없습니다." });
    }

    await db.execute(
      "UPDATE partners SET code = ?, name = ?, abbreviation = ?, owner = ?, biz_no = ?, address = ?, phone = ?, type = ? WHERE id = ?",
      [code, name, abbreviation || null, owner || '', bizNo || '', address || '', phone || '', type, partnerId]
    );

    res.json({ success: true, message: "거래처 정보가 수정되었습니다." });
  } catch (err) {
    console.error("Update Partner Error:", err);
    res.status(500).json({ error: "거래처 정보 수정에 실패했습니다." });
  }
});

// 거래처 삭제
router.delete('/partners/:id', async (req, res) => {
  const partnerId = req.params.id;

  try {
    const target = await db.query(
      "SELECT id FROM partners WHERE company_id = ? AND id = ?",
      [req.user.root_company_id, partnerId]
    );
    if (target.length === 0) {
      return res.status(404).json({ error: "해당 거래처 정보를 찾을 수 없거나 삭제 권한이 없습니다." });
    }

    await db.execute("DELETE FROM partners WHERE id = ?", [partnerId]);
    res.json({ success: true, message: "거래처가 삭제되었습니다." });
  } catch (err) {
    console.error("Delete Partner Error:", err);
    res.status(500).json({ error: "거래처 삭제에 실패했습니다." });
  }
});


// ==========================================
// 2. 기초 품목 (Products) API
// ==========================================

// 품목 목록 조회
router.get('/products', async (req, res) => {
  try {
    const products = await db.query(
      "SELECT * FROM products WHERE company_id = ? ORDER BY id DESC",
      [req.user.root_company_id]
    );
    res.json(products);
  } catch (err) {
    console.error("Fetch Products Error:", err);
    res.status(500).json({ error: "품목 목록을 불러오지 못했습니다." });
  }
});

// 품목 신규 등록
router.post('/products', async (req, res) => {
  const { code, name, category, abbreviation, unit, origin, purchasePrice, salesPrice, taxType, stock } = req.body;

  if (!code || !name) {
    return res.status(400).json({ error: "품목 코드와 품목명은 필수 입력 항목입니다." });
  }

  try {
    // 중복 코드 체크
    const existing = await db.query(
      "SELECT id FROM products WHERE company_id = ? AND code = ?",
      [req.user.root_company_id, code]
    );
    if (existing.length > 0) {
      return res.status(400).json({ error: "이미 존재하는 품목 코드입니다." });
    }

    const productId = await db.executeInsert(
      "INSERT INTO products (company_id, code, name, category, abbreviation, unit, origin, purchase_price, sales_price, tax_type, stock) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        req.user.root_company_id,
        code,
        name,
        category || null,
        abbreviation || null,
        unit || 'EA',
        origin || '국내산',
        parseInt(purchasePrice, 10) || 0,
        parseInt(salesPrice, 10) || 0,
        taxType || '과세',
        parseFloat(stock) || 0
      ]
    );

    res.status(201).json({ success: true, id: productId, message: "신규 상품이 등록되었습니다." });
  } catch (err) {
    console.error("Create Product Error:", err);
    res.status(500).json({ error: "상품 등록에 실패했습니다." });
  }
});

// 품목 정보 수정 (재고 조정 및 단가 갱신 포함)
router.put('/products/:id', async (req, res) => {
  const { code, name, category, abbreviation, unit, origin, purchasePrice, salesPrice, taxType, stock } = req.body;
  const productId = req.params.id;

  try {
    const target = await db.query(
      "SELECT id FROM products WHERE company_id = ? AND id = ?",
      [req.user.root_company_id, productId]
    );
    if (target.length === 0) {
      return res.status(404).json({ error: "해당 상품 정보를 찾을 수 없거나 수정 권한이 없습니다." });
    }

    await db.execute(
      "UPDATE products SET code = ?, name = ?, category = ?, abbreviation = ?, unit = ?, origin = ?, purchase_price = ?, sales_price = ?, tax_type = ?, stock = ? WHERE id = ?",
      [
        code,
        name,
        category || null,
        abbreviation || null,
        unit || 'EA',
        origin || '국내산',
        parseInt(purchasePrice, 10) || 0,
        parseInt(salesPrice, 10) || 0,
        taxType || '과세',
        parseFloat(stock) || 0,
        productId
      ]
    );

    res.json({ success: true, message: "상품 정보가 업데이트되었습니다." });
  } catch (err) {
    console.error("Update Product Error:", err);
    res.status(500).json({ error: "상품 수정에 실패했습니다." });
  }
});

// 품목 삭제
router.delete('/products/:id', async (req, res) => {
  const productId = req.params.id;

  try {
    const target = await db.query(
      "SELECT id FROM products WHERE company_id = ? AND id = ?",
      [req.user.root_company_id, productId]
    );
    if (target.length === 0) {
      return res.status(404).json({ error: "해당 상품 정보를 찾을 수 없거나 삭제 권한이 없습니다." });
    }

    await db.execute("DELETE FROM products WHERE id = ?", [productId]);
    res.json({ success: true, message: "상품이 삭제되었습니다." });
  } catch (err) {
    console.error("Delete Product Error:", err);
    res.status(500).json({ error: "상품 삭제에 실패했습니다." });
  }
});


// ==========================================
// 3. 전표 (Invoices & Items) API
// ==========================================

// 전표 목록 조회 (매출: 'sales', 매입: 'purchase' 필터)
router.get('/invoices', async (req, res) => {
  const { type } = req.query; // 'sales' or 'purchase'
  
  try {
    let invoices;
    if (type) {
      invoices = await db.query(
        "SELECT * FROM invoices WHERE company_id = ? AND type = ? ORDER BY date DESC, id DESC",
        [req.user.company_id, type]
      );
    } else {
      invoices = await db.query(
        "SELECT * FROM invoices WHERE company_id = ? ORDER BY date DESC, id DESC",
        [req.user.company_id]
      );
    }
    res.json(invoices);
  } catch (err) {
    console.error("Fetch Invoices Error:", err);
    res.status(500).json({ error: "전표 내역을 불러오지 못했습니다." });
  }
});

// 특정 전표 상세 내역 조회 (품목 세부 배열 포함)
router.get('/invoices/:id', async (req, res) => {
  const invoiceId = req.params.id;

  try {
    // 1. 메인 전표 로드
    const header = await db.query(
      "SELECT * FROM invoices WHERE company_id = ? AND id = ?",
      [req.user.company_id, invoiceId]
    );

    if (header.length === 0) {
      return res.status(404).json({ error: "요청하신 전표를 찾을 수 없거나 접근 권한이 없습니다." });
    }

    // 2. 전표 하위 품목 리스트 로드
    const items = await db.query(
      "SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id ASC",
      [invoiceId]
    );

    res.json({
      ...header[0],
      items: items.map(item => ({
        ...item,
        is_tax_applied: !!item.is_tax_applied // boolean 포맷 보정
      }))
    });
  } catch (err) {
    console.error("Fetch Invoice Detail Error:", err);
    res.status(500).json({ error: "전표 상세 내역 조회에 실패했습니다." });
  }
});

// 신규 전표 발행 및 품목 벌크 등록
router.post('/invoices', async (req, res) => {
  const { type, partnerName, date, totalAmount, totalTax, totalSum, status, items } = req.body;

  if (!type || !partnerName || !date || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "필수 입력 항목(구분, 거래처, 일자, 품목 배열)이 부족합니다." });
  }

  try {
    // 1. 메인 전표 기입
    const invoiceId = await db.executeInsert(
      "INSERT INTO invoices (company_id, type, partner_name, date, total_amount, total_tax, total_sum, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        req.user.company_id,
        type,
        partnerName,
        date,
        parseInt(totalAmount, 10) || 0,
        parseInt(totalTax, 10) || 0,
        parseInt(totalSum, 10) || 0,
        status || '청구(외상)'
      ]
    );

    // 2. 개별 품목들 순차 삽입
    for (const item of items) {
      await db.executeInsert(
        "INSERT INTO invoice_items (invoice_id, name, unit, origin, qty, price, amount, tax, total, is_tax_applied) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          invoiceId,
          item.name,
          item.unit || 'EA',
          item.origin || '국내산',
          parseFloat(item.qty) || 1,
          parseInt(item.price, 10) || 0,
          parseInt(item.amount, 10) || 0,
          parseInt(item.tax, 10) || 0,
          parseInt(item.total, 10) || 0,
          item.isTaxApplied ? 1 : 0
        ]
      );

      // 재고 증감 연동 (매입시 증가, 매출시 차감)
      const qtyChange = type === 'purchase' ? parseFloat(item.qty) : -parseFloat(item.qty);
      await db.execute(
        "UPDATE products SET stock = stock + ? WHERE company_id = ? AND name = ?",
        [qtyChange, req.user.root_company_id, item.name]
      );
    }

    res.status(201).json({ success: true, id: invoiceId, message: "전표가 정상 발행되었습니다." });
  } catch (err) {
    console.error("Create Invoice Error:", err);
    res.status(500).json({ error: "전표 발행 과정에서 에러가 발생했습니다." });
  }
});

// 기존 전표 수정 (과거 등록된 품목 재고 복구 -> 상세 품목 교체 -> 신규 재고 연동)
router.put('/invoices/:id', async (req, res) => {
  const invoiceId = req.params.id;
  const { partnerName, date, totalAmount, totalTax, totalSum, status, items } = req.body;

  if (!partnerName || !date || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "수정에 필요한 필수값이 누락되었습니다." });
  }

  try {
    // 1. 소유권 및 존재성 검증
    const original = await db.query(
      "SELECT * FROM invoices WHERE company_id = ? AND id = ?",
      [req.user.company_id, invoiceId]
    );
    if (original.length === 0) {
      return res.status(404).json({ error: "전표 정보를 찾을 수 없거나 수정 권한이 없습니다." });
    }
    const origType = original[0].type;

    // 2. 재고 원상 복구 (기존 전표에 의한 재고 변동분 반대 연산)
    const oldItems = await db.query("SELECT name, qty FROM invoice_items WHERE invoice_id = ?", [invoiceId]);
    for (const oldItem of oldItems) {
      const rollbackQty = origType === 'purchase' ? -parseFloat(oldItem.qty) : parseFloat(oldItem.qty);
      await db.execute(
        "UPDATE products SET stock = stock + ? WHERE company_id = ? AND name = ?",
        [rollbackQty, req.user.root_company_id, oldItem.name]
      );
    }

    // 3. 기존 상세 품목 삭제
    await db.execute("DELETE FROM invoice_items WHERE invoice_id = ?", [invoiceId]);

    // 4. 메인 전표 업데이트
    await db.execute(
      "UPDATE invoices SET partner_name = ?, date = ?, total_amount = ?, total_tax = ?, total_sum = ?, status = ? WHERE id = ?",
      [
        partnerName,
        date,
        parseInt(totalAmount, 10) || 0,
        parseInt(totalTax, 10) || 0,
        parseInt(totalSum, 10) || 0,
        status,
        invoiceId
      ]
    );

    // 5. 신규 품목 리스트 작성 및 신규 재고 동기화
    for (const item of items) {
      await db.executeInsert(
        "INSERT INTO invoice_items (invoice_id, name, unit, origin, qty, price, amount, tax, total, is_tax_applied) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          invoiceId,
          item.name,
          item.unit || 'EA',
          item.origin || '국내산',
          parseFloat(item.qty) || 1,
          parseInt(item.price, 10) || 0,
          parseInt(item.amount, 10) || 0,
          parseInt(item.tax, 10) || 0,
          parseInt(item.total, 10) || 0,
          item.isTaxApplied ? 1 : 0
        ]
      );

      const newQtyChange = origType === 'purchase' ? parseFloat(item.qty) : -parseFloat(item.qty);
      await db.execute(
        "UPDATE products SET stock = stock + ? WHERE company_id = ? AND name = ?",
        [newQtyChange, req.user.root_company_id, item.name]
      );
    }

    res.json({ success: true, message: "전표 수정이 성공적으로 처리되었습니다." });
  } catch (err) {
    console.error("Update Invoice Error:", err);
    res.status(500).json({ error: "전표 수정 중 에러가 발생했습니다." });
  }
});

// 전표 삭제 (상세 품목 재고 롤백 후 전체 삭제)
router.delete('/invoices/:id', async (req, res) => {
  const invoiceId = req.params.id;

  try {
    const original = await db.query(
      "SELECT * FROM invoices WHERE company_id = ? AND id = ?",
      [req.user.company_id, invoiceId]
    );
    if (original.length === 0) {
      return res.status(404).json({ error: "삭제할 전표가 없거나 삭제할 권한이 없습니다." });
    }
    const origType = original[0].type;

    // 1. 재고 롤백
    const oldItems = await db.query("SELECT name, qty FROM invoice_items WHERE invoice_id = ?", [invoiceId]);
    for (const oldItem of oldItems) {
      const rollbackQty = origType === 'purchase' ? -parseFloat(oldItem.qty) : parseFloat(oldItem.qty);
      await db.execute(
        "UPDATE products SET stock = stock + ? WHERE company_id = ? AND name = ?",
        [rollbackQty, req.user.root_company_id, oldItem.name]
      );
    }

    // 2. 상세 내역 삭제
    await db.execute("DELETE FROM invoice_items WHERE invoice_id = ?", [invoiceId]);

    // 3. 메인 전표 삭제
    await db.execute("DELETE FROM invoices WHERE id = ?", [invoiceId]);

    res.json({ success: true, message: "전표가 완전히 삭제되었습니다." });
  } catch (err) {
    console.error("Delete Invoice Error:", err);
    res.status(500).json({ error: "전표 삭제에 실패했습니다." });
  }
});

// 일일 품목확인서용 매출 평탄화 집계 조회 API
router.get('/invoices/daily-summary', async (req, res) => {
  const { date } = req.query;
  if (!date) {
    return res.status(400).json({ error: "조회할 날짜(date) 파라미터가 누락되었습니다." });
  }

  try {
    const summary = await db.query(`
      SELECT i.partner_name, ii.name AS item_name, ii.qty, ii.unit
      FROM invoices i
      JOIN invoice_items ii ON i.id = ii.invoice_id
      WHERE i.company_id = ? AND i.type = 'sales' AND i.date = ?
      ORDER BY i.partner_name ASC, ii.name ASC
    `, [req.user.company_id, date]);

    res.json(summary);
  } catch (err) {
    console.error("Daily summary aggregation error:", err);
    res.status(500).json({ error: "일일 품목 확인서 데이터를 집계하지 못했습니다." });
  }
});

// ==========================================
// 4. 본사(Headquarters) API
// ==========================================

router.get('/headquarters', async (req, res) => {
  try {
    const hqs = await db.query(
      "SELECT * FROM headquarters WHERE company_id = ? ORDER BY id ASC",
      [req.user.company_id]
    );
    res.json(hqs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "본사 정보를 조회하지 못했습니다." });
  }
});

router.post('/headquarters', async (req, res) => {
  const { name, regNo, owner, address, phone, business, stamp } = req.body;
  if (!name) return res.status(400).json({ error: "상호명은 필수입니다." });

  try {
    const id = await db.executeInsert(
      "INSERT INTO headquarters (company_id, name, reg_no, owner, address, phone, business, stamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [req.user.company_id, name, regNo || '', owner || '', address || '', phone || '', business || '', stamp || '']
    );
    res.status(201).json({ success: true, id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "본사 등록에 실패했습니다." });
  }
});

router.put('/headquarters/:id', async (req, res) => {
  const { name, regNo, owner, address, phone, business, stamp } = req.body;
  const hqId = req.params.id;

  try {
    // 권한 확인
    const target = await db.query("SELECT id FROM headquarters WHERE company_id = ? AND id = ?", [req.user.company_id, hqId]);
    if (target.length === 0) return res.status(404).json({ error: "정보를 찾을 수 없습니다." });

    await db.execute(
      "UPDATE headquarters SET name = ?, reg_no = ?, owner = ?, address = ?, phone = ?, business = ?, stamp = ? WHERE id = ?",
      [name, regNo || '', owner || '', address || '', phone || '', business || '', stamp || '', hqId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "본사 정보 수정에 실패했습니다." });
  }
});

router.delete('/headquarters/:id', async (req, res) => {
  const hqId = req.params.id;
  try {
    const target = await db.query("SELECT id FROM headquarters WHERE company_id = ? AND id = ?", [req.user.company_id, hqId]);
    if (target.length === 0) return res.status(404).json({ error: "정보를 찾을 수 없습니다." });

    await db.execute("DELETE FROM headquarters WHERE id = ?", [hqId]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "본사 삭제에 실패했습니다." });
  }
});

// ==========================================
// 5. 사원(Employees) API
// ==========================================

router.get('/employees', async (req, res) => {
  try {
    const emps = await db.query("SELECT * FROM employees WHERE company_id = ? ORDER BY id DESC", [req.user.company_id]);
    res.json(emps);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "사원 목록 조회 실패" });
  }
});

router.post('/employees', async (req, res) => {
  const { code, name, dept, position, phone } = req.body;
  if (!code || !name) return res.status(400).json({ error: "사원코드와 성명은 필수입니다." });

  try {
    const id = await db.executeInsert(
      "INSERT INTO employees (company_id, code, name, dept, position, phone) VALUES (?, ?, ?, ?, ?, ?)",
      [req.user.company_id, code, name, dept || '', position || '', phone || '']
    );
    res.status(201).json({ success: true, id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "사원 등록 실패" });
  }
});

router.delete('/employees/:id', async (req, res) => {
  try {
    const target = await db.query("SELECT id FROM employees WHERE company_id = ? AND id = ?", [req.user.company_id, req.params.id]);
    if (target.length === 0) return res.status(404).json({ error: "사원을 찾을 수 없습니다." });

    await db.execute("DELETE FROM employees WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "사원 삭제 실패" });
  }
});

// ==========================================
// 6. 금융 계좌(Banks) API
// ==========================================

router.get('/banks', async (req, res) => {
  try {
    const banks = await db.query("SELECT * FROM banks WHERE company_id = ? ORDER BY id DESC", [req.user.company_id]);
    res.json(banks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "은행 계좌 조회 실패" });
  }
});

router.post('/banks', async (req, res) => {
  const { name, accNo, owner, balance } = req.body;
  if (!name || !accNo) return res.status(400).json({ error: "은행명과 계좌번호는 필수입니다." });

  try {
    const id = await db.executeInsert(
      "INSERT INTO banks (company_id, name, acc_no, owner, balance) VALUES (?, ?, ?, ?, ?)",
      [req.user.company_id, name, accNo, owner || '', parseInt(balance, 10) || 0]
    );
    res.status(201).json({ success: true, id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "은행 계좌 등록 실패" });
  }
});

router.delete('/banks/:id', async (req, res) => {
  try {
    const target = await db.query("SELECT id FROM banks WHERE company_id = ? AND id = ?", [req.user.company_id, req.params.id]);
    if (target.length === 0) return res.status(404).json({ error: "계좌를 찾을 수 없습니다." });

    await db.execute("DELETE FROM banks WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "계좌 삭제 실패" });
  }
});

// ==========================================
// 7. 견적서(Estimates) API
// ==========================================

router.get('/estimates', async (req, res) => {
  try {
    const ests = await db.query("SELECT * FROM estimates WHERE company_id = ? ORDER BY date DESC, created_at DESC", [req.user.company_id]);
    res.json(ests);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "견적서 목록 조회 실패" });
  }
});

router.get('/estimates/:id', async (req, res) => {
  const estId = req.params.id;
  try {
    const header = await db.query("SELECT * FROM estimates WHERE company_id = ? AND id = ?", [req.user.company_id, estId]);
    if (header.length === 0) return res.status(404).json({ error: "견적서를 찾을 수 없습니다." });

    const items = await db.query("SELECT * FROM estimate_items WHERE estimate_id = ? ORDER BY id ASC", [estId]);
    res.json({
      ...header[0],
      items
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "견적서 상세 조회 실패" });
  }
});

router.post('/estimates', async (req, res) => {
  const { id, date, receiver, ref, receiverPhone, supplier, items, totalAmount, totalTax, totalSum } = req.body;
  if (!id || !receiver || !date || !items || items.length === 0) {
    return res.status(400).json({ error: "필수 항목 누락" });
  }

  try {
    // 중복 검사
    const existing = await db.query("SELECT id FROM estimates WHERE company_id = ? AND id = ?", [req.user.company_id, id]);
    if (existing.length > 0) return res.status(400).json({ error: "이미 존재하는 일련번호입니다." });

    await db.execute(
      "INSERT INTO estimates (id, company_id, date, receiver, ref, receiver_phone, supplier_name, supplier_bizno, supplier_owner, supplier_address, supplier_biztype, supplier_bizitem, supplier_manager, supplier_phone, total_amount, total_tax, total_sum) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        id, req.user.company_id, date, receiver, ref || '', receiverPhone || '',
        supplier.name || '', supplier.bizNo || '', supplier.owner || '', supplier.address || '',
        supplier.bizType || '', supplier.bizItem || '', supplier.manager || '', supplier.phone || '',
        parseInt(totalAmount, 10) || 0, parseInt(totalTax, 10) || 0, parseInt(totalSum, 10) || 0
      ]
    );

    for (const item of items) {
      await db.executeInsert(
        "INSERT INTO estimate_items (estimate_id, name, unit, type, qty, price, amount, tax, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [id, item.name, item.unit || 'EA', item.type || '벌', parseFloat(item.qty) || 1, parseInt(item.price, 10) || 0, parseInt(item.amount, 10) || 0, parseInt(item.tax, 10) || 0, parseInt(item.total, 10) || 0]
      );
    }

    res.status(201).json({ success: true, id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "견적서 등록 실패" });
  }
});

router.put('/estimates/:id', async (req, res) => {
  const estId = req.params.id;
  const { date, receiver, ref, receiverPhone, supplier, items, totalAmount, totalTax, totalSum } = req.body;

  try {
    const target = await db.query("SELECT id FROM estimates WHERE company_id = ? AND id = ?", [req.user.company_id, estId]);
    if (target.length === 0) return res.status(404).json({ error: "견적서를 찾을 수 없습니다." });

    await db.execute(
      "UPDATE estimates SET date = ?, receiver = ?, ref = ?, receiver_phone = ?, supplier_name = ?, supplier_bizno = ?, supplier_owner = ?, supplier_address = ?, supplier_biztype = ?, supplier_bizitem = ?, supplier_manager = ?, supplier_phone = ?, total_amount = ?, total_tax = ?, total_sum = ? WHERE id = ?",
      [
        date, receiver, ref || '', receiverPhone || '',
        supplier.name || '', supplier.bizNo || '', supplier.owner || '', supplier.address || '',
        supplier.bizType || '', supplier.bizItem || '', supplier.manager || '', supplier.phone || '',
        parseInt(totalAmount, 10) || 0, parseInt(totalTax, 10) || 0, parseInt(totalSum, 10) || 0,
        estId
      ]
    );

    // 하위 품목 전체 삭제 후 재작성
    await db.execute("DELETE FROM estimate_items WHERE estimate_id = ?", [estId]);

    for (const item of items) {
      await db.executeInsert(
        "INSERT INTO estimate_items (estimate_id, name, unit, type, qty, price, amount, tax, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [estId, item.name, item.unit || 'EA', item.type || '벌', parseFloat(item.qty) || 1, parseInt(item.price, 10) || 0, parseInt(item.amount, 10) || 0, parseInt(item.tax, 10) || 0, parseInt(item.total, 10) || 0]
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "견적서 수정 실패" });
  }
});

router.delete('/estimates/:id', async (req, res) => {
  const estId = req.params.id;
  try {
    const target = await db.query("SELECT id FROM estimates WHERE company_id = ? AND id = ?", [req.user.company_id, estId]);
    if (target.length === 0) return res.status(404).json({ error: "견적서를 찾을 수 없습니다." });

    await db.execute("DELETE FROM estimate_items WHERE estimate_id = ?", [estId]);
    await db.execute("DELETE FROM estimates WHERE id = ?", [estId]);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "견적서 삭제 실패" });
  }
});

// ==========================================
// 8. 외상대금 / 미수금(Receivables & Payments) API
// ==========================================

router.get('/receivables-payments', async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const rootCompanyId = req.user.root_company_id;

    // 1. 거래처 목록 가져오기 (공통 거래처 조회)
    const partners = await db.query("SELECT * FROM partners WHERE company_id = ?", [rootCompanyId]);

    // 2. 각 거래처의 외상(청구) 매출 합산
    const rawSales = await db.query(
      "SELECT partner_name, SUM(total_sum) as sum FROM invoices WHERE company_id = ? AND type = 'sales' AND status = '청구(외상)' GROUP BY partner_name",
      [companyId]
    );
    const salesMap = {};
    rawSales.forEach(s => {
      salesMap[s.partner_name] = parseInt(s.sum, 10) || 0;
    });

    // 3. 각 거래처의 외상(청구) 매입 합산
    const rawPurchases = await db.query(
      "SELECT partner_name, SUM(total_sum) as sum FROM invoices WHERE company_id = ? AND type = 'purchase' AND status = '청구(외상)' GROUP BY partner_name",
      [companyId]
    );
    const purchaseMap = {};
    rawPurchases.forEach(p => {
      purchaseMap[p.partner_name] = parseInt(p.sum, 10) || 0;
    });

    // 4. 수동 보정 및 수금/지급 원장 가져오기
    const manualData = await db.query("SELECT * FROM receivables_payments WHERE company_id = ?", [companyId]);
    const manualMap = {};
    manualData.forEach(m => {
      manualMap[m.partner_name] = m;
    });

    // 5. 거래처 정보와 융합해서 내려주기
    const result = partners.map(partner => {
      const pName = partner.name;
      const m = manualMap[pName] || { recovered: 0, paid: 0, total_sales: null, total_purchases: null };

      // 최종 외상매출액 = 수동 설정값(?), 없으면 자동 계산
      const totalSales = (m.total_sales !== null && m.total_sales !== undefined) ? m.total_sales : (salesMap[pName] || 0);
      const totalPurchases = (m.total_purchases !== null && m.total_purchases !== undefined) ? m.total_purchases : (purchaseMap[pName] || 0);

      return {
        partnerName: pName,
        partnerType: partner.type,
        totalSales,
        recovered: m.recovered || 0,
        receivableBalance: totalSales - (m.recovered || 0),
        totalPurchases,
        paid: m.paid || 0,
        payableBalance: totalPurchases - (m.paid || 0)
      };
    });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "외상 대장 조회에 실패했습니다." });
  }
});

// 수금/지급 등록 및 강제 원장 수정 통합 API
router.post('/receivables-payments', async (req, res) => {
  const { partnerName, mode, amount, totalSales, recovered, totalPurchases, paid } = req.body;
  const companyId = req.user.company_id;

  if (!partnerName) return res.status(400).json({ error: "거래처명은 필수입니다." });

  try {
    // 존재 여부 확인
    const existing = await db.query(
      "SELECT id, recovered, paid, total_sales, total_purchases FROM receivables_payments WHERE company_id = ? AND partner_name = ?",
      [companyId, partnerName]
    );

    if (existing.length === 0) {
      // 신규 인서트
      if (mode === 'recovered') {
        await db.execute(
          "INSERT INTO receivables_payments (company_id, partner_name, recovered, paid) VALUES (?, ?, ?, 0)",
          [companyId, partnerName, parseInt(amount, 10) || 0]
        );
      } else if (mode === 'paid') {
        await db.execute(
          "INSERT INTO receivables_payments (company_id, partner_name, recovered, paid) VALUES (?, ?, 0, ?)",
          [companyId, partnerName, parseInt(amount, 10) || 0]
        );
      } else if (mode === 'force') {
        await db.execute(
          "INSERT INTO receivables_payments (company_id, partner_name, total_sales, recovered, total_purchases, paid) VALUES (?, ?, ?, ?, ?, ?)",
          [
            companyId, partnerName,
            totalSales !== undefined ? parseInt(totalSales, 10) : null,
            parseInt(recovered, 10) || 0,
            totalPurchases !== undefined ? parseInt(totalPurchases, 10) : null,
            parseInt(paid, 10) || 0
          ]
        );
      }
    } else {
      // 업데이트
      const row = existing[0];
      if (mode === 'recovered') {
        const nextRecovered = (row.recovered || 0) + (parseInt(amount, 10) || 0);
        await db.execute(
          "UPDATE receivables_payments SET recovered = ? WHERE id = ?",
          [nextRecovered, row.id]
        );
      } else if (mode === 'paid') {
        const nextPaid = (row.paid || 0) + (parseInt(amount, 10) || 0);
        await db.execute(
          "UPDATE receivables_payments SET paid = ? WHERE id = ?",
          [nextPaid, row.id]
        );
      } else if (mode === 'force') {
        await db.execute(
          "UPDATE receivables_payments SET total_sales = ?, recovered = ?, total_purchases = ?, paid = ? WHERE id = ?",
          [
            totalSales !== undefined ? parseInt(totalSales, 10) : null,
            parseInt(recovered, 10) || 0,
            totalPurchases !== undefined ? parseInt(totalPurchases, 10) : null,
            parseInt(paid, 10) || 0,
            row.id
          ]
        );
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "외상 정보 갱신에 실패했습니다." });
  }
});

// ==========================================
// 9. 시스템 설정(Settings) API
// ==========================================

router.get('/settings', async (req, res) => {
  const companyId = req.user.company_id;
  try {
    const settings = await db.query("SELECT * FROM settings WHERE company_id = ?", [companyId]);
    if (settings.length === 0) {
      // 기본값 등록 후 리턴
      await db.execute("INSERT INTO settings (company_id) VALUES (?)", [companyId]);
      const newSettings = await db.query("SELECT * FROM settings WHERE company_id = ?", [companyId]);
      return res.json(newSettings[0]);
    }
    res.json(settings[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "설정 로드 실패" });
  }
});

router.post('/settings', async (req, res) => {
  const companyId = req.user.company_id;
  const { paperSize, marginTop, marginLeft, fontSize, logoText, hkF2, hkF4, hkF7, hkF8, hkF9, activeHqId, uploadedFilesJson, lastUpdated } = req.body;

  try {
    const existing = await db.query("SELECT company_id FROM settings WHERE company_id = ?", [companyId]);
    if (existing.length === 0) {
      await db.execute("INSERT INTO settings (company_id) VALUES (?)", [companyId]);
    }

    await db.execute(
      "UPDATE settings SET paper_size = ?, margin_top = ?, margin_left = ?, font_size = ?, logo_text = ?, hk_f2 = ?, hk_f4 = ?, hk_f7 = ?, hk_f8 = ?, hk_f9 = ?, active_hq_id = ?, uploaded_files_json = ?, last_updated = ? WHERE company_id = ?",
      [
        paperSize || 'A4',
        parseInt(marginTop, 10) || 15,
        parseInt(marginLeft, 10) || 15,
        parseInt(fontSize, 10) || 10,
        logoText || '[공급자 보관용]',
        hkF2 || 'sales',
        hkF4 || 'save',
        hkF7 || 'purchase',
        hkF8 || 'receivables',
        hkF9 || 'excel-import',
        activeHqId !== undefined ? parseInt(activeHqId, 10) : null,
        uploadedFilesJson || null,
        parseInt(lastUpdated, 10) || 0,
        companyId
      ]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "설정 저장 실패" });
  }
});

// ==========================================
// 10. 백업 및 초기화 API
// ==========================================

// --- 카멜케이스 변환 헬퍼 함수 ---
function toCamelCase(obj, type) {
  if (!obj) return null;
  if (type === 'partner') {
    return {
      id: obj.id,
      code: obj.code,
      name: obj.name,
      abbreviation: obj.abbreviation,
      owner: obj.owner,
      bizNo: obj.biz_no,
      address: obj.address,
      phone: obj.phone,
      type: obj.type
    };
  }
  if (type === 'product') {
    return {
      id: obj.id,
      code: obj.code,
      name: obj.name,
      category: obj.category,
      abbreviation: obj.abbreviation,
      unit: obj.unit,
      origin: obj.origin,
      purchasePrice: Number(obj.purchase_price || 0),
      salesPrice: Number(obj.sales_price || 0),
      taxType: obj.tax_type,
      stock: Number(obj.stock || 0)
    };
  }
  if (type === 'headquarters') {
    return {
      id: obj.id,
      name: obj.name,
      regNo: obj.reg_no,
      owner: obj.owner,
      address: obj.address,
      phone: obj.phone,
      business: obj.business,
      stamp: obj.stamp
    };
  }
  if (type === 'bank') {
    return {
      id: obj.id,
      name: obj.name,
      accNo: obj.acc_no,
      owner: obj.owner,
      balance: Number(obj.balance || 0)
    };
  }
  if (type === 'settings') {
    return {
      paperSize: obj.paper_size,
      marginTop: Number(obj.margin_top || 15),
      marginLeft: Number(obj.margin_left || 15),
      fontSize: Number(obj.font_size || 10),
      logoText: obj.logo_text,
      hkF2: obj.hk_f2,
      hkF4: obj.hk_f4,
      hkF7: obj.hk_f7,
      hkF8: obj.hk_f8,
      hkF9: obj.hk_f9,
      activeHqId: obj.active_hq_id,
      uploadedFilesJson: obj.uploaded_files_json,
      lastUpdated: Number(obj.last_updated || 0)
    };
  }
  return obj;
}

router.get('/backup/export', async (req, res) => {
  const companyId = req.user.company_id;
  try {
    const [partners, products, invoices, headquarters, employees, banks, estimates, receivablesPayments, settings] = await Promise.all([
      db.query("SELECT * FROM partners WHERE company_id = ?", [companyId]),
      db.query("SELECT * FROM products WHERE company_id = ?", [companyId]),
      db.query("SELECT * FROM invoices WHERE company_id = ?", [companyId]),
      db.query("SELECT * FROM headquarters WHERE company_id = ?", [companyId]),
      db.query("SELECT * FROM employees WHERE company_id = ?", [companyId]),
      db.query("SELECT * FROM banks WHERE company_id = ?", [companyId]),
      db.query("SELECT * FROM estimates WHERE company_id = ?", [companyId]),
      db.query("SELECT * FROM receivables_payments WHERE company_id = ?", [companyId]),
      db.query("SELECT * FROM settings WHERE company_id = ?", [companyId])
    ]);

    // 각 전표의 상세 품목
    const invoiceIds = invoices.map(i => i.id);
    let invoiceItems = [];
    if (invoiceIds.length > 0) {
      const inClause = invoiceIds.map(() => '?').join(',');
      invoiceItems = await db.query(`SELECT * FROM invoice_items WHERE invoice_id IN (${inClause})`, invoiceIds);
    }

    // 각 견적서의 상세 품목
    const estIds = estimates.map(e => e.id);
    let estItems = [];
    if (estIds.length > 0) {
      const inClause = estIds.map(() => '?').join(',');
      estItems = await db.query(`SELECT * FROM estimate_items WHERE estimate_id IN (${inClause})`, estIds);
    }

    const backupData = {
      version: "smart-erp-pro-v1",
      exportedAt: new Date().toISOString(),
      companyId,
      partners: partners.map(p => toCamelCase(p, 'partner')),
      products: products.map(p => toCamelCase(p, 'product')),
      invoices,
      invoiceItems,
      headquarters: headquarters.map(h => toCamelCase(h, 'headquarters')),
      employees,
      banks: banks.map(b => toCamelCase(b, 'bank')),
      estimates,
      estimateItems: estItems,
      receivablesPayments,
      settings: settings[0] ? toCamelCase(settings[0], 'settings') : null
    };

    res.json(backupData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "백업 데이터 추출 실패" });
  }
});

router.post('/backup/import', async (req, res) => {
  const companyId = req.user.company_id;
  const backup = req.body;

  if (!backup || backup.version !== "smart-erp-pro-v1") {
    return res.status(400).json({ error: "올바른 스마트 ERP 백업본 형식이 아닙니다." });
  }

  try {
    // 1. 기존 데이터 전체 삭제
    await db.execute("DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE company_id = ?)", [companyId]);
    await db.execute("DELETE FROM invoices WHERE company_id = ?", [companyId]);
    await db.execute("DELETE FROM estimate_items WHERE estimate_id IN (SELECT id FROM estimates WHERE company_id = ?)", [companyId]);
    await db.execute("DELETE FROM estimates WHERE company_id = ?", [companyId]);
    await db.execute("DELETE FROM partners WHERE company_id = ?", [companyId]);
    await db.execute("DELETE FROM products WHERE company_id = ?", [companyId]);
    await db.execute("DELETE FROM headquarters WHERE company_id = ?", [companyId]);
    await db.execute("DELETE FROM employees WHERE company_id = ?", [companyId]);
    await db.execute("DELETE FROM banks WHERE company_id = ?", [companyId]);
    await db.execute("DELETE FROM receivables_payments WHERE company_id = ?", [companyId]);
    await db.execute("DELETE FROM settings WHERE company_id = ?", [companyId]);

    // PostgreSQL 시퀀스 동기화 (Auto Increment 충돌 방지)
    const syncSequence = async (tableName) => {
      if (db.dbType === 'postgres') {
        try {
          await db.execute(`SELECT setval(pg_get_serial_sequence('${tableName}', 'id'), coalesce(max(id), 0) + 1, false) FROM ${tableName}`);
        } catch (e) {
          console.warn(`[WARN] Sequence sync failed for ${tableName}:`, e.message);
        }
      }
    };

    await syncSequence('headquarters');
    await syncSequence('partners');
    await syncSequence('products');
    await syncSequence('invoices');
    await syncSequence('invoice_items');
    await syncSequence('employees');
    await syncSequence('banks');
    await syncSequence('receivables_payments');
    await syncSequence('estimate_items');

    // 2. 순차 복원
    // 2.1 본사
    if (Array.isArray(backup.headquarters)) {
      for (const hq of backup.headquarters) {
        await db.execute(
          "INSERT INTO headquarters (company_id, name, reg_no, owner, address, phone, business, stamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [companyId, hq.name, hq.regNo || hq.reg_no || '', hq.owner || '', hq.address || '', hq.phone || '', hq.business || '', hq.stamp || '']
        );
      }
    }

    // 2.2 파트너
    if (Array.isArray(backup.partners)) {
      for (const p of backup.partners) {
        await db.execute(
          "INSERT INTO partners (company_id, code, name, abbreviation, owner, biz_no, address, phone, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [companyId, p.code, p.name, p.abbreviation || null, p.owner || '', p.bizNo || p.biz_no || '', p.address || '', p.phone || '', p.type]
        );
      }
    }

    // 2.3 상품
    if (Array.isArray(backup.products)) {
      for (const prod of backup.products) {
        await db.execute(
          "INSERT INTO products (company_id, code, name, category, abbreviation, unit, origin, purchase_price, sales_price, tax_type, stock) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [companyId, prod.code, prod.name, prod.category || null, prod.abbreviation || null, prod.unit || 'EA', prod.origin || '국내산', prod.purchasePrice || prod.purchase_price || 0, prod.salesPrice || prod.sales_price || 0, prod.taxType || prod.tax_type || '과세', prod.stock || 0]
        );
      }
    }

    // 2.4 전표 및 전표상세 (인보이스는 ID 매핑을 거쳐 자식 아이템에 외래키 바인딩)
    const invoiceIdMap = new Map();

    if (Array.isArray(backup.invoices)) {
      for (const inv of backup.invoices) {
        const insertedId = await db.executeInsert(
          "INSERT INTO invoices (company_id, type, partner_name, date, total_amount, total_tax, total_sum, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [companyId, inv.type, inv.partner_name, inv.date, inv.total_amount || 0, inv.total_tax || 0, inv.total_sum || 0, inv.status || '청구(외상)'],
          'id'
        );
        invoiceIdMap.set(inv.id, insertedId);
      }
    }
    if (Array.isArray(backup.invoiceItems)) {
      for (const item of backup.invoiceItems) {
        let intInvoiceId = invoiceIdMap.get(item.invoice_id);
        if (!intInvoiceId) {
          intInvoiceId = Number(item.invoice_id) || 0;
        }

        await db.execute(
          "INSERT INTO invoice_items (invoice_id, name, unit, origin, qty, price, amount, tax, total, is_tax_applied) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [intInvoiceId, item.name, item.unit || 'EA', item.origin || '국내산', item.qty || 1, item.price || 0, item.amount || 0, item.tax || 0, item.total || 0, item.is_tax_applied ? 1 : 0]
        );
      }
    }

    // 2.5 사원
    if (Array.isArray(backup.employees)) {
      for (const emp of backup.employees) {
        await db.execute(
          "INSERT INTO employees (company_id, code, name, dept, position, phone) VALUES (?, ?, ?, ?, ?, ?)",
          [companyId, emp.code, emp.name, emp.dept || '', emp.position || '', emp.phone || '']
        );
      }
    }

    // 2.6 은행
    if (Array.isArray(backup.banks)) {
      for (const bank of backup.banks) {
        await db.execute(
          "INSERT INTO banks (company_id, name, acc_no, owner, balance) VALUES (?, ?, ?, ?, ?)",
          [companyId, bank.name, bank.accNo || bank.acc_no, bank.owner || '', bank.balance || 0]
        );
      }
    }

    // 2.7 견적서 및 상세
    if (Array.isArray(backup.estimates)) {
      for (const est of backup.estimates) {
        await db.execute(
          "INSERT INTO estimates (id, company_id, date, receiver, ref, receiver_phone, supplier_name, supplier_bizno, supplier_owner, supplier_address, supplier_biztype, supplier_bizitem, supplier_manager, supplier_phone, total_amount, total_tax, total_sum) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [
            est.id, companyId, est.date, est.receiver, est.ref || '', est.receiver_phone || '',
            est.supplier_name || '', est.supplier_bizno || '', est.supplier_owner || '', est.supplier_address || '',
            est.supplier_biztype || '', est.supplier_bizitem || '', est.supplier_manager || '', est.supplier_phone || '',
            est.total_amount || 0, est.total_tax || 0, est.total_sum || 0
          ]
        );
      }
    }
    if (Array.isArray(backup.estimateItems)) {
      for (const item of backup.estimateItems) {
        await db.execute(
          "INSERT INTO estimate_items (estimate_id, name, unit, type, qty, price, amount, tax, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [item.estimate_id, item.name, item.unit || 'EA', item.type || '벌', item.qty || 1, item.price || 0, item.amount || 0, item.tax || 0, item.total || 0]
        );
      }
    }

    // 2.8 외상
    if (Array.isArray(backup.receivablesPayments)) {
      for (const rp of backup.receivablesPayments) {
        await db.execute(
          "INSERT INTO receivables_payments (company_id, partner_name, recovered, paid, total_sales, total_purchases) VALUES (?, ?, ?, ?, ?, ?)",
          [companyId, rp.partner_name, rp.recovered || 0, rp.paid || 0, rp.total_sales, rp.total_purchases]
        );
      }
    }

    // 2.9 설정
    if (backup.settings) {
      const s = backup.settings;
      await db.execute(
        "INSERT INTO settings (company_id, paper_size, margin_top, margin_left, font_size, logo_text, hk_f2, hk_f4, hk_f7, hk_f8, hk_f9, active_hq_id, uploaded_files_json, last_updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [companyId, s.paperSize || s.paper_size || 'A4', s.marginTop || s.margin_top || 15, s.marginLeft || s.margin_left || 15, s.fontSize || s.font_size || 10, s.logoText || s.logo_text || '[공급자 보관용]', s.hkF2 || s.hk_f2 || 'sales', s.hkF4 || s.hk_f4 || 'save', s.hkF7 || s.hk_f7 || 'purchase', s.hkF8 || s.hk_f8 || 'receivables', s.hkF9 || s.hk_f9 || 'excel-import', s.activeHqId || s.active_hq_id, s.uploadedFilesJson || s.uploaded_files_json || null, s.lastUpdated || s.last_updated || 0]
      );
    }

    res.json({ success: true, message: "백업 데이터로부터 성공적으로 복구되었습니다." });
  } catch (err) {
    console.error("Backup import error:", err);
    res.status(500).json({ error: "백업 복구에 실패했습니다. 사유: " + err.message });
  }
});

router.post('/backup/reset', async (req, res) => {
  const companyId = req.user.company_id;
  try {
    await db.execute("DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE company_id = ?)", [companyId]);
    await db.execute("DELETE FROM invoices WHERE company_id = ?", [companyId]);
    await db.execute("DELETE FROM estimate_items WHERE estimate_id IN (SELECT id FROM estimates WHERE company_id = ?)", [companyId]);
    await db.execute("DELETE FROM estimates WHERE company_id = ?", [companyId]);
    await db.execute("DELETE FROM partners WHERE company_id = ?", [companyId]);
    await db.execute("DELETE FROM products WHERE company_id = ?", [companyId]);
    await db.execute("DELETE FROM headquarters WHERE company_id = ?", [companyId]);
    await db.execute("DELETE FROM employees WHERE company_id = ?", [companyId]);
    await db.execute("DELETE FROM banks WHERE company_id = ?", [companyId]);
    await db.execute("DELETE FROM receivables_payments WHERE company_id = ?", [companyId]);
    await db.execute("DELETE FROM settings WHERE company_id = ?", [companyId]);

    // 기본 본사 1개 자동 생성
    const defaultHqId = await db.executeInsert(
      "INSERT INTO headquarters (company_id, name, reg_no, owner, address, phone, business) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [companyId, "기본 본사 사업소", "000-00-00000", "대표자명", "서울특별시", "02-1234-5678", "도소매 / 농수산물"]
    );

    // 기본 설정 등록
    await db.execute(
      "INSERT INTO settings (company_id, active_hq_id) VALUES (?, ?)",
      [companyId, defaultHqId]
    );

    res.json({ success: true, message: "ERP 데이터가 완전 초기화되고 기본 환경설정이 준비되었습니다." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "데이터 초기화 실패" });
  }
});

// ==========================================
// 11. 지사(Branches) 관리 API
// ==========================================

// 현재 본사 그룹 하위의 지사 목록 조회
router.get('/branches', async (req, res) => {
  try {
    const rootCompanyId = req.user.root_company_id;
    const branches = await db.query(
      "SELECT id, name, created_at FROM companies WHERE parent_id = ? ORDER BY id ASC",
      [rootCompanyId]
    );
    res.json(branches);
  } catch (err) {
    console.error("Fetch branches error:", err);
    res.status(500).json({ error: "지사 목록을 조회하지 못했습니다." });
  }
});

// 신규 지사 등록
router.post('/branches', async (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: "지사 상호명을 입력해 주세요." });
  }

  // 본사 권한 확인 (현재 활성화된 회사ID가 본사ID와 같아야 함)
  if (req.user.company_id !== req.user.root_company_id) {
    return res.status(403).json({ error: "지사 생성 권한은 본사 계정에게만 부여됩니다." });
  }

  try {
    const rootCompanyId = req.user.root_company_id;
    // 동일 이름 지사 중복 체크
    const existing = await db.query(
      "SELECT id FROM companies WHERE parent_id = ? AND name = ?",
      [rootCompanyId, name]
    );
    if (existing.length > 0) {
      return res.status(400).json({ error: "이미 동일한 이름으로 등록된 지사가 존재합니다." });
    }

    // 신규 지사 등록
    const branchId = await db.executeInsert(
      "INSERT INTO companies (name, parent_id) VALUES (?, ?)",
      [name, rootCompanyId]
    );

    // 신규 지사의 기본 본사(사업소) 1개 자동 생성
    const defaultHqId = await db.executeInsert(
      "INSERT INTO headquarters (company_id, name, reg_no, owner, address, phone, business) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [branchId, name + " 사업소", "000-00-00000", "대표자명", "서울특별시", "02-1234-5678", "도소매 / 농수산물"]
    );

    // 신규 지사의 기본 설정 등록
    await db.execute(
      "INSERT INTO settings (company_id, active_hq_id) VALUES (?, ?)",
      [branchId, defaultHqId]
    );

    res.status(201).json({ success: true, id: branchId, message: "지사 등록 및 기본 설정이 준비되었습니다." });
  } catch (err) {
    console.error("Create branch error:", err);
    res.status(500).json({ error: "지사 등록 과정에서 서버 오류가 발생했습니다." });
  }
});

module.exports = router;
