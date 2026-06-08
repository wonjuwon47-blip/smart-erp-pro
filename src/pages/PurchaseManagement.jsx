import React, { useState, useEffect } from 'react';
import { invoiceApi, partnerApi, productApi, ocrApi } from '../services/api';
import { Plus, Trash2, Printer, Save, X, Image, Loader2, Edit3 } from 'lucide-react';

export default function PurchaseManagement({ products, partners, invoices, onDataChange }) {
  const [purchaseCart, setPurchaseCart] = useState([]);
  const [selectedPartner, setSelectedPartner] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().substring(0, 10));
  const [status, setStatus] = useState('청구(외상)');
  const [invoiceList, setInvoiceList] = useState([]);

  // 신규 품목 입력 필드
  const [selectedProduct, setSelectedProduct] = useState('');
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState(0);

  // 전표 상세 정보 보기 모달
  const [selectedInvoiceDetail, setSelectedInvoiceDetail] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // OCR 상태 관리
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrProgressText, setOcrProgressText] = useState('');
  const [ocrPreviewUrl, setOcrPreviewUrl] = useState('');
  const [showOcrModal, setShowOcrModal] = useState(false);
  const [ocrRawText, setOcrRawText] = useState('');
  const [ocrCorrectPartner, setOcrCorrectPartner] = useState('');
  const [ocrCorrectDate, setOcrCorrectDate] = useState('');
  const [ocrCorrectBizNo, setOcrCorrectBizNo] = useState('');
  const [ocrCorrectItems, setOcrCorrectItems] = useState([]);

  const formatNumber = (num) => {
    return new Intl.NumberFormat('ko-KR').format(num || 0);
  };

  useEffect(() => {
    fetchInvoices();
  }, [invoices]);

  const fetchInvoices = async () => {
    try {
      const data = await invoiceApi.getAll('purchase');
      setInvoiceList(data);
    } catch (err) {
      console.error(err);
    }
  };

  // 상품 변경 시 단가 자동 연동
  const handleProductChange = (e) => {
    const prodId = e.target.value;
    setSelectedProduct(prodId);
    if (!prodId) {
      setPrice(0);
      return;
    }
    const prod = products.find(p => p.id === parseInt(prodId, 10));
    if (prod) {
      setPrice(prod.purchase_price || 0);
    }
  };

  // 카트에 수동으로 품목 추가
  const handleAddCartItem = (e) => {
    e.preventDefault();
    if (!selectedProduct) {
      alert("추가할 품목을 선택해 주세요.");
      return;
    }

    const prod = products.find(p => p.id === parseInt(selectedProduct, 10));
    if (!prod) return;

    // 카트 중복 검사
    const existingIdx = purchaseCart.findIndex(item => item.name === prod.name);
    if (existingIdx !== -1) {
      alert("이미 카트에 존재하는 품목입니다.");
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
      taxType: prod.tax_type
    };

    setPurchaseCart([...purchaseCart, newCartItem]);
    setSelectedProduct('');
    setQty(1);
    setPrice(0);
  };

  // 개별 부가세 체크박스 토글
  const handleToggleItemTax = (index) => {
    const updated = [...purchaseCart];
    const item = updated[index];

    if (item.taxType === '면세') {
      alert("해당 상품은 면세 품목이므로 부가세를 적용할 수 없습니다.");
      return;
    }

    item.isTaxApplied = !item.isTaxApplied;
    item.tax = item.isTaxApplied ? Math.round(item.amount * 0.1) : 0;
    item.total = item.amount + item.tax;
    setPurchaseCart(updated);
  };

  // 카트 행 정보 인라인 수정
  const handleCartItemChange = (index, field, value) => {
    const updated = [...purchaseCart];
    const item = updated[index];

    if (field === 'qty') {
      item.qty = parseFloat(value) || 0;
    } else if (field === 'price') {
      item.price = parseInt(value, 10) || 0;
    }

    item.amount = Math.floor(item.qty * item.price);
    item.tax = item.isTaxApplied ? Math.round(item.amount * 0.1) : 0;
    item.total = item.amount + item.tax;
    setPurchaseCart(updated);
  };

  const handleRemoveCartItem = (index) => {
    const updated = purchaseCart.filter((_, i) => i !== index);
    setPurchaseCart(updated);
  };

  const getCartTotals = () => {
    let amount = 0;
    let tax = 0;
    let total = 0;
    purchaseCart.forEach(item => {
      amount += item.amount;
      tax += item.tax;
      total += item.total;
    });
    return { amount, tax, total };
  };

  const totals = getCartTotals();

  // 매입 전표 최종 저장
  const handleSaveInvoice = async () => {
    if (!selectedPartner) {
      alert("공급자 거래처를 선택해 주세요.");
      return;
    }
    if (purchaseCart.length === 0) {
      alert("매입 카트에 품목이 없습니다.");
      return;
    }

    const payload = {
      type: 'purchase',
      partnerName: selectedPartner,
      date: purchaseDate,
      totalAmount: totals.amount,
      totalTax: totals.tax,
      totalSum: totals.total,
      status: status,
      items: purchaseCart
    };

    try {
      await invoiceApi.create(payload);
      alert("매입 전표가 성공적으로 저장되었으며, 재고가 실시간 반영되었습니다!");
      setPurchaseCart([]);
      setSelectedPartner('');
      setStatus('청구(외상)');
      onDataChange();
      fetchInvoices();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || "전표 저장에 실패했습니다.");
    }
  };

  // ==========================================
  // Tesseract.js 동적 주입 및 로컬 OCR 처리 (Fallback)
  // ==========================================
  const loadTesseract = () => {
    return new Promise((resolve, reject) => {
      if (window.Tesseract) return resolve(window.Tesseract);
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
      script.onload = () => resolve(window.Tesseract);
      script.onerror = () => reject(new Error("Tesseract.js 스크립트 로드에 실패했습니다."));
      document.head.appendChild(script);
    });
  };

  // 로컬 OCR 텍스트 정규식 분석기
  const localParseOcrText = (text) => {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    let bizNo = "";
    const bizNoRegex = /\d{3}-\d{2}-\d{5}/;
    for (const line of lines) {
      const match = line.match(bizNoRegex);
      if (match) { bizNo = match[0]; break; }
    }

    let partnerName = "";
    for (const line of lines) {
      if (line.includes("상호") || line.includes("상 호") || line.includes("공급자") || line.includes("상호명")) {
        // 공급받는자 정보가 같은 라인에 있으면 공급받는자 뒤쪽은 잘라냄 (공급자 상호만 추출하기 위함)
        let lineForPartner = line;
        if (line.includes("공급받는자") || line.includes("공급받는 자") || line.includes("공급 받는")) {
          lineForPartner = line.split(/공급받는자|공급받는 자|공급 받는/)[0];
        }
        
        const clean = lineForPartner.replace(/상호명|상호|상 호|공급자|공급원|[:(]/g, "").trim();
        const parts = clean.split(/\s+/);
        if (parts[0] && parts[0].length > 1) { partnerName = parts[0]; break; }
      }
    }
    if (!partnerName) {
      // 공급받는자 키워드가 라인에 있는 경우 상호명 추출에서 제외
      for (let i = 0; i < Math.min(lines.length, 12); i++) {
        const line = lines[i];
        if (line.includes("공급받는자") || line.includes("공급받는 자") || line.includes("공급 받는")) continue;
        
        if (line.includes("주식회사") || line.includes("(주)") || line.includes("유통") || line.includes("상사") || line.includes("푸드") || line.includes("농산") || line.includes("수산")) {
          const match = line.match(/[가-힣A-Za-z0-9()]+/g);
          if (match) {
            partnerName = match.find(w => w.includes("주식회사") || w.includes("(주)") || w.includes("유통") || w.includes("상사") || w.includes("푸드") || w.includes("농산") || w.includes("수산")) || "";
            if (partnerName) break;
          }
        }
      }
    }
    if (!partnerName) partnerName = "OCR 로컬 추출 거래처";

    let invoiceDate = new Date().toISOString().substring(0, 10);
    const dateRegex = /(\d{4})[-./년]\s*(\d{1,2})[-./월]\s*(\d{1,2})/;
    for (const line of lines) {
      const match = line.match(dateRegex);
      if (match) {
        invoiceDate = `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
        break;
      }
    }

    const parsedItems = [];
    const cleanNumber = (str) => parseInt(str.replace(/[^0-9]/g, ''), 10) || 0;
    const cleanFloat = (str) => parseFloat(str.replace(/[^0-9.]/g, '')) || 0;

    for (const line of lines) {
      if (line.length < 5) continue;
      if (line.includes("합계") || line.includes("합 계") || line.includes("공급가액") || line.includes("부가세") || line.includes("세액") || line.includes("소계")) continue;

      const tokens = line.split(/\s+/);
      if (tokens.length >= 3) {
        const numTokens = [];
        const numIndices = [];
        let tokenIdx = tokens.length - 1;
        
        // 뒤에서부터 역순으로 탐색하여 연속된 숫자 토큰 수집
        while (tokenIdx >= 0) {
          const token = tokens[tokenIdx];
          const cleanT = token.replace(/,/g, '');
          if (/^\d+(\.\d+)?$/.test(cleanT)) {
            numTokens.push(cleanT);
            numIndices.push(tokenIdx);
            tokenIdx--;
          } else {
            break;
          }
        }
        
        numTokens.reverse();
        numIndices.reverse();
        
        const N = numTokens.length;
        let qtyVal = 0;
        let priceVal = 0;
        let amountVal = 0;
        let hasItem = false;
        let nameEndIdx = tokens.length - 1;
        
        if (N >= 5) {
          // 5단 구조: [수량] [단가] [공급가액] [부가세] [금액] -> 실질 공급가액(numTokens[2])을 amountVal로 사용
          qtyVal = cleanFloat(numTokens[0]);
          priceVal = cleanNumber(numTokens[1]);
          amountVal = cleanNumber(numTokens[2]);
          hasItem = (qtyVal > 0 && priceVal > 0 && amountVal > 0);
          nameEndIdx = numIndices[0] - 1;
        } else if (N === 4) {
          // 4단 구조: [수량] [단가] [공급가액] [금액]
          qtyVal = cleanFloat(numTokens[0]);
          priceVal = cleanNumber(numTokens[1]);
          amountVal = cleanNumber(numTokens[2]);
          hasItem = (qtyVal > 0 && priceVal > 0 && amountVal > 0);
          nameEndIdx = numIndices[0] - 1;
        } else if (N === 3) {
          // 3단 구조: [수량] [단가] [금액]
          qtyVal = cleanFloat(numTokens[0]);
          priceVal = cleanNumber(numTokens[1]);
          amountVal = cleanNumber(numTokens[2]);
          hasItem = (qtyVal > 0 && priceVal > 0 && amountVal > 0);
          nameEndIdx = numIndices[0] - 1;
        } else if (N === 2) {
          // 2단 구조: [단가] [금액]
          priceVal = cleanNumber(numTokens[0]);
          amountVal = cleanNumber(numTokens[1]);
          qtyVal = Math.round(amountVal / (priceVal || 1));
          hasItem = (qtyVal > 0 && priceVal > 0 && amountVal > 0);
          nameEndIdx = numIndices[0] - 1;
        }
        
        // 대안 매칭 (숫자 토큰 중간이 비어 있거나 역순 탐색으로 찾을 수 없을 때)
        if (!hasItem) {
          const allNumTokens = [];
          const allNumIndices = [];
          tokens.forEach((t, index) => {
            const cleanT = t.replace(/,/g, '');
            if (/^\d+(\.\d+)?$/.test(cleanT)) {
              allNumTokens.push(cleanT);
              allNumIndices.push(index);
            }
          });
          
          if (allNumTokens.length >= 2) {
            amountVal = cleanNumber(allNumTokens[allNumTokens.length - 1]);
            priceVal = cleanNumber(allNumTokens[allNumTokens.length - 2]);
            qtyVal = allNumTokens.length >= 3 ? cleanFloat(allNumTokens[allNumTokens.length - 3]) : Math.round(amountVal / (priceVal || 1));
            
            if (qtyVal > 0 && priceVal > 0 && amountVal > 0) {
              hasItem = true;
              nameEndIdx = allNumIndices[allNumIndices.length - (allNumTokens.length >= 3 ? 3 : 2)] - 1;
            }
          }
        }
        
        if (hasItem) {
          const nameTokens = tokens.slice(0, nameEndIdx + 1);
          
          // NO 열(번호)이 맨 앞에 있으면 제거
          if (nameTokens.length > 0 && /^\d+$/.test(nameTokens[0])) {
            nameTokens.shift();
          }
          // 품목코드(예: F247554)가 맨 앞에 있으면 제거
          if (nameTokens.length > 0 && /^[A-Z]\d{5,6}$/i.test(nameTokens[0])) {
            nameTokens.shift();
          }
          
          const name = nameTokens.join(" ").trim();
          if (name && name.length > 1 && !/^\d+$/.test(name)) {
            parsedItems.push({
              code: "OCR-" + Math.floor(Math.random() * 100000),
              name,
              qty: qtyVal,
              price: priceVal,
              amount: amountVal,
              unit: "EA",
              origin: "국내산"
            });
          }
        }
      }
    }

    return { bizNo, partnerName, invoiceDate, items: parsedItems };
  };

  const handleOcrMockFallback = (reason) => {
    console.warn("Fallback Triggered:", reason);
    const mockItems = [
      { code: "337940", name: "상하목장 요구르트(100ml_유기농 100g/EA)", qty: 190, price: 340, unit: "EA", origin: "국내산" },
      { code: "396562", name: "시투조아 카스테라단호박인절미", qty: 9, price: 14560, unit: "EA", origin: "국내산" },
      { code: "124171", name: "이츠웰 밀품은또띠아(6인치_12장 240g/EA)", qty: 42, price: 2750, unit: "EA", origin: "국내산" }
    ];

    setOcrRawText(`[OCR 판독 제한으로 예제 데이터가 로드되었습니다]\n사유: ${reason}\n\n씨제이프레시웨이주식회사\n603-81-11270\n상하목장 요구르트 190개 단가 340원 금액 64,600원\n시투조아 카스테라단호박인절미 9개 단가 14,560원 금액 131,040원`);
    setOcrCorrectPartner("씨제이프레시웨이주식회사");
    setOcrCorrectDate(new Date().toISOString().substring(0, 10));
    setOcrCorrectBizNo("603-81-11270");
    setOcrCorrectItems(mockItems.map(item => ({
      ...item,
      amount: item.qty * item.price
    })));
    setShowOcrModal(true);
  };

  // OCR 이미지 파일 인풋 핸들러
  const handleOcrFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // 이미지 파일 미리보기 설정
    const reader = new FileReader();
    reader.onload = (evt) => {
      setOcrPreviewUrl(evt.target.result);
    };
    reader.readAsDataURL(file);

    setOcrLoading(true);
    setOcrProgressText("고성능 클라우드 OCR 스캐닝 준비 중...");

    try {
      // 1. 우선 백엔드 Clova OCR API로 전송 시도
      const res = await ocrApi.scan(file);
      
      if (res.success && !res.fallback) {
        // 클라우드 고성능 판독 성공
        setOcrRawText(res.rawText);
        setOcrCorrectPartner(res.partnerName);
        setOcrCorrectDate(res.invoiceDate);
        setOcrCorrectBizNo(res.bizNo);
        setOcrCorrectItems(res.items);
        setShowOcrModal(true);
      } else {
        // 백엔드에 키가 없거나 실패하여 로컬 Tesseract.js 모드로 전환
        setOcrProgressText("서버 로컬 Tesseract.js 라이브러리 구동 중 (15% ~ 95%)...");
        const Tesseract = await loadTesseract();
        
        const result = await Tesseract.recognize(
          file,
          'kor+eng',
          { logger: m => {
            if (m.status === 'recognizing') {
              setOcrProgressText(`로컬 판독 진행 중... (${Math.round(m.progress * 100)}%)`);
            }
          }}
        );

        const text = result.data.text;
        const parsed = localParseOcrText(text);

        if (parsed.items.length === 0) {
          handleOcrMockFallback("로컬 문자는 분석했으나 품목 테이블 파싱에 실패하여 모의 양식을 띄웁니다.");
        } else {
          setOcrRawText(text);
          setOcrCorrectPartner(parsed.partnerName);
          setOcrCorrectDate(parsed.invoiceDate);
          setOcrCorrectBizNo(parsed.bizNo);
          setOcrCorrectItems(parsed.items);
          setShowOcrModal(true);
        }
      }
    } catch (err) {
      console.error(err);
      handleOcrMockFallback("스캔 통신 에러 발생. 샘플 데이터로 복구 모드에 진입합니다.");
    } finally {
      setOcrLoading(false);
      setOcrProgressText('');
      e.target.value = '';
    }
  };

  // OCR 교정 모달 내 인라인 수치 계산
  const handleOcrRowChange = (idx, field, value) => {
    const updated = [...ocrCorrectItems];
    const item = updated[idx];

    if (field === 'name') {
      item.name = value;
    } else if (field === 'qty') {
      item.qty = parseFloat(value) || 0;
    } else if (field === 'price') {
      item.price = parseInt(value, 10) || 0;
    }

    item.amount = Math.floor(item.qty * item.price);
    setOcrCorrectItems(updated);
  };

  const handleAddOcrRow = () => {
    const newItem = {
      code: "OCR-" + Math.floor(Math.random() * 100000),
      name: "새 품목",
      qty: 1,
      price: 0,
      amount: 0,
      unit: "EA",
      origin: "국내산"
    };
    setOcrCorrectItems([...ocrCorrectItems, newItem]);
  };

  const handleRemoveOcrRow = (idx) => {
    setOcrCorrectItems(ocrCorrectItems.filter((_, i) => i !== idx));
  };

  // 교정 모달 저장 적용 및 기초 사전 마스터 데이터베이스 자동 생성
  const handleApplyOcrCorrection = async () => {
    if (!ocrCorrectPartner) {
      alert("공급자 거래처명을 기재해 주세요.");
      return;
    }
    if (ocrCorrectItems.length === 0) {
      alert("반영할 품목이 하나 이상 필요합니다.");
      return;
    }

    // 1. 거래처 등록 여부 확인 및 자동 생성
    let partnerMeta = partners.find(p => p.name === ocrCorrectPartner || (ocrCorrectBizNo && p.biz_no === ocrCorrectBizNo));
    let newPartnerRegistered = false;

    if (!partnerMeta) {
      try {
        const res = await partnerApi.create({
          code: "P-OCR-" + Date.now().toString().slice(-4),
          name: ocrCorrectPartner,
          owner: "대표자",
          bizNo: ocrCorrectBizNo || "000-00-00000",
          address: "OCR 자동 추출 등록 주소",
          phone: "010-0000-0000",
          type: "매입처"
        });
        newPartnerRegistered = true;
      } catch (e) {
        console.error("Auto Partner registration fail:", e);
      }
    }

    // 2. 기초 품목 등록 여부 확인 및 상품 정보 자동 생성
    let newProductsRegistered = 0;
    const tempCart = [];

    for (const item of ocrCorrectItems) {
      let prod = products.find(p => p.name === item.name);
      if (!prod) {
        try {
          // 마크업 30% 마진율로 자동 책정
          const res = await productApi.create({
            code: "PRD-" + item.code,
            name: item.name,
            unit: item.unit || "EA",
            origin: item.origin || "국내산",
            purchasePrice: item.price,
            salesPrice: Math.floor(item.price * 1.3),
            taxType: "과세",
            stock: 0
          });
          newProductsRegistered++;
        } catch (e) {
          console.error("Auto Product registration fail:", e);
        }
      }

      const amount = Math.floor(item.qty * item.price);
      tempCart.push({
        name: item.name,
        unit: item.unit || "EA",
        origin: item.origin || "국내산",
        qty: item.qty,
        price: item.price,
        amount: amount,
        tax: 0,
        total: amount,
        isTaxApplied: false,
        taxType: "과세"
      });
    }

    // 3. 매입 카트 정보 교체
    setPurchaseCart(tempCart);
    setSelectedPartner(ocrCorrectPartner);
    setPurchaseDate(ocrCorrectDate);

    onDataChange(); // 부모 상태 리프레시
    setShowOcrModal(false);

    let alertMsg = `매입 카트에 OCR 분석 데이터가 정상 등록되었습니다!\n공급처: ${ocrCorrectPartner}\n총 품목 수: ${tempCart.length}건`;
    if (newPartnerRegistered) alertMsg += `\n- 신규 거래처가 자동 생성 등록되었습니다.`;
    if (newProductsRegistered > 0) alertMsg += `\n- 신규 기초 상품 ${newProductsRegistered}건이 사전에 자동 등록되었습니다.`;
    alert(alertMsg);
  };

  // ==========================================
  // 매입거래명세서 다중 페이지 A5 인쇄 Pagination 빌더
  // ==========================================
  const triggerPurchaseInvoicePrintDoc = (invoice) => {
    let hq = { hqName: "본사 사업소", owner: "대표자명", bizNo: "123-45-67890", address: "서울특별시 서초구", phone: "02-1234-5678" };
    const savedHq = localStorage.getItem('smart_erp_hq_info');
    if (savedHq) {
      try { hq = JSON.parse(savedHq); } catch(e) {}
    }
    const sealImg = localStorage.getItem('smart_erp_seal_image') || '';

    // 매입처 정보 로드
    const partner = partners.find(p => p.name === invoice.partner_name) || {
      name: invoice.partner_name,
      owner: "매입처대표",
      biz_no: "000-00-00000",
      address: "매입처 공급 주소",
      phone: "010-0000-0000"
    };

    const items = invoice.items || [];
    
    // Pagination: A5 용지 1페이지당 13행 수용
    const ITEMS_PER_PAGE = 13;
    const totalPages = Math.max(1, Math.ceil(items.length / ITEMS_PER_PAGE));
    let docHtml = "";

    for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
      const pageItems = items.slice(pageIdx * ITEMS_PER_PAGE, (pageIdx + 1) * ITEMS_PER_PAGE);
      
      const emptyRowCount = ITEMS_PER_PAGE - pageItems.length;
      const emptyRows = [];
      for (let i = 0; i < emptyRowCount; i++) {
        emptyRows.push({});
      }

      const prevItems = items.slice(0, pageIdx * ITEMS_PER_PAGE);
      const prevSum = prevItems.reduce((acc, curr) => acc + curr.total, 0);
      const currentPageSum = pageItems.reduce((acc, curr) => acc + curr.total, 0);
      const accumSum = prevSum + currentPageSum;

      docHtml += `
        <div class="print-page-wrapper" style="page-break-after: always; width: 210mm; height: 148mm; box-sizing: border-box; padding: 6mm; background: #fff; color: #000; font-family: 'Inter', 'Noto Sans KR', sans-serif; position: relative;">
          
          <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #000; padding-bottom: 4px; margin-bottom: 4px;">
            <div style="font-size: 1.6rem; font-weight: 900; letter-spacing: 2px;">매 입 거 래 명 세 서</div>
            <div style="font-size: 0.75rem; font-weight: bold;">[일련번호: PUR-${invoice.id}-${pageIdx+1}]</div>
          </div>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 6px; font-size: 0.7rem;">
            <tr>
              <!-- 공급자: 매입처 정보 (좌측) -->
              <td style="width: 50%; padding-right: 4px; vertical-align: top;">
                <table style="width: 100%; border-collapse: collapse; border: 1px solid #000;">
                  <tr style="background: #f0f0f0;">
                    <th colSpan="4" style="border-bottom: 1px solid #000; padding: 2px; text-align: center; font-weight: bold; font-size: 0.75rem;">공 급 자 (매입처)</th>
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

              <!-- 공급받는자: 본사 정보 (우측) -->
              <td style="width: 50%; padding-left: 4px; vertical-align: top;">
                <table style="width: 100%; border-collapse: collapse; border: 1px solid #000;">
                  <tr style="background: #f0f0f0;">
                    <th colSpan="4" style="border-bottom: 1px solid #000; padding: 2px; text-align: center; font-weight: bold; font-size: 0.75rem;">공급받는자 (본사)</th>
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
            </tr>
          </table>

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

          <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; font-size: 0.72rem; margin-bottom: 6px; text-align: center;">
            <tr style="background: #f0f0f0; border-bottom: 1px solid #000;">
              <td style="border: 1px solid #000; padding: 2px 4px; font-weight: bold; width: 14%; height: 17px;">거래 일자</td>
              <td style="border: 1px solid #000; padding: 2px 4px; font-weight: bold; width: 14%;">합계 공급가액</td>
              <td style="border: 1px solid #000; padding: 2px 4px; font-weight: bold; width: 14%;">합계 세액</td>
              <td style="border: 1px solid #000; padding: 2px 4px; font-weight: bold; width: 20%; background: #ffeded;" colSpan="2">페이지 총합계 (지출액)</td>
              <td style="border: 1px solid #000; padding: 2px 4px; font-weight: bold; width: 18%;">결제 구분</td>
              <td style="border: 1px solid #000; padding: 2px 4px; font-weight: bold; width: 20%; background: #fff3cd;">누적 총계</td>
            </tr>
            <tr style="height: 17px;">
              <td style="border: 1px solid #000; padding: 2px 4px; font-weight: bold;">${invoice.date}</td>
              <td style="border: 1px solid #000; padding: 2px 4px; font-family: monospace;">${formatNumber(invoice.total_amount)}</td>
              <td style="border: 1px solid #000; padding: 2px 4px; font-family: monospace;">${formatNumber(invoice.total_tax)}</td>
              <td style="border: 1px solid #000; padding: 2px 4px; font-family: monospace; font-weight: 900; font-size: 0.75rem; background: #ffeded;" colSpan="2">
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

          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.65rem; color: #333; margin-top: 4px;">
            <div>비고: 매입 정산용 원본 서류이며 내부 회계 기입 증빙 자료입니다.</div>
            <div style="font-weight: bold; background: #ddd; padding: 2px 8px; border-radius: 4px;">
              페이지: ${pageIdx + 1} / ${totalPages}
            </div>
          </div>
        </div>
      `;
    }

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

  const filteredPartners = partners.filter(p => p.type === '매입처' || p.type === '혼합');

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '20px', textAlign: 'left' }} className="responsive-split">
      {/* 좌측: 매입 거래 입력 카트 (글래스모피즘) */}
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: '0 0 4px 0', color: '#fff', fontSize: '1.15rem' }}>매입 거래 작성 카트</h3>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              납품처 자재 입고를 전표로 등록하고 발행합니다.
            </p>
          </div>
        </div>

        {/* OCR 파일 업로드 영역 */}
        <div style={{
          background: 'rgba(167, 139, 250, 0.04)',
          border: '2px dashed rgba(167, 139, 250, 0.25)',
          borderRadius: '10px',
          padding: '16px',
          textAlign: 'center',
          cursor: ocrLoading ? 'not-allowed' : 'pointer',
          position: 'relative'
        }}
        onClick={() => !ocrLoading && document.getElementById('ocr-scan-input').click()}
        >
          {ocrLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '8px 0' }}>
              <Loader2 className="spin-icon" size={24} style={{ color: 'var(--primary-color)', animation: 'spin 1.5s linear infinite' }} />
              <div style={{ fontSize: '0.8rem', color: '#fff', fontWeight: 600 }}>{ocrProgressText}</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <Image size={24} style={{ color: 'var(--primary-color)' }} />
              <div style={{ fontSize: '0.8rem', color: '#fff', fontWeight: 'bold' }}>명세서 사진/스캔 OCR 분석</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>스캔본 업로드 시 실제 한글/숫자 실시간 기입 지원</div>
            </div>
          )}
          <input
            type="file"
            id="ocr-scan-input"
            accept="image/*"
            style={{ display: 'none' }}
            disabled={ocrLoading}
            onChange={handleOcrFileChange}
          />
        </div>

        {/* 공급자 및 날짜 설정 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div className="form-group">
            <label>공급자 (매입처)</label>
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
            <label>매입 일자</label>
            <input
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              required
            />
          </div>
        </div>

        {/* 품목 수동 추가 폼 */}
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
            <label>매입 상품 선택</label>
            <select value={selectedProduct} onChange={handleProductChange}>
              <option value="">-- 상품 검색/선택 --</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} (재고: {p.stock} {p.unit} | 단가: {formatNumber(p.purchase_price)}원)
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label>매입 수량</label>
              <input
                type="number"
                min="0.1"
                step="any"
                value={qty}
                onChange={(e) => setQty(parseFloat(e.target.value) || 1)}
              />
            </div>
            <div className="form-group">
              <label>매입 단가 (원)</label>
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

        {/* 카트 목록 테이블 */}
        <div>
          <label style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
            선택된 매입 품목 ({purchaseCart.length}건)
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
                {purchaseCart.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                      매입 카트가 비어 있습니다.
                    </td>
                  </tr>
                ) : (
                  purchaseCart.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', height: '32px' }}>
                      <td style={{ padding: '2px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={item.isTaxApplied}
                          disabled={item.taxType === '면세'}
                          onChange={() => handleToggleItemTax(idx)}
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

        {/* 실시간 회계 요약 */}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '8px', fontSize: '1rem' }}>
            <span style={{ color: 'var(--primary-color)', fontWeight: 'bold' }}>총인수액</span>
            <span style={{ fontFamily: 'monospace', fontWeight: '900', color: '#fff' }}>{formatNumber(totals.total)}원</span>
          </div>
        </div>

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
            매입 전표 발행 및 저장
          </button>
        </div>
      </div>

      {/* 우측: 매입 전표 목록 조회 그리드 */}
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
            매입 전표 원장 대장
          </h3>
          <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            입고 명세서를 확인하고 재출력(A5 Pagination 인쇄)을 지시합니다.
          </p>
        </div>

        <div style={{ maxHeight: '520px', overflowY: 'auto' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.03)', position: 'sticky', top: 0, zIndex: 1 }}>
                <th style={{ padding: '10px 8px', borderBottom: '1px solid rgba(255,255,255,0.08)', width: '90px' }}>일자</th>
                <th style={{ padding: '10px 8px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>공급처</th>
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
                    등록된 매입거래 명세표 정보가 존재하지 않습니다.
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
                          onClick={() => triggerPurchaseInvoicePrintDoc(inv)}
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

      {/* 전표 상세 모달 */}
      {showDetailModal && selectedInvoiceDetail && (
        <div className="modal-overlay active" style={{ display: 'flex' }} onClick={() => setShowDetailModal(false)}>
          <div className="modal-content" style={{ maxWidth: '650px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>매입 전표 상세 내역 [PUR-{selectedInvoiceDetail.id}]</h3>
              <button type="button" className="modal-close-btn" onClick={() => setShowDetailModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body" style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '6px' }}>
                <div><strong>공급처:</strong> {selectedInvoiceDetail.partner_name}</div>
                <div><strong>매입일자:</strong> {selectedInvoiceDetail.date}</div>
                <div><strong>상태:</strong> {selectedInvoiceDetail.status}</div>
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
                  triggerPurchaseInvoicePrintDoc(selectedInvoiceDetail);
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

      {/* OCR 수동 교정 모달 */}
      {showOcrModal && (
        <div className="modal-overlay active" style={{ display: 'flex' }}>
          <div className="modal-content" style={{ maxWidth: '900px', width: '90%' }}>
            <div className="modal-header">
              <h3>OCR 납품서 판독 데이터 수동 교정</h3>
              <button type="button" className="modal-close-btn" onClick={() => setShowOcrModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body responsive-split" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px', marginTop: '16px', textAlign: 'left' }}>
              {/* 좌측: 판독된 원문 텍스트 (참고용) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontWeight: 'bold', color: '#a8e6cf', fontSize: '0.85rem' }}>판독된 원문 텍스트 (참고용)</label>
                <textarea
                  value={ocrRawText}
                  readOnly
                  style={{
                    width: '100%',
                    height: '350px',
                    background: 'rgba(0,0,0,0.3)',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.15)',
                    padding: '8px',
                    borderRadius: '4px',
                    fontFamily: 'monospace',
                    fontSize: '0.75rem',
                    resize: 'none'
                  }}
                />
              </div>

              {/* 우측: 인식/파싱되어 등록될 품목 수정 테이블 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowX: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontWeight: 'bold', color: '#a8e6cf', fontSize: '0.85rem' }}>매입 카트 기입 데이터 검증</label>
                  <button type="button" className="btn" style={{ padding: '4px 8px', fontSize: '0.75rem', background: 'rgba(167,139,250,0.2)', color: 'var(--primary-color)' }} onClick={handleAddOcrRow}>
                    + 행 추가
                  </button>
                </div>
                
                <div style={{ maxHeight: '230px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.05)', height: '28px' }}>
                        <th style={{ padding: '6px', textAlign: 'left' }}>품목명</th>
                        <th style={{ padding: '6px', textAlign: 'center', width: '60px' }}>수량</th>
                        <th style={{ padding: '6px', textAlign: 'right', width: '80px' }}>단가</th>
                        <th style={{ padding: '6px', textAlign: 'right', width: '90px' }}>공급가액</th>
                        <th style={{ padding: '6px', textAlign: 'center', width: '50px' }}>작업</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ocrCorrectItems.map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', height: '32px' }}>
                          <td style={{ padding: '4px' }}>
                            <input
                              type="text"
                              value={item.name}
                              onChange={(e) => handleOcrRowChange(idx, 'name', e.target.value)}
                              style={{ width: '100%', padding: '4px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '4px' }}
                            />
                          </td>
                          <td style={{ padding: '4px' }}>
                            <input
                              type="number"
                              value={item.qty}
                              step="any"
                              onChange={(e) => handleOcrRowChange(idx, 'qty', e.target.value)}
                              style={{ width: '100%', padding: '4px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '4px', textAlign: 'center' }}
                            />
                          </td>
                          <td style={{ padding: '4px' }}>
                            <input
                              type="number"
                              value={item.price}
                              onChange={(e) => handleOcrRowChange(idx, 'price', e.target.value)}
                              style={{ width: '100%', padding: '4px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '4px', textAlign: 'right' }}
                            />
                          </td>
                          <td style={{ padding: '4px', textAlign: 'right', fontFamily: 'monospace' }}>
                            {formatNumber(item.amount)}
                          </td>
                          <td style={{ padding: '4px', textAlign: 'center' }}>
                            <button type="button" className="btn btn-danger" style={{ padding: '2px 6px', fontSize: '0.7rem' }} onClick={() => handleRemoveOcrRow(idx)}>
                              삭제
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '8px' }}>
                  <div className="form-group">
                    <label>공급자 상호</label>
                    <input
                      type="text"
                      value={ocrCorrectPartner}
                      onChange={(e) => setOcrCorrectPartner(e.target.value)}
                      style={{ padding: '6px', fontSize: '0.8rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', borderRadius: '4px' }}
                    />
                  </div>
                  <div className="form-group">
                    <label>거래 일자</label>
                    <input
                      type="date"
                      value={ocrCorrectDate}
                      onChange={(e) => setOcrCorrectDate(e.target.value)}
                      style={{ padding: '6px', fontSize: '0.8rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', borderRadius: '4px' }}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              <button type="button" className="btn" style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }} onClick={() => setShowOcrModal(false)}>취소</button>
              <button type="button" className="btn btn-primary" onClick={handleApplyOcrCorrection}>매입 카트에 최종 반영 및 저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
