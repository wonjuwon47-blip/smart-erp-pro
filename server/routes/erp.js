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

// ==========================================
// 4. ERP 설정 (Settings) API
// ==========================================

// 설정 조회
router.get('/settings', async (req, res) => {
  try {
    const settings = await db.query(
      "SELECT * FROM erp_settings WHERE company_id = ?",
      [req.user.company_id]
    );
    if (settings.length === 0) {
      // 기본값 반환 및 최초 인서트
      await db.execute(
        "INSERT INTO erp_settings (company_id) VALUES (?)",
        [req.user.company_id]
      );
      const newSettings = await db.query(
        "SELECT * FROM erp_settings WHERE company_id = ?",
        [req.user.company_id]
      );
      return res.json(newSettings[0]);
    }
    res.json(settings[0]);
  } catch (err) {
    console.error("Fetch Settings Error:", err);
    res.status(500).json({ error: "설정 정보를 불러오지 못했습니다." });
  }
});

// 설정 수정 (Upsert 형태)
router.put('/settings', async (req, res) => {
  const { paperSize, marginTop, marginLeft, fontSize, logoText, hkF2, hkF4, hkF7, hkF8, hkF9, printSealImage } = req.body;
  
  try {
    const existing = await db.query(
      "SELECT company_id FROM erp_settings WHERE company_id = ?",
      [req.user.company_id]
    );

    if (existing.length === 0) {
      await db.execute(
        `INSERT INTO erp_settings (company_id, paper_size, margin_top, margin_left, font_size, logo_text, hk_f2, hk_f4, hk_f7, hk_f8, hk_f9, print_seal_image) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.user.company_id,
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
          printSealImage || ''
        ]
      );
    } else {
      await db.execute(
        `UPDATE erp_settings SET 
          paper_size = ?, margin_top = ?, margin_left = ?, font_size = ?, logo_text = ?, 
          hk_f2 = ?, hk_f4 = ?, hk_f7 = ?, hk_f8 = ?, hk_f9 = ?, print_seal_image = ?
         WHERE company_id = ?`,
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
          printSealImage || '',
          req.user.company_id
        ]
      );
    }
    res.json({ success: true, message: "설정이 성공적으로 저장되었습니다." });
  } catch (err) {
    console.error("Save Settings Error:", err);
    res.status(500).json({ error: "설정 저장에 실패했습니다." });
  }
});


// ==========================================
// 5. 본사 정보 (Headquarters) API
// ==========================================

// 본사 리스트 조회
router.get('/headquarters', async (req, res) => {
  try {
    const list = await db.query(
      "SELECT * FROM headquarters WHERE company_id = ? ORDER BY id ASC",
      [req.user.company_id]
    );
    res.json(list);
  } catch (err) {
    console.error("Fetch Headquarters Error:", err);
    res.status(500).json({ error: "본사 정보를 불러오지 못했습니다." });
  }
});

// 본사 등록
router.post('/headquarters', async (req, res) => {
  const { name, regNo, owner, address, phone, business, stamp } = req.body;
  if (!name || !regNo || !owner) {
    return res.status(400).json({ error: "상호, 등록번호, 대표자명은 필수 값입니다." });
  }

  try {
    // 최초 등록이면 활성화로 설정
    const existing = await db.query(
      "SELECT id FROM headquarters WHERE company_id = ?",
      [req.user.company_id]
    );
    const isActive = existing.length === 0 ? 1 : 0;

    const id = await db.executeInsert(
      `INSERT INTO headquarters (company_id, name, reg_no, owner, address, phone, business, stamp, is_active) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.company_id, name, regNo, owner, address || '', phone || '', business || '', stamp || '', isActive]
    );
    res.status(201).json({ success: true, id, message: "본사 정보가 성공적으로 등록되었습니다." });
  } catch (err) {
    console.error("Create Headquarter Error:", err);
    res.status(500).json({ error: "본사 등록에 실패했습니다." });
  }
});

// 본사 정보 수정
router.put('/headquarters/:id', async (req, res) => {
  const hqId = req.params.id;
  const { name, regNo, owner, address, phone, business, stamp } = req.body;

  try {
    const check = await db.query(
      "SELECT id FROM headquarters WHERE company_id = ? AND id = ?",
      [req.user.company_id, hqId]
    );
    if (check.length === 0) {
      return res.status(404).json({ error: "해당 본사 정보를 찾을 수 없습니다." });
    }

    await db.execute(
      `UPDATE headquarters SET name = ?, reg_no = ?, owner = ?, address = ?, phone = ?, business = ?, stamp = ?
       WHERE id = ?`,
      [name, regNo, owner, address || '', phone || '', business || '', stamp || '', hqId]
    );
    res.json({ success: true, message: "본사 정보가 수정되었습니다." });
  } catch (err) {
    console.error("Update Headquarter Error:", err);
    res.status(500).json({ error: "본사 정보 수정에 실패했습니다." });
  }
});

// 활성 본사 지정
router.post('/headquarters/:id/active', async (req, res) => {
  const hqId = req.params.id;

  try {
    const check = await db.query(
      "SELECT id FROM headquarters WHERE company_id = ? AND id = ?",
      [req.user.company_id, hqId]
    );
    if (check.length === 0) {
      return res.status(404).json({ error: "해당 본사 정보를 찾을 수 없습니다." });
    }

    // 다른 본사들은 비활성화
    await db.execute(
      "UPDATE headquarters SET is_active = FALSE WHERE company_id = ?",
      [req.user.company_id]
    );
    // 선택된 본사 활성화
    await db.execute(
      "UPDATE headquarters SET is_active = TRUE WHERE id = ?",
      [hqId]
    );

    res.json({ success: true, message: "활성 본사 지정이 완료되었습니다." });
  } catch (err) {
    console.error("Active Headquarter Error:", err);
    res.status(500).json({ error: "활성 본사 지정에 실패했습니다." });
  }
});

// 본사 삭제
router.delete('/headquarters/:id', async (req, res) => {
  const hqId = req.params.id;

  try {
    const check = await db.query(
      "SELECT id, is_active FROM headquarters WHERE company_id = ? AND id = ?",
      [req.user.company_id, hqId]
    );
    if (check.length === 0) {
      return res.status(404).json({ error: "해당 본사 정보를 찾을 수 없습니다." });
    }

    const count = await db.query(
      "SELECT count(*) as cnt FROM headquarters WHERE company_id = ?",
      [req.user.company_id]
    );
    if (parseInt(count[0].cnt, 10) <= 1) {
      return res.status(400).json({ error: "최소 1개 이상의 본사 정보가 등록되어 있어야 합니다." });
    }

    await db.execute("DELETE FROM headquarters WHERE id = ?", [hqId]);

    // 삭제된 본사가 활성이었을 경우, 다른 본사 중 하나를 활성화
    if (check[0].is_active) {
      const rest = await db.query(
        "SELECT id FROM headquarters WHERE company_id = ? ORDER BY id ASC LIMIT 1",
        [req.user.company_id]
      );
      if (rest.length > 0) {
        await db.execute("UPDATE headquarters SET is_active = TRUE WHERE id = ?", [rest[0].id]);
      }
    }

    res.json({ success: true, message: "본사 정보가 삭제되었습니다." });
  } catch (err) {
    console.error("Delete Headquarter Error:", err);
    res.status(500).json({ error: "본사 삭제에 실패했습니다." });
  }
});


// ==========================================
// 6. 사원 관리 (Employees) API
// ==========================================

// 사원 리스트 조회
router.get('/employees', async (req, res) => {
  try {
    const list = await db.query(
      "SELECT * FROM employees WHERE company_id = ? ORDER BY id DESC",
      [req.user.company_id]
    );
    res.json(list);
  } catch (err) {
    console.error("Fetch Employees Error:", err);
    res.status(500).json({ error: "사원 목록을 불러오지 못했습니다." });
  }
});

// 사원 신규 등록
router.post('/employees', async (req, res) => {
  const { code, name, dept, position, phone } = req.body;
  if (!code || !name) {
    return res.status(400).json({ error: "사원코드와 성명은 필수값입니다." });
  }

  try {
    const existing = await db.query(
      "SELECT id FROM employees WHERE company_id = ? AND code = ?",
      [req.user.company_id, code]
    );
    if (existing.length > 0) {
      return res.status(400).json({ error: "이미 존재하는 사원코드입니다." });
    }

    const id = await db.executeInsert(
      "INSERT INTO employees (company_id, code, name, dept, position, phone) VALUES (?, ?, ?, ?, ?, ?)",
      [req.user.company_id, code, name, dept || '', position || '', phone || '']
    );
    res.status(201).json({ success: true, id, message: "사원 등록이 완료되었습니다." });
  } catch (err) {
    console.error("Create Employee Error:", err);
    res.status(500).json({ error: "사원 등록에 실패했습니다." });
  }
});

// 사원 삭제
router.delete('/employees/:id', async (req, res) => {
  const empId = req.params.id;

  try {
    const check = await db.query(
      "SELECT id FROM employees WHERE company_id = ? AND id = ?",
      [req.user.company_id, empId]
    );
    if (check.length === 0) {
      return res.status(404).json({ error: "해당 사원 정보를 찾을 수 없습니다." });
    }

    await db.execute("DELETE FROM employees WHERE id = ?", [empId]);
    res.json({ success: true, message: "사원 정보가 삭제되었습니다." });
  } catch (err) {
    console.error("Delete Employee Error:", err);
    res.status(500).json({ error: "사원 삭제에 실패했습니다." });
  }
});


// ==========================================
// 7. 계좌 관리 (Banks) API
// ==========================================

// 계좌 리스트 조회
router.get('/banks', async (req, res) => {
  try {
    const list = await db.query(
      "SELECT * FROM banks WHERE company_id = ? ORDER BY id ASC",
      [req.user.company_id]
    );
    res.json(list);
  } catch (err) {
    console.error("Fetch Banks Error:", err);
    res.status(500).json({ error: "금융 계좌 정보를 불러오지 못했습니다." });
  }
});

// 계좌 등록
router.post('/banks', async (req, res) => {
  const { name, accNo, owner, balance } = req.body;
  if (!name || !accNo) {
    return res.status(400).json({ error: "은행명과 계좌번호는 필수 값입니다." });
  }

  try {
    const id = await db.executeInsert(
      "INSERT INTO banks (company_id, name, acc_no, owner, balance) VALUES (?, ?, ?, ?, ?)",
      [req.user.company_id, name, accNo, owner || '', parseInt(balance, 10) || 0]
    );
    res.status(201).json({ success: true, id, message: "계좌 등록이 완료되었습니다." });
  } catch (err) {
    console.error("Create Bank Error:", err);
    res.status(500).json({ error: "계좌 등록에 실패했습니다." });
  }
});

// 계좌 삭제
router.delete('/banks/:id', async (req, res) => {
  const bankId = req.params.id;

  try {
    const check = await db.query(
      "SELECT id FROM banks WHERE company_id = ? AND id = ?",
      [req.user.company_id, bankId]
    );
    if (check.length === 0) {
      return res.status(404).json({ error: "계좌 정보를 찾을 수 없습니다." });
    }

    await db.execute("DELETE FROM banks WHERE id = ?", [bankId]);
    res.json({ success: true, message: "계좌 정보가 삭제되었습니다." });
  } catch (err) {
    console.error("Delete Bank Error:", err);
    res.status(500).json({ error: "계좌 삭제에 실패했습니다." });
  }
});


// ==========================================
// 8. 견적서 (Estimates) API
// ==========================================

// 견적서 리스트 조회
router.get('/estimates', async (req, res) => {
  try {
    const list = await db.query(
      "SELECT * FROM estimates WHERE company_id = ? ORDER BY date DESC, id DESC",
      [req.user.company_id]
    );
    res.json(list);
  } catch (err) {
    console.error("Fetch Estimates Error:", err);
    res.status(500).json({ error: "견적서 목록을 불러오지 못했습니다." });
  }
});

// 특정 견적서 및 상세 품목 조회
router.get('/estimates/:id', async (req, res) => {
  const estId = req.params.id;

  try {
    const header = await db.query(
      "SELECT * FROM estimates WHERE company_id = ? AND id = ?",
      [req.user.company_id, estId]
    );
    if (header.length === 0) {
      return res.status(404).json({ error: "견적서를 찾을 수 없거나 열람 권한이 없습니다." });
    }

    const items = await db.query(
      "SELECT * FROM estimate_items WHERE estimate_id = ? ORDER BY id ASC",
      [estId]
    );

    res.json({
      ...header[0],
      items
    });
  } catch (err) {
    console.error("Fetch Estimate Detail Error:", err);
    res.status(500).json({ error: "견적서 상세를 불러오는 데 실패했습니다." });
  }
});

// 견적서 발행 및 벌크 품목 인서트
router.post('/estimates', async (req, res) => {
  const { serialNo, date, receiver, ref, receiverPhone, supplier, items, totalAmount, totalTax, totalSum } = req.body;
  if (!serialNo || !receiver || !date || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "필수 정보(일련번호, 수신인, 일자, 품목 배열)가 누락되었습니다." });
  }

  try {
    // 1. 견적서 헤더 등록
    const estId = await db.executeInsert(
      `INSERT INTO estimates (
        company_id, serial_no, date, receiver, ref, receiver_phone, 
        supplier_name, supplier_biz_no, supplier_owner, supplier_address, 
        supplier_biz_type, supplier_biz_item, supplier_manager, supplier_phone,
        total_amount, total_tax, total_sum
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.company_id,
        serialNo,
        date,
        receiver,
        ref || '',
        receiverPhone || '',
        supplier.name || '',
        supplier.bizNo || '',
        supplier.owner || '',
        supplier.address || '',
        supplier.bizType || '',
        supplier.bizItem || '',
        supplier.manager || '',
        supplier.phone || '',
        parseInt(totalAmount, 10) || 0,
        parseInt(totalTax, 10) || 0,
        parseInt(totalSum, 10) || 0
      ]
    );

    // 2. 상세 품목 등록
    for (const item of items) {
      await db.executeInsert(
        "INSERT INTO estimate_items (estimate_id, name, unit, type, qty, price, amount, tax, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          estId,
          item.name,
          item.unit || '',
          item.type || '',
          parseFloat(item.qty) || 1,
          parseInt(item.price, 10) || 0,
          parseInt(item.amount, 10) || 0,
          parseInt(item.tax, 10) || 0,
          parseInt(item.total, 10) || 0
        ]
      );
    }

    res.status(201).json({ success: true, id: estId, message: "견적서가 정상 발행되었습니다." });
  } catch (err) {
    console.error("Create Estimate Error:", err);
    res.status(500).json({ error: "견적서 발행에 실패했습니다." });
  }
});

// 견적서 수정
router.put('/estimates/:id', async (req, res) => {
  const estId = req.params.id;
  const { serialNo, date, receiver, ref, receiverPhone, supplier, items, totalAmount, totalTax, totalSum } = req.body;

  try {
    const check = await db.query(
      "SELECT id FROM estimates WHERE company_id = ? AND id = ?",
      [req.user.company_id, estId]
    );
    if (check.length === 0) {
      return res.status(404).json({ error: "수정할 견적서가 없거나 접근 권한이 없습니다." });
    }

    // 1. 기존 품목 삭제
    await db.execute("DELETE FROM estimate_items WHERE estimate_id = ?", [estId]);

    // 2. 견적 헤더 업데이트
    await db.execute(
      `UPDATE estimates SET 
        serial_no = ?, date = ?, receiver = ?, ref = ?, receiver_phone = ?, 
        supplier_name = ?, supplier_biz_no = ?, supplier_owner = ?, supplier_address = ?, 
        supplier_biz_type = ?, supplier_biz_item = ?, supplier_manager = ?, supplier_phone = ?,
        total_amount = ?, total_tax = ?, total_sum = ?
       WHERE id = ?`,
      [
        serialNo,
        date,
        receiver,
        ref || '',
        receiverPhone || '',
        supplier.name || '',
        supplier.bizNo || '',
        supplier.owner || '',
        supplier.address || '',
        supplier.bizType || '',
        supplier.bizItem || '',
        supplier.manager || '',
        supplier.phone || '',
        parseInt(totalAmount, 10) || 0,
        parseInt(totalTax, 10) || 0,
        parseInt(totalSum, 10) || 0,
        estId
      ]
    );

    // 3. 신규 품목 인서트
    for (const item of items) {
      await db.executeInsert(
        "INSERT INTO estimate_items (estimate_id, name, unit, type, qty, price, amount, tax, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          estId,
          item.name,
          item.unit || '',
          item.type || '',
          parseFloat(item.qty) || 1,
          parseInt(item.price, 10) || 0,
          parseInt(item.amount, 10) || 0,
          parseInt(item.tax, 10) || 0,
          parseInt(item.total, 10) || 0
        ]
      );
    }

    res.json({ success: true, message: "견적서가 정상적으로 수정되었습니다." });
  } catch (err) {
    console.error("Update Estimate Error:", err);
    res.status(500).json({ error: "견적서 수정 중 에러가 발생했습니다." });
  }
});

// 견적서 삭제
router.delete('/estimates/:id', async (req, res) => {
  const estId = req.params.id;

  try {
    const check = await db.query(
      "SELECT id FROM estimates WHERE company_id = ? AND id = ?",
      [req.user.company_id, estId]
    );
    if (check.length === 0) {
      return res.status(404).json({ error: "삭제할 견적서가 없거나 접근 권한이 없습니다." });
    }

    // 상세 품목 먼저 삭제
    await db.execute("DELETE FROM estimate_items WHERE estimate_id = ?", [estId]);
    // 헤더 삭제
    await db.execute("DELETE FROM estimates WHERE id = ?", [estId]);

    res.json({ success: true, message: "견적서가 영구 삭제되었습니다." });
  } catch (err) {
    console.error("Delete Estimate Error:", err);
    res.status(500).json({ error: "견적서 삭제에 실패했습니다." });
  }
});


// ==========================================
// 9. 외상대금 및 미수금 수금/지급장 (Receivables & Payables) API
// ==========================================

// 거래처별 실시간 외상 현황 집계
router.get('/receivables', async (req, res) => {
  try {
    // 1. 외상 매출 전표 실시간 합산 (status = '청구(외상)' 인 매출전표 합계)
    const salesSums = await db.query(
      `SELECT partner_name, SUM(total_sum) as total 
       FROM invoices 
       WHERE company_id = ? AND type = 'sales' AND status = '청구(외상)' 
       GROUP BY partner_name`,
      [req.user.company_id]
    );

    // 2. 외상 매입 전표 실시간 합산 (status = '청구(외상)' 인 매입전표 합계)
    const purchaseSums = await db.query(
      `SELECT partner_name, SUM(total_sum) as total 
       FROM invoices 
       WHERE company_id = ? AND type = 'purchase' AND status = '청구(외상)' 
       GROUP BY partner_name`,
      [req.user.company_id]
    );

    // 3. 수동 보정 및 수금/지급 누계액 테이블 로드
    const adjusts = await db.query(
      "SELECT * FROM receivables_payments WHERE company_id = ?",
      [req.user.company_id]
    );

    // 4. 모든 거래처 정보와 조합하여 최종 결과 빌드
    const partners = await db.query(
      "SELECT name, type FROM partners WHERE company_id = ? ORDER BY name ASC",
      [req.user.company_id]
    );

    const result = partners.map(p => {
      const adj = adjusts.find(a => a.partner_name === p.name) || {
        total_sales_adjust: null,
        total_purchases_adjust: null,
        recovered: 0,
        paid: 0
      };

      const sSum = salesSums.find(s => s.partner_name === p.name);
      const pSum = purchaseSums.find(s => s.partner_name === p.name);

      // 매출 외상 대금: 수동 보정값이 있으면 보정값을 쓰고 없으면 전표 실시간 합계를 씀
      const totalSales = adj.total_sales_adjust !== null && adj.total_sales_adjust !== undefined
        ? adj.total_sales_adjust
        : (sSum ? parseInt(sSum.total, 10) : 0);

      // 매입 외상 대금: 수동 보정값이 있으면 보정값을 쓰고 없으면 전표 실시간 합계를 씀
      const totalPurchases = adj.total_purchases_adjust !== null && adj.total_purchases_adjust !== undefined
        ? adj.total_purchases_adjust
        : (pSum ? parseInt(pSum.total, 10) : 0);

      return {
        partnerName: p.name,
        partnerType: p.type,
        totalSales,
        totalPurchases,
        recovered: adj.recovered || 0,
        paid: adj.paid || 0,
        receivableBalance: totalSales - (adj.recovered || 0), // 미수금 잔액
        payableBalance: totalPurchases - (adj.paid || 0) // 미지급금 잔액
      };
    });

    res.json(result);
  } catch (err) {
    console.error("Fetch Receivables Error:", err);
    res.status(500).json({ error: "외상 대금 정보를 집계하지 못했습니다." });
  }
});

// 추가 수금액 또는 지급액 등록
router.post('/receivables/pay-receive', async (req, res) => {
  const { partnerName, mode, amount } = req.body; // mode: 'recovered' (수금) 또는 'paid' (지급)
  const val = parseInt(amount, 10);

  if (!partnerName || !mode || isNaN(val) || val <= 0) {
    return res.status(400).json({ error: "올바른 거래처명, 구분, 수납액을 입력해 주세요." });
  }

  try {
    const existing = await db.query(
      "SELECT id FROM receivables_payments WHERE company_id = ? AND partner_name = ?",
      [req.user.company_id, partnerName]
    );

    if (existing.length === 0) {
      const rec = mode === 'recovered' ? val : 0;
      const pd = mode === 'paid' ? val : 0;
      await db.executeInsert(
        "INSERT INTO receivables_payments (company_id, partner_name, total_sales_adjust, total_purchases_adjust, recovered, paid) VALUES (?, ?, NULL, NULL, ?, ?)",
        [req.user.company_id, partnerName, rec, pd]
      );
    } else {
      const field = mode === 'recovered' ? 'recovered' : 'paid';
      await db.execute(
        `UPDATE receivables_payments SET ${field} = ${field} + ? WHERE company_id = ? AND partner_name = ?`,
        [val, req.user.company_id, partnerName]
      );
    }

    res.json({ success: true, message: "수금/지급 정보가 성공적으로 반영되었습니다." });
  } catch (err) {
    console.error("Pay Receive Money Error:", err);
    res.status(500).json({ error: "대금 수납 처리에 실패했습니다." });
  }
});

// 모든 외상 수치 수동 보정 설정
router.post('/receivables/adjust', async (req, res) => {
  const { partnerName, totalSales, recovered, totalPurchases, paid } = req.body;

  if (!partnerName) {
    return res.status(400).json({ error: "보정할 거래처명이 누락되었습니다." });
  }

  try {
    const existing = await db.query(
      "SELECT id FROM receivables_payments WHERE company_id = ? AND partner_name = ?",
      [req.user.company_id, partnerName]
    );

    const sVal = totalSales === "" || totalSales === null || totalSales === undefined ? null : parseInt(totalSales, 10);
    const pVal = totalPurchases === "" || totalPurchases === null || totalPurchases === undefined ? null : parseInt(totalPurchases, 10);
    const rVal = parseInt(recovered, 10) || 0;
    const pdVal = parseInt(paid, 10) || 0;

    if (existing.length === 0) {
      await db.executeInsert(
        `INSERT INTO receivables_payments (company_id, partner_name, total_sales_adjust, total_purchases_adjust, recovered, paid) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [req.user.company_id, partnerName, sVal, pVal, rVal, pdVal]
      );
    } else {
      await db.execute(
        `UPDATE receivables_payments SET 
          total_sales_adjust = ?, total_purchases_adjust = ?, recovered = ?, paid = ?
         WHERE company_id = ? AND partner_name = ?`,
        [sVal, pVal, rVal, pdVal, req.user.company_id, partnerName]
      );
    }

    res.json({ success: true, message: "원장 보정 설정이 저장되었습니다." });
  } catch (err) {
    console.error("Adjust Receivable Error:", err);
    res.status(500).json({ error: "원장 보정 설정 과정에서 오류가 발생했습니다." });
  }
});

// ==========================================
// 10. 시스템 데이터 백업 / 복구 / 리셋 API
// ==========================================

// 데이터베이스 전체 데이터 익스포트 (백업용)
router.get('/data-export', async (req, res) => {
  try {
    const cid = req.user.company_id;
    const [hqs, emps, banks, partners, products, invoices, estimates, settings, adjusts] = await Promise.all([
      db.query("SELECT * FROM headquarters WHERE company_id = ? ORDER BY id ASC", [cid]),
      db.query("SELECT * FROM employees WHERE company_id = ? ORDER BY id DESC", [cid]),
      db.query("SELECT * FROM banks WHERE company_id = ? ORDER BY id ASC", [cid]),
      db.query("SELECT * FROM partners WHERE company_id = ? ORDER BY id DESC", [cid]),
      db.query("SELECT * FROM products WHERE company_id = ? ORDER BY id DESC", [cid]),
      db.query("SELECT * FROM invoices WHERE company_id = ? ORDER BY id DESC", [cid]),
      db.query("SELECT * FROM estimates WHERE company_id = ? ORDER BY id DESC", [cid]),
      db.query("SELECT * FROM erp_settings WHERE company_id = ?", [cid]),
      db.query("SELECT * FROM receivables_payments WHERE company_id = ?", [cid])
    ]);

    // 전표 및 견적서의 상세 품목 일괄 조회 후 조합
    for (const inv of invoices) {
      inv.items = await db.query("SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id ASC", [inv.id]);
    }
    for (const est of estimates) {
      est.items = await db.query("SELECT * FROM estimate_items WHERE estimate_id = ? ORDER BY id ASC", [est.id]);
    }

    res.json({
      headquarters: hqs,
      employees: emps,
      banks: banks,
      partners: partners,
      products: products,
      invoices: invoices,
      estimates: estimates,
      settings: settings[0] || null,
      receivablesPayments: adjusts
    });
  } catch (err) {
    console.error("Backup Export Error:", err);
    res.status(500).json({ error: "데이터 백업 내보내기에 실패했습니다." });
  }
});

// 데이터베이스 초기화
router.post('/data-reset', async (req, res) => {
  const cid = req.user.company_id;
  try {
    // 소유 전표 상세 및 견적 상세 품목 삭제
    await db.execute(
      `DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE company_id = ?)`,
      [cid]
    );
    await db.execute(
      `DELETE FROM estimate_items WHERE estimate_id IN (SELECT id FROM estimates WHERE company_id = ?)`,
      [cid]
    );

    // 해당 회사의 모든 개별 테이블 데이터 전체 삭제
    await db.execute("DELETE FROM invoices WHERE company_id = ?", [cid]);
    await db.execute("DELETE FROM estimates WHERE company_id = ?", [cid]);
    await db.execute("DELETE FROM partners WHERE company_id = ?", [cid]);
    await db.execute("DELETE FROM products WHERE company_id = ?", [cid]);
    await db.execute("DELETE FROM employees WHERE company_id = ?", [cid]);
    await db.execute("DELETE FROM banks WHERE company_id = ?", [cid]);
    await db.execute("DELETE FROM headquarters WHERE company_id = ?", [cid]);
    await db.execute("DELETE FROM receivables_payments WHERE company_id = ?", [cid]);
    await db.execute("DELETE FROM erp_settings WHERE company_id = ?", [cid]);

    // 기본 본사 1개 자동 재생성
    const newHqId = await db.executeInsert(
      `INSERT INTO headquarters (company_id, name, reg_no, owner, address, phone, business, stamp, is_active) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE)`,
      [cid, "우리회사 본사", "000-00-00000", "대표자명", "회사 주소 입력", "02-000-0000", "업태 / 종목", ""]
    );

    // 기본 설정 생성
    await db.execute(
      "INSERT INTO erp_settings (company_id) VALUES (?)",
      [cid]
    );

    res.json({ success: true, message: "시스템 데이터가 성공적으로 전체 초기화되었습니다." });
  } catch (err) {
    console.error("DB Reset Error:", err);
    res.status(500).json({ error: "시스템 초기화 도중 오류가 발생했습니다." });
  }
});

// 데이터베이스 전체 데이터 복원 (가져오기)
router.post('/data-import', async (req, res) => {
  const cid = req.user.company_id;
  const backup = req.body;

  if (!backup || !backup.headquarters) {
    return res.status(400).json({ error: "유효한 백업본 데이터 구조가 아닙니다." });
  }

  try {
    // 1. 기존 데이터 전체 삭제 (Reset)
    await db.execute(`DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE company_id = ?)`, [cid]);
    await db.execute(`DELETE FROM estimate_items WHERE estimate_id IN (SELECT id FROM estimates WHERE company_id = ?)`, [cid]);
    await db.execute("DELETE FROM invoices WHERE company_id = ?", [cid]);
    await db.execute("DELETE FROM estimates WHERE company_id = ?", [cid]);
    await db.execute("DELETE FROM partners WHERE company_id = ?", [cid]);
    await db.execute("DELETE FROM products WHERE company_id = ?", [cid]);
    await db.execute("DELETE FROM employees WHERE company_id = ?", [cid]);
    await db.execute("DELETE FROM banks WHERE company_id = ?", [cid]);
    await db.execute("DELETE FROM headquarters WHERE company_id = ?", [cid]);
    await db.execute("DELETE FROM receivables_payments WHERE company_id = ?", [cid]);
    await db.execute("DELETE FROM erp_settings WHERE company_id = ?", [cid]);

    // 2. 본사 복원
    for (const hq of backup.headquarters || []) {
      await db.executeInsert(
        `INSERT INTO headquarters (company_id, name, reg_no, owner, address, phone, business, stamp, is_active) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [cid, hq.name, hq.reg_no, hq.owner, hq.address || '', hq.phone || '', hq.business || '', hq.stamp || '', hq.is_active ? 1 : 0]
      );
    }

    // 3. 사원 복원
    for (const emp of backup.employees || []) {
      await db.executeInsert(
        "INSERT INTO employees (company_id, code, name, dept, position, phone) VALUES (?, ?, ?, ?, ?, ?)",
        [cid, emp.code, emp.name, emp.dept || '', emp.position || '', emp.phone || '']
      );
    }

    // 4. 계좌 복원
    for (const bank of backup.banks || []) {
      await db.executeInsert(
        "INSERT INTO banks (company_id, name, acc_no, owner, balance) VALUES (?, ?, ?, ?, ?)",
        [cid, bank.name, bank.acc_no, bank.owner || '', bank.balance || 0]
      );
    }

    // 5. 거래처 복원
    for (const part of backup.partners || []) {
      await db.executeInsert(
        "INSERT INTO partners (company_id, code, name, owner, biz_no, address, phone, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [cid, part.code, part.name, part.owner || '', part.biz_no || '', part.address || '', part.phone || '', part.type]
      );
    }

    // 6. 상품 복원
    for (const prod of backup.products || []) {
      await db.executeInsert(
        "INSERT INTO products (company_id, code, name, unit, origin, purchase_price, sales_price, tax_type, stock) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [cid, prod.code, prod.name, prod.unit || 'EA', prod.origin || '국내산', prod.purchase_price || 0, prod.sales_price || 0, prod.tax_type || '과세', prod.stock || 0]
      );
    }

    // 7. 설정 복원
    if (backup.settings) {
      const s = backup.settings;
      await db.execute(
        `INSERT INTO erp_settings (company_id, paper_size, margin_top, margin_left, font_size, logo_text, hk_f2, hk_f4, hk_f7, hk_f8, hk_f9, print_seal_image) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [cid, s.paper_size || 'A4', s.margin_top || 15, s.margin_left || 15, s.font_size || 10, s.logo_text || '[공급자 보관용]', s.hk_f2 || 'sales', s.hk_f4 || 'save', s.hk_f7 || 'purchase', s.hk_f8 || 'receivables', s.hk_f9 || 'excel-import', s.print_seal_image || '']
      );
    } else {
      await db.execute("INSERT INTO erp_settings (company_id) VALUES (?)", [cid]);
    }

    // 8. 외상 대장 복원
    for (const pay of backup.receivablesPayments || []) {
      await db.executeInsert(
        `INSERT INTO receivables_payments (company_id, partner_name, total_sales_adjust, total_purchases_adjust, recovered, paid) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [cid, pay.partner_name, pay.total_sales_adjust, pay.total_purchases_adjust, pay.recovered || 0, pay.paid || 0]
      );
    }

    // 9. 전표 및 상세 품목 복원 (전표 id 꼬임 방지를 위해 순차 매핑)
    for (const inv of backup.invoices || []) {
      const newInvId = await db.executeInsert(
        `INSERT INTO invoices (company_id, type, partner_name, date, total_amount, total_tax, total_sum, status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [cid, inv.type, inv.partner_name, inv.date, inv.total_amount || 0, inv.total_tax || 0, inv.total_sum || 0, inv.status]
      );

      for (const item of inv.items || []) {
        await db.executeInsert(
          `INSERT INTO invoice_items (invoice_id, name, unit, origin, qty, price, amount, tax, total, is_tax_applied) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [newInvId, item.name, item.unit || 'EA', item.origin || '국내산', item.qty || 1, item.price || 0, item.amount || 0, item.tax || 0, item.total || 0, item.is_tax_applied ? 1 : 0]
        );
      }
    }

    // 10. 견적서 및 상세 복원
    for (const est of backup.estimates || []) {
      const newEstId = await db.executeInsert(
        `INSERT INTO estimates (
          company_id, serial_no, date, receiver, ref, receiver_phone, 
          supplier_name, supplier_biz_no, supplier_owner, supplier_address, 
          supplier_biz_type, supplier_biz_item, supplier_manager, supplier_phone,
          total_amount, total_tax, total_sum
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [cid, est.serial_no, est.date, est.receiver, est.ref || '', est.receiver_phone || '', est.supplier_name || '', est.supplier_biz_no || '', est.supplier_owner || '', est.supplier_address || '', est.supplier_biz_type || '', est.supplier_biz_item || '', est.supplier_manager || '', est.supplier_phone || '', est.total_amount || 0, est.total_tax || 0, est.total_sum || 0]
      );

      for (const item of est.items || []) {
        await db.executeInsert(
          `INSERT INTO estimate_items (estimate_id, name, unit, type, qty, price, amount, tax, total) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [newEstId, item.name, item.unit || '', item.type || '', item.qty || 1, item.price || 0, item.amount || 0, item.tax || 0, item.total || 0]
        );
      }
    }

    res.json({ success: true, message: "백업 데이터로부터 전체 복구에 성공하였습니다." });
  } catch (err) {
    console.error("Data Import Error:", err);
    res.status(500).json({ error: "데이터 복구 과정에서 치명적 에러가 발생했습니다." });
  }
});

module.exports = router;
