import React, { useState, useEffect } from 'react';
import { invoiceApi, partnerApi } from '../services/api';
import { Plus, Trash2, Printer, Search, Save, X } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function SalesManagement({ products, partners, invoices, onDataChange }) {
  const [salesCart, setSalesCart] = useState([]);
  const [partnerSearch, setPartnerSearch] = useState('');
  const [selectedPartner, setSelectedPartner] = useState('');
  const [salesDate, setSalesDate] = useState(new Date().toISOString().substring(0, 10));
  const [status, setStatus] = useState('청구(외상)');
  const [invoiceList, setInvoiceList] = useState([]);
  
  // 엑셀 업로드 관련 상태
  const [uploadedExcelRows, setUploadedExcelRows] = useState(null);
  const [excelStatusText, setExcelStatusText] = useState('');
  const [excelStatusColor, setExcelStatusColor] = useState('var(--text-muted)');
  
  // 신규 품목 추가 입력 필드
  const [selectedProduct, setSelectedProduct] = useState('');
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState(0);

  // 전표 상세 조회용 상태
  const [selectedInvoiceDetail, setSelectedInvoiceDetail] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const formatNumber = (num) => {
    return new Intl.NumberFormat('ko-KR').format(num || 0);
  };

  // --- 엑셀 단위 및 품명 정규화 (1000g/kg -> kg) ---
  const sanitizeExcelUnitAndName = (str) => {
    if (str === null || str === undefined) return "";
    let s = String(str);
    s = s.replace(/1000g\s*[\/\-\(]?\s*1?kg\s*\)?/gi, 'kg');
    s = s.replace(/1000g/gi, 'kg');
    return s;
  };

  // 엑셀에서 추출한 날짜를 'YYYY-MM-DD'로 안전하게 변환
  const formatDateString = (val) => {
    if (val === null || val === undefined || val === "") return "";
    if (val instanceof Date) {
      const adjustedDate = new Date(val.getTime() + (12 * 60 * 60 * 1000));
      return adjustedDate.toISOString().substring(0, 10);
    }
    if (typeof val === 'number') {
      let serial = val;
      if (serial > 60) serial -= 1;
      const date = new Date((serial - 25568) * 86400 * 1000);
      const adjustedDate = new Date(date.getTime() + (12 * 60 * 60 * 1000));
      return adjustedDate.toISOString().substring(0, 10);
    }
    if (typeof val === 'string') {
      let cleaned = val.replace(/[^0-9]/g, '').trim();
      if (cleaned.length === 8) {
        return `${cleaned.substring(0, 4)}-${cleaned.substring(4, 6)}-${cleaned.substring(6, 8)}`;
      }
      if (cleaned.length === 6) {
        return `20${cleaned.substring(0, 2)}-${cleaned.substring(2, 4)}-${cleaned.substring(4, 6)}`;
      }
      const parts = val.split(/[\/\-\.]/);
      if (parts.length === 3) {
        let year = parts[0].trim();
        let month = parts[1].trim().padStart(2, '0');
        let day = parts[2].trim().padStart(2, '0');
        if (year.length === 2) year = '20' + year;
        if (year.length === 4 && month.length === 2 && day.length === 2) {
          return `${year}-${month}-${day}`;
        }
      }
      const match = val.replace(/[\/\.]/g, '-').trim();
      if (match.match(/^\d{4}-\d{2}-\d{2}/)) {
        return match.substring(0, 10);
      }
    }
    return String(val).trim();
  };

  // 엑셀 로우 객체에서 다양한 키 바리에이션을 허용하여 데이터를 가져오는 헬퍼
  const getExcelRowValue = (row, possibleKeys) => {
    const keys = Object.keys(row);
    for (const key of keys) {
      const cleanKey = key.replace(/\s+/g, '').toLowerCase();
      for (const pk of possibleKeys) {
        const cleanPk = pk.replace(/\s+/g, '').toLowerCase();
        if (cleanKey === cleanPk || cleanKey.includes(cleanPk)) {
          return row[key];
        }
      }
    }
    return null;
  };

  // 엑셀 품목을 장바구니로 로드
  const loadItemsFromExcel = (force = false) => {
    if (!uploadedExcelRows) return;
    if (salesCart.length > 0 && !force) {
      return;
    }
    if (salesCart.length > 0 && force) {
      if (!window.confirm("현재 작성 중인 매출 카트 품목이 존재합니다. 엑셀의 품목으로 덮어쓰시겠습니까?")) {
        return;
      }
    }

    if (!salesDate || !selectedPartner) return;

    const cleanPartnerName = selectedPartner.replace(" (매출처)", "").replace(" (매입처)", "").split(" (")[0].trim();

    const matchingRows = uploadedExcelRows.filter(row => {
      const partnerKeys = ['학교', '거래처', '거래처명', '납품처', '바이어', '매출처', '수신', '상호명'];
      const partnerVal = getExcelRowValue(row, partnerKeys) || "";
      const cleanRowPartner = String(partnerVal).replace(" (매출처)", "").replace(" (매입처)", "").split(" (")[0].trim();
      if (!cleanRowPartner) return false;

      const dateKeys = ['납품일자', '입고일', '납품기한', '일자', '날짜', '매출일자', '배송일'];
      const dateVal = getExcelRowValue(row, dateKeys) || "";
      const formattedRowDate = formatDateString(dateVal);

      const partnerMatches = cleanRowPartner.includes(cleanPartnerName) || cleanPartnerName.includes(cleanRowPartner);
      const dateMatches = formattedRowDate === salesDate;

      return partnerMatches && dateMatches;
    });

    if (matchingRows.length === 0) {
      setExcelStatusText(`엑셀 로드됨 (선택 일자/매출처의 매칭 데이터 없음)`);
      setExcelStatusColor('var(--text-muted)');
      return;
    }

    const tempCart = [];
    matchingRows.forEach(row => {
      const nameKeys = ['품목', '품목명', '상품명', '제품명', '상품', '품명'];
      const rawProdName = sanitizeExcelUnitAndName(getExcelRowValue(row, nameKeys) || "");
      if (!rawProdName || rawProdName.includes("합계") || rawProdName.includes("합 계")) return;

      const qtyKeys = ['수량', '발주수량', '수량(ea)', 'ea', 'qty', '개수', '수량(box)', '박스'];
      const qtyVal = getExcelRowValue(row, qtyKeys);
      const qty = parseFloat(qtyVal) || 0;
      if (qty <= 0) return;

      const priceKeys = ['단가', '매출단가', '공급단가', '단가(원)', '가격', 'price'];
      const priceVal = getExcelRowValue(row, priceKeys);
      const price = parseInt(String(priceVal || "0").replace(/,/g, "")) || 0;

      const unitKeys = ['규격/단위', '규격', '단위', '규격단위', 'unit'];
      const unit = sanitizeExcelUnitAndName(String(getExcelRowValue(row, unitKeys) || "").trim());

      const prodMeta = products.find(p => p.name.includes(rawProdName) || rawProdName.includes(p.name)) || {
        id: null,
        name: rawProdName,
        unit: unit || "BOX",
        origin: "국내산",
        tax_type: '과세'
      };

      const finalPrice = price || prodMeta.sales_price || 0;
      const amount = Math.floor(qty * finalPrice);
      const isTaxable = prodMeta.tax_type !== '면세';
      const tax = isTaxable ? Math.round(amount * 0.1) : 0;
      const total = amount + tax;

      tempCart.push({
        product_id: prodMeta.id,
        name: prodMeta.name,
        unit: unit || prodMeta.unit || "BOX",
        origin: prodMeta.origin || "국내산",
        qty: qty,
        price: finalPrice,
        amount: amount,
        tax: tax,
        total: total,
        isTaxApplied: isTaxable,
        taxType: prodMeta.tax_type || '과세'
      });
    });

    setSalesCart(tempCart);
    setExcelStatusText(`엑셀에서 ${tempCart.length}건 품목 로드 완료`);
    setExcelStatusColor('#34d399');
  };

  const handleExcelUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setExcelStatusText(`${file.name} 분석 중...`);
    setExcelStatusColor('var(--text-muted)');

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        const rows = XLSX.utils.sheet_to_json(sheet);
        
        if (rows.length === 0) {
          alert("엑셀 시트 내 데이터 행이 존재하지 않습니다.");
          setExcelStatusText("가져오기 실패");
          setExcelStatusColor('var(--danger-color)');
          return;
        }

        setUploadedExcelRows(rows);
        setExcelStatusText(`엑셀 로드됨: ${file.name} (총 ${rows.length}행)`);
        setExcelStatusColor('#34d399');
        
        alert("엑셀 파일이 성공적으로 로드되었습니다.\n매출일자와 매출처를 선택하시면 해당 데이터를 자동으로 불러옵니다.");
      } catch (err) {
        console.error(err);
        setExcelStatusText("에러 발생");
        setExcelStatusColor('var(--danger-color)');
        alert("엑셀 파일 구조 분석 중 문제가 발생했습니다. 파일을 다시 한 번 확인해 주세요.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  useEffect(() => {
    fetchInvoices();
  }, [invoices]);

  // 매출처, 발행일자, 또는 엑셀 로드 시 자동 매칭 적용
  useEffect(() => {
    if (uploadedExcelRows && selectedPartner && salesDate) {
      loadItemsFromExcel(false);
    }
  }, [selectedPartner, salesDate, uploadedExcelRows]);

  const fetchInvoices = async () => {
    try {
      const data = await invoiceApi.getAll('sales');
      setInvoiceList(data);
    } catch (err) {
      console.error(err);
    }
  };

  // 상품 선택 시 매매 단가 자동 채우기
  const handleProductChange = (e) => {
    const prodId = e.target.value;
    setSelectedProduct(prodId);
    if (!prodId) {
      setPrice(0);
      return;
    }
    const prod = products.find(p => p.id === parseInt(prodId, 10));
    if (prod) {
      setPrice(prod.sales_price || 0);
    }
  };

  // 카트에 품목 추가
  const handleAddCartItem = (e) => {
    e.preventDefault();
    if (!selectedProduct) {
      alert("추가할 품목을 선택해 주세요.");
      return;
    }

    const prod = products.find(p => p.id === parseInt(selectedProduct, 10));
    if (!prod) return;

    // 카트 중복 검사
    const existingIdx = salesCart.findIndex(item => item.name === prod.name);
    if (existingIdx !== -1) {
      alert("이미 카트에 존재하는 품목입니다. 수량을 변경해 주세요.");
      return;
    }

    const amount = Math.floor(qty * price);
    const newCartItem = {
      product_id: prod.id,
      name: prod.name,
      unit: prod.unit || 'EA',
      origin: prod.origin || '국내산',
      qty: parseFloat(qty) || 1,
      price: parseInt(price, 10) || 0,
      amount: amount,
      tax: 0,
      total: amount,
      isTaxApplied: false,
      taxType: prod.tax_type // '과세' / '면세'
    };

    setSalesCart([...salesCart, newCartItem]);
    setSelectedProduct('');
    setQty(1);
    setPrice(0);
  };

  // 개별 부가세 토글 체크박스 처리
  const handleToggleItemTax = (index) => {
    const updated = [...salesCart];
    const item = updated[index];

    if (item.taxType === '면세') {
      alert("해당 상품은 면세 품목이므로 부가세를 적용할 수 없습니다.");
      return;
    }

    item.isTaxApplied = !item.isTaxApplied;
    item.tax = item.isTaxApplied ? Math.round(item.amount * 0.1) : 0;
    item.total = item.amount + item.tax;
    setSalesCart(updated);
  };

  // 카트 수량/단가 변경
  const handleCartItemChange = (index, field, value) => {
    const updated = [...salesCart];
    const item = updated[index];

    if (field === 'qty') {
      item.qty = parseFloat(value) || 0;
    } else if (field === 'price') {
      item.price = parseInt(value, 10) || 0;
    }

    item.amount = Math.floor(item.qty * item.price);
    item.tax = item.isTaxApplied ? Math.round(item.amount * 0.1) : 0;
    item.total = item.amount + item.tax;
    setSalesCart(updated);
  };

  const handleRemoveCartItem = (index) => {
    const updated = salesCart.filter((_, i) => i !== index);
    setSalesCart(updated);
  };

  // 카트 총합 계산
  const getCartTotals = () => {
    let amount = 0;
    let tax = 0;
    let total = 0;
    salesCart.forEach(item => {
      amount += item.amount;
      tax += item.tax;
      total += item.total;
    });
    return { amount, tax, total };
  };

  const totals = getCartTotals();

  // 전표 최종 제출 저장
  const handleSaveInvoice = async () => {
    if (!selectedPartner) {
      alert("거래처를 선택해 주세요.");
      return;
    }
    if (salesCart.length === 0) {
      alert("매출 카트에 등록된 품목이 없습니다.");
      return;
    }

    const payload = {
      type: 'sales',
      partnerName: selectedPartner,
      date: salesDate,
      totalAmount: totals.amount,
      totalTax: totals.tax,
      totalSum: totals.total,
      status: status,
      items: salesCart
    };

    try {
      await invoiceApi.create(payload);
      alert("매출 전표가 등록되었으며, 재고가 자동차감 처리되었습니다!");
      setSalesCart([]);
      setSelectedPartner('');
      setStatus('청구(외상)');
      onDataChange();
      fetchInvoices();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || "전표 저장 중 오류가 발생했습니다.");
    }
  };

  const handleInvoiceClick = async (id) => {
    try {
      const detail = await invoiceApi.getById(id);
      setSelectedInvoiceDetail(detail);
      setShowDetailModal(true);
    } catch (err) {
      console.error(err);
      alert("전표 상세 정보를 가져오지 못했습니다.");
    }
  };

  const handleDeleteInvoice = async (id, e) => {
    e.stopPropagation();
    if (!confirm("전표를 삭제하시겠습니까? 매출된 품목의 재고가 다시 자동 롤백됩니다.")) return;

    try {
      await invoiceApi.delete(id);
      alert("삭제되었습니다.");
      onDataChange();
      fetchInvoices();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || "전표 삭제 중 에러가 발생했습니다.");
    }
  };

  // ==========================================
  // 매출거래명세서 다중 페이지 A5 인쇄 Pagination 빌더
  // ==========================================
  const triggerInvoicePrintDoc = (invoice) => {
    // 본사(공급자) 및 도장 정보 가져오기
    let hq = { hqName: "본사 사업소", owner: "대표자명", bizNo: "123-45-67890", address: "서울특별시 서초구", phone: "02-1234-5678" };
    const savedHq = localStorage.getItem('smart_erp_hq_info');
    if (savedHq) {
      try { hq = JSON.parse(savedHq); } catch(e) {}
    }
    const sealImg = localStorage.getItem('smart_erp_seal_image') || '';

    // 공급받는자(거래처) 정보 로드
    const partner = partners.find(p => p.name === invoice.partner_name) || {
      name: invoice.partner_name,
      owner: "공급받는대표",
      biz_no: "000-00-00000",
      address: "수신처 주소",
      phone: "010-0000-0000"
    };

    const items = invoice.items || [];
    
    // Pagination: A5 용지 1페이지당 13행 수용
    const ITEMS_PER_PAGE = 13;
    const totalPages = Math.max(1, Math.ceil(items.length / ITEMS_PER_PAGE));
    let docHtml = "";

    for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
      const pageItems = items.slice(pageIdx * ITEMS_PER_PAGE, (pageIdx + 1) * ITEMS_PER_PAGE);
      
      // 13행을 다 채우기 위해 빈 셀 패딩 추가
      const emptyRowCount = ITEMS_PER_PAGE - pageItems.length;
      const emptyRows = [];
      for (let i = 0; i < emptyRowCount; i++) {
        emptyRows.push({});
      }

      // 페이지 누적금 계산
      const prevItems = items.slice(0, pageIdx * ITEMS_PER_PAGE);
      const prevSum = prevItems.reduce((acc, curr) => acc + curr.total, 0);
      const currentPageSum = pageItems.reduce((acc, curr) => acc + curr.total, 0);
      const accumSum = prevSum + currentPageSum;

      docHtml += `
        <div class="print-page-wrapper" style="page-break-after: always; width: 210mm; height: 148mm; box-sizing: border-box; padding: 6mm; background: #fff; color: #000; font-family: 'Inter', 'Noto Sans KR', sans-serif; position: relative;">
          
          <!-- 타이틀 영역 -->
          <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #000; padding-bottom: 4px; margin-bottom: 4px;">
            <div style="font-size: 1.6rem; font-weight: 900; letter-spacing: 2px;">매 출 거 래 명 세 서</div>
            <div style="font-size: 0.75rem; font-weight: bold;">[일련번호: INV-${invoice.id}-${pageIdx+1}]</div>
          </div>

          <!-- 공급자/공급받는자 인적사항 교차 레이아웃 (tr 높이 17px로 조율) -->
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 6px; font-size: 0.7rem;">
            <tr>
              <!-- 공급자 (좌측) -->
              <td style="width: 50%; padding-right: 4px; vertical-align: top;">
                <table style="width: 100%; border-collapse: collapse; border: 1px solid #000;">
                  <tr style="background: #f0f0f0;">
                    <th colSpan="4" style="border-bottom: 1px solid #000; padding: 2px; text-align: center; font-weight: bold; font-size: 0.75rem;">공 급 자</th>
                  </tr>
                  <tr>
                    <td style="border: 1px solid #000; padding: 2px; width: 20%; font-weight: bold; text-align: center;">등록번호</td>
                    <td colSpan="3" style="border: 1px solid #000; padding: 2px; font-family: monospace; font-weight: bold; font-size: 0.75rem;">${hq.bizNo}</td>
                  </tr>
                  <tr>
                    <td style="border: 1px solid #000; padding: 2px; font-weight: bold; text-align: center;">상 호</td>
                    <td style="border: 1px solid #000; padding: 2px; font-weight: bold;">${hq.hqName}</td>
                    <td style="border: 1px solid #000; padding: 2px; width: 15%; font-weight: bold; text-align: center;">대 표</td>
                    <td style="border: 1px solid #000; padding: 2px; font-weight: bold; position: relative; width: 25%;">
                      ${hq.owner}
                      ${sealImg ? `
                        <img src="${sealImg}" style="position: absolute; width: 32px; height: 32px; right: 2px; top: 50%; transform: translateY(-50%); opacity: 0.85; z-index: 5;" />
                      ` : `
                        <span style="color: red; font-weight: bold; border: 1.5px solid red; border-radius: 50%; padding: 1px 3px; font-size: 0.6rem; position: absolute; right: 4px; top: 50%; transform: translateY(-50%); scale: 0.8;">인</span>
                      `}
                    </td>
                  </tr>
                  <tr>
                    <td style="border: 1px solid #000; padding: 2px; font-weight: bold; text-align: center;">소재지</td>
                    <td colSpan="3" style="border: 1px solid #000; padding: 2px; font-size: 0.65rem;">${hq.address}</td>
                  </tr>
                  <tr>
                    <td style="border: 1px solid #000; padding: 2px; font-weight: bold; text-align: center;">전화번호</td>
                    <td colSpan="3" style="border: 1px solid #000; padding: 2px;">${hq.phone}</td>
                  </tr>
                </table>
              </td>

              <!-- 공급받는자 (우측) -->
              <td style="width: 50%; padding-left: 4px; vertical-align: top;">
                <table style="width: 100%; border-collapse: collapse; border: 1px solid #000;">
                  <tr style="background: #f0f0f0;">
                    <th colSpan="4" style="border-bottom: 1px solid #000; padding: 2px; text-align: center; font-weight: bold; font-size: 0.75rem;">공급받는자</th>
                  </tr>
                  <tr>
                    <td style="border: 1px solid #000; padding: 2px; width: 20%; font-weight: bold; text-align: center;">등록번호</td>
                    <td colSpan="3" style="border: 1px solid #000; padding: 2px; font-family: monospace; font-weight: bold; font-size: 0.75rem;">${partner.biz_no || '000-00-00000'}</td>
                  </tr>
                  <tr>
                    <td style="border: 1px solid #000; padding: 2px; font-weight: bold; text-align: center;">상 호</td>
                    <td style="border: 1px solid #000; padding: 2px; font-weight: bold;">${partner.name}</td>
                    <td style="border: 1px solid #000; padding: 2px; width: 15%; font-weight: bold; text-align: center;">대 표</td>
                    <td style="border: 1px solid #000; padding: 2px;">${partner.owner || '대표자'}</td>
                  </tr>
                  <tr>
                    <td style="border: 1px solid #000; padding: 2px; font-weight: bold; text-align: center;">소재지</td>
                    <td colSpan="3" style="border: 1px solid #000; padding: 2px; font-size: 0.65rem;">${partner.address || '소재지 정보 없음'}</td>
                  </tr>
                  <tr>
                    <td style="border: 1px solid #000; padding: 2px; font-weight: bold; text-align: center;">연락처</td>
                    <td colSpan="3" style="border: 1px solid #000; padding: 2px;">${partner.phone || '연락처 없음'}</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          <!-- 거래 품목 테이블 (13행 고정 렌더링, tr 20px) -->
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; font-size: 0.72rem; margin-bottom: 6px;">
            <thead>
              <tr style="background: #f0f0f0; border-bottom: 2px solid #000; height: 22px;">
                <th style="border: 1px solid #000; padding: 2px; width: 5%; text-align: center;">번호</th>
                <th style="border: 1px solid #000; padding: 2px; width: 35%; text-align: left;">품명</th>
                <th style="border: 1px solid #000; padding: 2px; width: 10%; text-align: center;">규격</th>
                <th style="border: 1px solid #000; padding: 2px; width: 10%; text-align: center;">수량</th>
                <th style="border: 1px solid #000; padding: 2px; width: 12%; text-align: right;">단가</th>
                <th style="border: 1px solid #000; padding: 2px; width: 15%; text-align: right;">공급가액</th>
                <th style="border: 1px solid #000; padding: 2px; width: 10%; text-align: right;">세액</th>
                <th style="border: 1px solid #000; padding: 2px; width: 3%; text-align: center;">세</th>
              </tr>
            </thead>
            <tbody>
              ${pageItems.map((item, idx) => {
                const globalIdx = pageIdx * ITEMS_PER_PAGE + idx + 1;
                return `
                  <tr style="height: 20px; border-bottom: 1px solid #000;">
                    <td style="border: 1px solid #000; padding: 2px; text-align: center; font-size: 0.65rem; color: #555;">${globalIdx}</td>
                    <td style="border: 1px solid #000; padding: 2px; font-weight: bold; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;">${item.name}</td>
                    <td style="border: 1px solid #000; padding: 2px; text-align: center; font-size: 0.65rem;">${item.unit}</td>
                    <td style="border: 1px solid #000; padding: 2px; text-align: center; font-family: monospace;">${item.qty}</td>
                    <td style="border: 1px solid #000; padding: 2px; text-align: right; font-family: monospace;">${formatNumber(item.price)}</td>
                    <td style="border: 1px solid #000; padding: 2px; text-align: right; font-family: monospace; font-weight: bold;">${formatNumber(item.amount)}</td>
                    <td style="border: 1px solid #000; padding: 2px; text-align: right; font-family: monospace;">${formatNumber(item.tax)}</td>
                    <td style="border: 1px solid #000; padding: 2px; text-align: center; font-size: 0.65rem; font-weight: bold; color: green;">${item.is_tax_applied ? '과' : '면'}</td>
                  </tr>
                `;
              }).join("")}
              ${emptyRows.map((_, idx) => {
                return `
                  <tr style="height: 20px; border-bottom: 1px solid #000; color: #ccc;">
                    <td style="border: 1px solid #000; padding: 2px; text-align: center;">&nbsp;</td>
                    <td style="border: 1px solid #000; padding: 2px;">&nbsp;</td>
                    <td style="border: 1px solid #000; padding: 2px;">&nbsp;</td>
                    <td style="border: 1px solid #000; padding: 2px;">&nbsp;</td>
                    <td style="border: 1px solid #000; padding: 2px;">&nbsp;</td>
                    <td style="border: 1px solid #000; padding: 2px;">&nbsp;</td>
                    <td style="border: 1px solid #000; padding: 2px;">&nbsp;</td>
                    <td style="border: 1px solid #000; padding: 2px;">&nbsp;</td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>

          <!-- 하단 요약 격자 영역 (2줄 회계 장부 테이블, tr 17px, line-height 1.2로 유연화) -->
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; font-size: 0.72rem; margin-bottom: 6px; text-align: center;">
            <tr style="background: #f0f0f0; border-bottom: 1px solid #000;">
              <td style="border: 1px solid #000; padding: 2px 4px; font-weight: bold; width: 14%; height: 17px;">거래 일자</td>
              <td style="border: 1px solid #000; padding: 2px 4px; font-weight: bold; width: 14%;">합계 공급가액</td>
              <td style="border: 1px solid #000; padding: 2px 4px; font-weight: bold; width: 14%;">합계 세액</td>
              <td style="border: 1px solid #000; padding: 2px 4px; font-weight: bold; width: 20%; background: #e6fffa;" colSpan="2">페이지 총합계 (인수액)</td>
              <td style="border: 1px solid #000; padding: 2px 4px; font-weight: bold; width: 18%;">거래 구분</td>
              <td style="border: 1px solid #000; padding: 2px 4px; font-weight: bold; width: 20%; background: #fff3cd;">누적 총계</td>
            </tr>
            <tr style="height: 17px;">
              <td style="border: 1px solid #000; padding: 2px 4px; font-weight: bold;">${invoice.date}</td>
              <td style="border: 1px solid #000; padding: 2px 4px; font-family: monospace;">${formatNumber(invoice.total_amount)}</td>
              <td style="border: 1px solid #000; padding: 2px 4px; font-family: monospace;">${formatNumber(invoice.total_tax)}</td>
              <td style="border: 1px solid #000; padding: 2px 4px; font-family: monospace; font-weight: 900; font-size: 0.75rem; background: #e6fffa;" colSpan="2">
                ${formatNumber(currentPageSum)}원
              </td>
              <td style="border: 1px solid #000; padding: 2px 4px; font-weight: bold;">
                ${invoice.status}
              </td>
              <td style="border: 1px solid #000; padding: 2px 4px; font-family: monospace; font-weight: bold; font-size: 0.75rem; background: #fff3cd; color: #1e5a32;">
                ${formatNumber(accumSum)}원
              </td>
            </tr>
          </table>

          <!-- 최하단 비고 및 페이지 서명란 -->
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.65rem; color: #333; margin-top: 4px;">
            <div>비고: 품목 상태가 불량한 경우 수령일로부터 3일 이내에 교환이 가능합니다.</div>
            <div style="font-weight: bold; background: #ddd; padding: 2px 8px; border-radius: 4px;">
              페이지: ${pageIdx + 1} / ${totalPages}
            </div>
          </div>
        </div>
      `;
    }

    // 인쇄용 컨테이너에 HTML 주입 후 브라우저 프린트 실행
    const printArea = document.getElementById("print-document-area");
    if (printArea) {
      printArea.innerHTML = docHtml;
      setTimeout(() => {
        window.print();
      }, 300);
    } else {
      alert("인쇄 컨테이너를 찾을 수 없습니다.");
    }
  };

  const filteredPartners = partners.filter(p => p.type === '매출처' || p.type === '혼합');

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '20px', textAlign: 'left' }} className="responsive-split">
      {/* 좌측: 매출 거래 입력 카트 (글래스모피즘) */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.02)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: '12px',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        alignSelf: 'start'
      }}>
        <div>
          <h3 style={{ margin: '0 0 4px 0', color: '#fff', fontSize: '1.15rem' }}>매출 거래 작성 카트</h3>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            납품처 거래를 전표로 등록하고 발행합니다.
          </p>
        </div>

        {/* 거래처 및 날짜 설정 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div className="form-group">
            <label>매출처 (수신처)</label>
            <select
              value={selectedPartner}
              onChange={(e) => setSelectedPartner(e.target.value)}
              required
            >
              <option value="">-- 거래처 선택 --</option>
              {filteredPartners.map(p => (
                <option key={p.id} value={p.name}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>매출 발행 일자</label>
            <input
              type="date"
              value={salesDate}
              onChange={(e) => setSalesDate(e.target.value)}
              required
            />
          </div>
        </div>

        {/* 엑셀 발주서 일괄 업로드 영역 */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.01)',
          border: '1px dashed rgba(255, 255, 255, 0.15)',
          borderRadius: '8px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--primary-color)', display: 'block' }}>
            엑셀 발주서 일괄 업로드 (선택사항)
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <input
              type="file"
              accept=".xlsx, .xls"
              onChange={handleExcelUpload}
              style={{ display: 'none' }}
              id="sales-excel-input"
            />
            <button
              type="button"
              className="btn"
              style={{
                padding: '6px 12px',
                fontSize: '0.78rem',
                background: 'rgba(255,255,255,0.06)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '6px'
              }}
              onClick={() => document.getElementById('sales-excel-input').click()}
            >
              엑셀 파일 선택
            </button>
            <span style={{ fontSize: '0.75rem', color: excelStatusColor, maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {excelStatusText || '업로드할 엑셀 파일(.xlsx)을 선택하세요.'}
            </span>
          </div>
          {uploadedExcelRows && (
            <button
              type="button"
              className="btn"
              style={{
                padding: '6px 12px',
                fontSize: '0.78rem',
                background: 'rgba(167, 139, 250, 0.15)',
                color: 'var(--primary-color)',
                border: '1px solid rgba(167, 139, 250, 0.35)',
                borderRadius: '6px',
                marginTop: '4px'
              }}
              onClick={() => loadItemsFromExcel(true)}
            >
              엑셀 매칭 품목 강제 로드
            </button>
          )}
        </div>

        {/* 품목 입력 영역 */}
        <form onSubmit={handleAddCartItem} style={{
          background: 'rgba(0,0,0,0.15)',
          padding: '16px',
          borderRadius: '8px',
          border: '1px solid rgba(255,255,255,0.05)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div className="form-group">
            <label>매출 상품 선택</label>
            <select value={selectedProduct} onChange={handleProductChange}>
              <option value="">-- 상품 검색/선택 --</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} (재고: {p.stock} {p.unit} | 단가: {formatNumber(p.sales_price)}원)
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label>매출 수량</label>
              <input
                type="number"
                min="0.1"
                step="any"
                value={qty}
                onChange={(e) => setQty(parseFloat(e.target.value) || 1)}
              />
            </div>
            <div className="form-group">
              <label>매출 단가 (원)</label>
              <input
                type="number"
                min="0"
                value={price}
                onChange={(e) => setPrice(parseInt(e.target.value, 10) || 0)}
              />
            </div>
          </div>

          <button type="submit" className="btn" style={{
            background: 'rgba(167, 139, 250, 0.2)',
            color: 'var(--primary-color)',
            border: '1px solid rgba(167,139,250,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}>
            <Plus size={16} />
            카트에 품목 추가
          </button>
        </form>

        {/* 카트 테이블 */}
        <div>
          <label style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
            선택된 품목 목록 ({salesCart.length}건)
          </label>
          <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.05)', height: '26px' }}>
                  <th style={{ padding: '4px', textAlign: 'center', width: '30px' }}>세</th>
                  <th style={{ padding: '4px', textAlign: 'left' }}>품목명</th>
                  <th style={{ padding: '4px', textAlign: 'center', width: '50px' }}>수량</th>
                  <th style={{ padding: '4px', textAlign: 'right', width: '70px' }}>금액</th>
                  <th style={{ padding: '4px', textAlign: 'center', width: '40px' }}>작업</th>
                </tr>
              </thead>
              <tbody>
                {salesCart.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                      카트가 비어 있습니다.
                    </td>
                  </tr>
                ) : (
                  salesCart.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', height: '32px' }}>
                      <td style={{ padding: '2px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={item.isTaxApplied}
                          disabled={item.taxType === '면세'}
                          onChange={() => handleToggleItemTax(idx)}
                          style={{ cursor: item.taxType === '면세' ? 'not-allowed' : 'pointer' }}
                        />
                      </td>
                      <td style={{ padding: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.name}>
                        {item.name}
                      </td>
                      <td style={{ padding: '2px' }}>
                        <input
                          type="number"
                          value={item.qty}
                          min="0.1"
                          step="any"
                          onChange={(e) => handleCartItemChange(idx, 'qty', e.target.value)}
                          style={{
                            width: '45px',
                            background: 'rgba(0,0,0,0.3)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            color: '#fff',
                            borderRadius: '4px',
                            textAlign: 'center',
                            fontSize: '0.75rem',
                            padding: '2px'
                          }}
                        />
                      </td>
                      <td style={{ padding: '2px', textAlign: 'right', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                        {formatNumber(item.total)}
                      </td>
                      <td style={{ padding: '2px', textAlign: 'center' }}>
                        <button
                          type="button"
                          className="btn btn-danger"
                          style={{ padding: '2px 4px', fontSize: '0.7rem' }}
                          onClick={() => handleRemoveCartItem(idx)}
                        >
                          삭제
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 세무 구분 및 총계 요약 */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '8px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          fontSize: '0.85rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>공급가액</span>
            <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{formatNumber(totals.amount)}원</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>세액 (부가세)</span>
            <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{formatNumber(totals.tax)}원</span>
          </div>
          <div style={{ display: 'flex', justifyContext: 'space-between', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '8px', fontSize: '1rem' }}>
            <span style={{ color: 'var(--primary-color)', fontWeight: 'bold' }}>총인수액</span>
            <span style={{ fontFamily: 'monospace', fontWeight: '900', color: '#fff' }}>{formatNumber(totals.total)}원</span>
          </div>
        </div>

        {/* 영수/청구 구분 및 발행 등록 단추 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ padding: '8px 4px' }}>
            <option value="청구(외상)">청구 (외상)</option>
            <option value="영수(완납)">영수 (완납)</option>
          </select>
          <button
            type="button"
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            onClick={handleSaveInvoice}
          >
            <Save size={16} />
            매출 전표 발행 및 저장
          </button>
        </div>
      </div>

      {/* 우측: 매출 전표 리스트 조회 그리드 */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.02)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: '12px',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <div>
          <h3 style={{ margin: 0, color: '#fff', fontSize: '1.15rem' }}>
            매출 전표 원장 대장
          </h3>
          <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            과거 발행된 매출거래명세서를 조회하고 재출력(A5 Pagination 인쇄)을 수행합니다.
          </p>
        </div>

        <div style={{ maxHeight: '520px', overflowY: 'auto' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.03)', position: 'sticky', top: 0, zIndex: 1 }}>
                <th style={{ padding: '10px 8px', borderBottom: '1px solid rgba(255,255,255,0.08)', width: '90px' }}>일자</th>
                <th style={{ padding: '10px 8px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>거래처</th>
                <th style={{ padding: '10px 8px', borderBottom: '1px solid rgba(255,255,255,0.08)', textAlign: 'right' }}>총 공급가액</th>
                <th style={{ padding: '10px 8px', borderBottom: '1px solid rgba(255,255,255,0.08)', textAlign: 'right' }}>세액</th>
                <th style={{ padding: '10px 8px', borderBottom: '1px solid rgba(255,255,255,0.08)', textAlign: 'right' }}>합계금액</th>
                <th style={{ padding: '10px 8px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>상태</th>
                <th style={{ padding: '10px 8px', borderBottom: '1px solid rgba(255,255,255,0.08)', textAlign: 'center', width: '100px' }}>작업</th>
              </tr>
            </thead>
            <tbody>
              {invoiceList.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                    등록된 매출거래 명세표 정보가 존재하지 않습니다.
                  </td>
                </tr>
              ) : (
                invoiceList.map(inv => (
                  <tr
                    key={inv.id}
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', cursor: 'pointer' }}
                    onClick={() => handleInvoiceClick(inv.id)}
                  >
                    <td style={{ padding: '10px 8px' }}>{inv.date}</td>
                    <td style={{ padding: '10px 8px', fontWeight: 'bold' }}>{inv.partner_name}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{formatNumber(inv.total_amount)}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{formatNumber(inv.total_tax)}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold' }}>{formatNumber(inv.total_sum)}</td>
                    <td style={{ padding: '10px 8px' }}>
                      <span style={{
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        background: inv.status === '영수(완납)' ? 'rgba(52, 211, 153, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                        color: inv.status === '영수(완납)' ? '#34d399' : '#f59e0b'
                      }}>
                        {inv.status}
                      </span>
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }} onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="btn"
                          style={{
                            padding: '4px 8px',
                            fontSize: '0.75rem',
                            background: 'rgba(167, 139, 250, 0.2)',
                            color: 'var(--primary-color)',
                            border: '1px solid rgba(167,139,250,0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          onClick={() => triggerInvoicePrintDoc(inv)}
                        >
                          <Printer size={12} />
                          출력
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger"
                          style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                          onClick={(e) => handleDeleteInvoice(inv.id, e)}
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 전표 상세 보기 모달 */}
      {showDetailModal && selectedInvoiceDetail && (
        <div className="modal-overlay active" style={{ display: 'flex' }} onClick={() => setShowDetailModal(false)}>
          <div className="modal-content" style={{ maxWidth: '650px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>매출 전표 상세 내역 [INV-{selectedInvoiceDetail.id}]</h3>
              <button type="button" className="modal-close-btn" onClick={() => setShowDetailModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body" style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '6px' }}>
                <div><strong>거래처:</strong> {selectedInvoiceDetail.partner_name}</div>
                <div><strong>발행일자:</strong> {selectedInvoiceDetail.date}</div>
                <div><strong>구분:</strong> {selectedInvoiceDetail.status}</div>
              </div>
              <div>
                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>품목 내역</label>
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.05)', height: '24px' }}>
                        <th style={{ padding: '6px', textAlign: 'left' }}>품목명</th>
                        <th style={{ padding: '6px', textAlign: 'center', width: '50px' }}>규격</th>
                        <th style={{ padding: '6px', textAlign: 'center', width: '50px' }}>수량</th>
                        <th style={{ padding: '6px', textAlign: 'right', width: '70px' }}>단가</th>
                        <th style={{ padding: '6px', textAlign: 'right', width: '80px' }}>공급가액</th>
                        <th style={{ padding: '6px', textAlign: 'right', width: '70px' }}>세액</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedInvoiceDetail.items && selectedInvoiceDetail.items.map((item, index) => (
                        <tr key={index} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', height: '30px' }}>
                          <td style={{ padding: '6px' }}>{item.name}</td>
                          <td style={{ padding: '6px', textAlign: 'center' }}>{item.unit}</td>
                          <td style={{ padding: '6px', textAlign: 'center' }}>{item.qty}</td>
                          <td style={{ padding: '6px', textAlign: 'right', fontFamily: 'monospace' }}>{formatNumber(item.price)}</td>
                          <td style={{ padding: '6px', textAlign: 'right', fontFamily: 'monospace' }}>{formatNumber(item.amount)}</td>
                          <td style={{ padding: '6px', textAlign: 'right', fontFamily: 'monospace' }}>{formatNumber(item.tax)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '24px',
                borderTop: '1px solid rgba(255,255,255,0.06)',
                paddingTop: '12px',
                fontSize: '0.9rem',
                fontFamily: 'monospace'
              }}>
                <div>공급가액: <strong>{formatNumber(selectedInvoiceDetail.total_amount)}원</strong></div>
                <div>세액: <strong>{formatNumber(selectedInvoiceDetail.total_tax)}원</strong></div>
                <div style={{ color: 'var(--primary-color)' }}>합계: <strong>{formatNumber(selectedInvoiceDetail.total_sum)}원</strong></div>
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContext: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-primary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'linear-gradient(135deg, #a78bfa, #7c3aed)'
                }}
                onClick={() => {
                  setShowDetailModal(false);
                  triggerInvoicePrintDoc(selectedInvoiceDetail);
                }}
              >
                <Printer size={14} />
                거래명세서 인쇄
              </button>
              <button type="button" className="btn" style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }} onClick={() => setShowDetailModal(false)}>
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
