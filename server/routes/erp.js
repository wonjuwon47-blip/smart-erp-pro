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
      [req.user.company_id]
    );
    res.json(partners);
  } catch (err) {
    console.error("Fetch Partners Error:", err);
    res.status(500).json({ error: "거래처 정보를 조회하지 못했습니다." });
  }
});

// 거래처 신규 등록
router.post('/partners', async (req, res) => {
  const { code, name, owner, bizNo, address, phone, type } = req.body;

  if (!code || !name || !type) {
    return res.status(400).json({ error: "거래처 코드, 상호명, 거래처 구분은 필수 입력 값입니다." });
  }

  try {
    // 동일 회사 내 코드 중복 조회
    const existing = await db.query(
      "SELECT id FROM partners WHERE company_id = ? AND code = ?",
      [req.user.company_id, code]
    );
    if (existing.length > 0) {
      return res.status(400).json({ error: "이미 등록된 거래처 코드입니다." });
    }

    const partnerId = await db.executeInsert(
      "INSERT INTO partners (company_id, code, name, owner, biz_no, address, phone, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [req.user.company_id, code, name, owner || '', bizNo || '', address || '', phone || '', type]
    );

    res.status(201).json({ success: true, id: partnerId, message: "거래처가 성공적으로 등록되었습니다." });
  } catch (err) {
    console.error("Create Partner Error:", err);
    res.status(500).json({ error: "거래처 등록에 실패했습니다." });
  }
});

// 거래처 수정
router.put('/partners/:id', async (req, res) => {
  const { code, name, owner, bizNo, address, phone, type } = req.body;
  const partnerId = req.params.id;

  try {
    // 소유권 검사
    const target = await db.query(
      "SELECT id FROM partners WHERE company_id = ? AND id = ?",
      [req.user.company_id, partnerId]
    );
    if (target.length === 0) {
      return res.status(404).json({ error: "해당 거래처 정보를 찾을 수 없거나 수정 권한이 없습니다." });
    }

    await db.execute(
      "UPDATE partners SET code = ?, name = ?, owner = ?, biz_no = ?, address = ?, phone = ?, type = ? WHERE id = ?",
      [code, name, owner || '', bizNo || '', address || '', phone || '', type, partnerId]
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
      [req.user.company_id, partnerId]
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
      [req.user.company_id]
    );
    res.json(products);
  } catch (err) {
    console.error("Fetch Products Error:", err);
    res.status(500).json({ error: "품목 목록을 불러오지 못했습니다." });
  }
});

// 품목 신규 등록
router.post('/products', async (req, res) => {
  const { code, name, unit, origin, purchasePrice, salesPrice, taxType, stock } = req.body;

  if (!code || !name) {
    return res.status(400).json({ error: "품목 코드와 품목명은 필수 입력 항목입니다." });
  }

  try {
    // 중복 코드 체크
    const existing = await db.query(
      "SELECT id FROM products WHERE company_id = ? AND code = ?",
      [req.user.company_id, code]
    );
    if (existing.length > 0) {
      return res.status(400).json({ error: "이미 존재하는 품목 코드입니다." });
    }

    const productId = await db.executeInsert(
      "INSERT INTO products (company_id, code, name, unit, origin, purchase_price, sales_price, tax_type, stock) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        req.user.company_id,
        code,
        name,
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
  const { code, name, unit, origin, purchasePrice, salesPrice, taxType, stock } = req.body;
  const productId = req.params.id;

  try {
    const target = await db.query(
      "SELECT id FROM products WHERE company_id = ? AND id = ?",
      [req.user.company_id, productId]
    );
    if (target.length === 0) {
      return res.status(404).json({ error: "해당 상품 정보를 찾을 수 없거나 수정 권한이 없습니다." });
    }

    await db.execute(
      "UPDATE products SET code = ?, name = ?, unit = ?, origin = ?, purchase_price = ?, sales_price = ?, tax_type = ?, stock = ? WHERE id = ?",
      [
        code,
        name,
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
      [req.user.company_id, productId]
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
        [qtyChange, req.user.company_id, item.name]
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
        [rollbackQty, req.user.company_id, oldItem.name]
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
        [newQtyChange, req.user.company_id, item.name]
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
        [rollbackQty, req.user.company_id, oldItem.name]
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

module.exports = router;
