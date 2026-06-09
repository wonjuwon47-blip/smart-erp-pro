import React, { useState, useEffect } from 'react';
import { estimateApi, hqApi, productApi } from '../services/api';
import { Plus, Trash2, Printer, Save, X, Search } from 'lucide-react';

export default function EstimatesManagement({ products }) {
  const [estCart, setEstCart] = useState([]);
  const [estDate, setEstDate] = useState(new Date().toISOString().substring(0, 10));
  const [estReceiver, setEstReceiver] = useState('');
  const [estRef, setEstRef] = useState('');
  const [estReceiverPhone, setEstReceiverPhone] = useState('');
  
  // 견적 일련번호 자동 생성
  const generateSerial = () => {
    return Math.floor(Math.random() * 1000) + "-" + Math.floor(Math.random() * 1000);
  };
  const [estSerial, setEstSerial] = useState(generateSerial());

  // 공급자 정보 (기본 활성 본사)
  const [supplierName, setSupplierName] = useState('');
  const [supplierBizNo, setSupplierBizNo] = useState('');
  const [supplierOwner, setSupplierOwner] = useState('');
  const [supplierAddress, setSupplierAddress] = useState('');
  const [supplierBizType, setSupplierBizType] = useState('도소매');
  const [supplierBizItem, setSupplierBizItem] = useState('농수산물');
  const [supplierManager, setSupplierManager] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');

  // 신규 품목 추가 입력
  const [selectedProduct, setSelectedProduct] = useState('');
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState(0);
  const [unit, setUnit] = useState('BOX');
  const [type, setType] = useState('EA');

  // 견적서 리스트
  const [estimateList, setEstimateList] = useState([]);
  const [loading, setLoading] = useState(false);

  // 수정 중인 견적서 ID
  const [editingId, setEditingId] = useState(null);

  // 상세 보기 모달
  const [detailEst, setDetailEst] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  useEffect(() => {
    fetchEstimates();
    loadDefaultSupplier();
  }, []);

  const fetchEstimates = async () => {
    setLoading(true);
    try {
      const data = await estimateApi.getAll();
      setEstimateList(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadDefaultSupplier = async () => {
    try {
      const hqs = await hqApi.getAll();
      // 설정 테이블에서 활성 본사ID를 조회하는 대신 첫 번째 본사를 공급자 디폴트 값으로 Prefill
      if (hqs && hqs.length > 0) {
        const hq = hqs[0];
        setSupplierName(hq.name);
        setSupplierBizNo(hq.reg_no);
        setSupplierOwner(hq.owner);
        setSupplierAddress(hq.address);
        setSupplierPhone(hq.phone);
        if (hq.business) {
          const parts = hq.business.split('/');
          setSupplierBizType(parts[0] ? parts[0].trim() : '도소매');
          setSupplierBizItem(parts[1] ? parts[1].trim() : '농수산물');
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('ko-KR').format(num || 0);
  };

  // 숫자를 한글 금액 한자 표기로 변환 (예: 12000 -> 일금 일만이천 원정)
  const numToKorean = (num) => {
    if (num === 0 || !num) return "일금 영 원정";
    const units = ["", "십", "백", "천"];
    const bigUnits = ["", "만", "억", "조", "경"];
    const digits = ["", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];
    
    let result = "";
    let parts = [];
    
    let strNum = String(num);
    while (strNum.length > 0) {
      parts.push(strNum.slice(-4));
      strNum = strNum.slice(0, -4);
    }
    
    for (let i = 0; i < parts.length; i++) {
      let partNum = parts[i];
      let partResult = "";
      for (let j = 0; j < partNum.length; j++) {
        let digit = Number(partNum[partNum.length - 1 - j]);
        if (digit !== 0) {
          let digitWord = (digit === 1 && j > 0) ? "" : digits[digit];
          partResult = digitWord + units[j] + partResult;
        }
      }
      if (partResult !== "") {
        result = partResult + bigUnits[i] + result;
      }
    }
    return "일금 " + result + " 원정";
  };

  const handleProductChange = (e) => {
    const prodId = e.target.value;
    setSelectedProduct(prodId);
    if (!prodId) {
      setPrice(0);
      setUnit('BOX');
      return;
    }
    const prod = products.find(p => p.id === parseInt(prodId, 10));
    if (prod) {
      setPrice(prod.sales_price || 0);
      setUnit(prod.unit || 'BOX');
    }
  };

  const handleAddCartItem = (e) => {
    e.preventDefault();
    if (!selectedProduct) return;
    const prod = products.find(p => p.id === parseInt(selectedProduct, 10));
    if (!prod) return;

    // 카트 중복 검사
    if (estCart.some(item => item.name === prod.name)) {
      alert("이미 추가된 상품입니다.");
      return;
    }

    const amount = Math.floor(qty * price);
    const tax = Math.floor(amount * 0.1); // 견적서는 통상 10% 일괄 과세 적용
    const total = amount + tax;

    const newItem = {
      name: prod.name,
      unit: unit,
      type: type,
      qty: parseFloat(qty) || 1,
      price: parseInt(price, 10) || 0,
      amount,
      tax,
      total
    };

    setEstCart([...estCart, newItem]);
    setSelectedProduct('');
    setQty(1);
    setPrice(0);
  };

  const handleCartItemChange = (idx, field, value) => {
    const updated = [...estCart];
    const item = updated[idx];
    if (field === 'qty') {
      item.qty = parseFloat(value) || 0;
    } else if (field === 'price') {
      item.price = parseInt(value, 10) || 0;
    } else if (field === 'unit') {
      item.unit = value;
    } else if (field === 'type') {
      item.type = value;
    }

    item.amount = Math.floor(item.qty * item.price);
    item.tax = Math.floor(item.amount * 0.1);
    item.total = item.amount + item.tax;
    setEstCart(updated);
  };

  const handleRemoveCartItem = (idx) => {
    setEstCart(estCart.filter((_, i) => i !== idx));
  };

  const getCartTotals = () => {
    let amount = 0;
    let tax = 0;
    let total = 0;
    estCart.forEach(item => {
      amount += item.amount;
      tax += item.tax;
      total += item.total;
    });
    return { amount, tax, total };
  };

  const totals = getCartTotals();

  // 견적서 저장 로직
  const handleSaveEstimate = async (shouldPrint = false) => {
    if (!estReceiver) {
      alert("수신처명을 입력해 주세요.");
      return;
    }
    if (estCart.length === 0) {
      alert("견적 카트가 비어있습니다.");
      return;
    }

    const payload = {
      id: estSerial,
      date: estDate,
      receiver: estReceiver,
      ref: estRef,
      receiverPhone: estReceiverPhone,
      supplier: {
        name: supplierName,
        bizNo: supplierBizNo,
        owner: supplierOwner,
        address: supplierAddress,
        bizType: supplierBizType,
        bizItem: supplierBizItem,
        manager: supplierManager,
        phone: supplierPhone
      },
      items: estCart,
      totalAmount: totals.amount,
      totalTax: totals.tax,
      totalSum: totals.total
    };

    try {
      if (editingId) {
        await estimateApi.update(editingId, payload);
        alert("견적서가 성공적으로 수정 저장되었습니다.");
        setEditingId(null);
      } else {
        await estimateApi.create(payload);
        alert("견적서가 성공적으로 저장되었습니다.");
      }

      // 인쇄 호출
      if (shouldPrint) {
        // 백엔드 데이터에 맞춘 구조 변형 (인쇄 모듈용)
        triggerEstimatePrintDoc({
          id: estSerial,
          date: estDate,
          receiver: estReceiver,
          ref: estRef,
          receiver_phone: estReceiverPhone,
          supplier_name: supplierName,
          supplier_bizno: supplierBizNo,
          supplier_owner: supplierOwner,
          supplier_address: supplierAddress,
          supplier_biztype: supplierBizType,
          supplier_bizitem: supplierBizItem,
          supplier_manager: supplierManager,
          supplier_phone: supplierPhone,
          items: estCart,
          total_amount: totals.amount,
          total_tax: totals.tax,
          total_sum: totals.total
        });
      }

      // 장바구니 리셋
      setEstCart([]);
      setEstReceiver('');
      setEstRef('');
      setEstReceiverPhone('');
      setEstSerial(generateSerial());
      fetchEstimates();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || "견적서 저장 도중 오류가 발생했습니다.");
    }
  };

  const handleEditEstimate = (est) => {
    setEditingId(est.id);
    setEstSerial(est.id);
    setEstDate(est.date);
    setEstReceiver(est.receiver);
    setEstRef(est.ref);
    setEstReceiverPhone(est.receiver_phone);
    setSupplierName(est.supplier_name);
    setSupplierBizNo(est.supplier_bizno);
    setSupplierOwner(est.supplier_owner);
    setSupplierAddress(est.supplier_address);
    setSupplierBizType(est.supplier_biztype);
    setSupplierBizItem(est.supplier_bizitem);
    setSupplierManager(est.supplier_manager);
    setSupplierPhone(est.supplier_phone);

    // 하위 품목 로드
    const tempCart = est.items.map(item => ({
      name: item.name,
      unit: item.unit,
      type: item.type,
      qty: parseFloat(item.qty),
      price: parseInt(item.price),
      amount: parseInt(item.amount),
      tax: parseInt(item.tax),
      total: parseInt(item.total)
    }));
    setEstCart(tempCart);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEstCart([]);
    setEstReceiver('');
    setEstRef('');
    setEstReceiverPhone('');
    setEstSerial(generateSerial());
    loadDefaultSupplier();
  };

  const handleDeleteEstimate = async (id) => {
    if (!confirm("해당 견적서 발행 이력을 영구 삭제하시겠습니까?")) return;
    try {
      await estimateApi.delete(id);
      alert("삭제되었습니다.");
      fetchEstimates();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDetailClick = async (id) => {
    try {
      const detail = await estimateApi.getById(id);
      setDetailEst(detail);
      setShowDetailModal(true);
    } catch (err) {
      console.error(err);
      alert("견적 상세 내역을 가져오지 못했습니다.");
    }
  };

  // ==========================================
  // 견적서 전용 A5 용지 인쇄 Layout 빌더
  // ==========================================
  const triggerEstimatePrintDoc = (est) => {
    // 인쇄 규격 및 세부 여백 로드
    const savedSettings = localStorage.getItem('smart_erp_print_settings');
    let printSettings = { paperSize: 'A5', marginTop: 6, marginLeft: 6, fontSize: 0.72, logoText: '견 적 서' };
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        printSettings = {
          paperSize: parsed.paperSize || 'A5',
          marginTop: parsed.marginTop || 6,
          marginLeft: parsed.marginLeft || 6,
          fontSize: parsed.fontSize || 0.72,
          logoText: parsed.logoText || '견 적 서'
        };
      } catch (e) {}
    }

    const sealImg = localStorage.getItem('smart_erp_seal_image') || '';
    const printArea = document.getElementById("print-document-area");
    if (!printArea) {
      alert("인쇄 컨테이너를 찾을 수 없습니다.");
      return;
    }

    const items = est.items || [];
    const maxRows = 10;
    const totalPages = Math.max(1, Math.ceil(items.length / maxRows));
    let docHtml = "";

    const totalKorean = numToKorean(est.total_sum);

    for (let page = 0; page < totalPages; page++) {
      const pageItems = items.slice(page * maxRows, (page + 1) * maxRows);
      const emptyRowCount = maxRows - pageItems.length;

      let itemsHtml = pageItems.map((item, idx) => {
        const globalIdx = page * maxRows + idx + 1;
        return `
          <tr style="height: 22px; border-bottom: 1px solid #000;">
            <td style="border: 1px solid #000; padding: 2px; text-align: center;">${globalIdx}</td>
            <td style="border: 1px solid #000; padding: 2px 4px; font-weight: bold; text-align: left;">${item.name}</td>
            <td style="border: 1px solid #000; padding: 2px; text-align: center;">${item.unit || 'BOX'}</td>
            <td style="border: 1px solid #000; padding: 2px; text-align: center;">${item.type || 'EA'}</td>
            <td style="border: 1px solid #000; padding: 2px; text-align: center; font-family: monospace;">${item.qty}</td>
            <td style="border: 1px solid #000; padding: 2px 4px; text-align: right; font-family: monospace;">${formatNumber(item.price)}</td>
            <td style="border: 1px solid #000; padding: 2px 4px; text-align: right; font-family: monospace; font-weight: bold;">${formatNumber(item.amount)}</td>
            <td style="border: 1px solid #000; padding: 2px 4px; text-align: right; font-family: monospace;">${formatNumber(item.tax)}</td>
            <td style="border: 1px solid #000; padding: 2px;"></td>
          </tr>
        `;
      }).join("");

      // 이하 여백
      if (page === totalPages - 1 && emptyRowCount > 0) {
        itemsHtml += `
          <tr style="height: 22px; border-bottom: 1px solid #000; color: #777;">
            <td style="border: 1px solid #000; padding: 2px; text-align: center;">${pageItems.length + 1}</td>
            <td style="border: 1px solid #000; padding: 2px 4px; font-style: italic; text-align: left;">=====이하여백=====</td>
            <td style="border: 1px solid #000; padding: 2px;"></td>
            <td style="border: 1px solid #000; padding: 2px;"></td>
            <td style="border: 1px solid #000; padding: 2px;"></td>
            <td style="border: 1px solid #000; padding: 2px;"></td>
            <td style="border: 1px solid #000; padding: 2px;"></td>
            <td style="border: 1px solid #000; padding: 2px;"></td>
            <td style="border: 1px solid #000; padding: 2px;"></td>
          </tr>
        `;
        // 나머지 빈 줄 채우기
        for (let i = 1; i < emptyRowCount; i++) {
          itemsHtml += `
            <tr style="height: 22px; border-bottom: 1px solid #000;">
              <td style="border: 1px solid #000; padding: 2px; text-align: center; color: #ccc;">${pageItems.length + i + 1}</td>
              <td style="border: 1px solid #000; padding: 2px;"></td>
              <td style="border: 1px solid #000; padding: 2px;"></td>
              <td style="border: 1px solid #000; padding: 2px;"></td>
              <td style="border: 1px solid #000; padding: 2px;"></td>
              <td style="border: 1px solid #000; padding: 2px;"></td>
              <td style="border: 1px solid #000; padding: 2px;"></td>
              <td style="border: 1px solid #000; padding: 2px;"></td>
              <td style="border: 1px solid #000; padding: 2px;"></td>
            </tr>
          `;
        }
      } else {
        // 전체 빈 칸
        for (let i = 0; i < emptyRowCount; i++) {
          itemsHtml += `
            <tr style="height: 22px; border-bottom: 1px solid #000;">
              <td style="border: 1px solid #000; padding: 2px; text-align: center; color: #ccc;">${pageItems.length + i + 1}</td>
              <td style="border: 1px solid #000; padding: 2px;"></td>
              <td style="border: 1px solid #000; padding: 2px;"></td>
              <td style="border: 1px solid #000; padding: 2px;"></td>
              <td style="border: 1px solid #000; padding: 2px;"></td>
              <td style="border: 1px solid #000; padding: 2px;"></td>
              <td style="border: 1px solid #000; padding: 2px;"></td>
              <td style="border: 1px solid #000; padding: 2px;"></td>
              <td style="border: 1px solid #000; padding: 2px;"></td>
            </tr>
          `;
        }
      }

      docHtml += `
        <div class="print-page-wrapper" style="
          page-break-after: always;
          width: ${printSettings.paperSize === 'A4' ? '297mm' : '210mm'};
          height: ${printSettings.paperSize === 'A4' ? '210mm' : '148mm'};
          box-sizing: border-box;
          padding-top: ${printSettings.marginTop}mm;
          padding-bottom: ${printSettings.marginTop}mm;
          padding-left: ${printSettings.marginLeft}mm;
          padding-right: ${printSettings.marginLeft}mm;
          background: #fff;
          color: #000;
          font-family: 'Inter', 'Noto Sans KR', sans-serif;
          position: relative;
          font-size: ${printSettings.fontSize}rem;
        ">
          
          <div style="text-align: center; font-size: 1.6rem; font-weight: 900; letter-spacing: 12px; margin-bottom: 8px;">${printSettings.logoText}</div>
          
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px; gap: 10px;">
            <!-- 수신자 정보 -->
            <div style="width: 45%; line-height: 1.4; border-bottom: 1px solid #000; padding-bottom: 4px;">
              <div style="border-bottom: 1px solid #ddd; padding: 2px 0;"><strong>일련번호 :</strong> &nbsp;${est.id}</div>
              <div style="border-bottom: 1px solid #ddd; padding: 2px 0; font-size: 0.85rem; font-weight: bold;"><strong>귀&nbsp;&nbsp;&nbsp;&nbsp;하 :</strong> &nbsp;${est.receiver} 귀하</div>
              <div style="border-bottom: 1px solid #ddd; padding: 2px 0;"><strong>참&nbsp;&nbsp;&nbsp;&nbsp;조 :</strong> &nbsp;${est.ref || ''}</div>
              <div style="border-bottom: 1px solid #ddd; padding: 2px 0;"><strong>연락처 :</strong> &nbsp;${est.receiver_phone || ''}</div>
              <div style="padding: 2px 0;"><strong>견적일자 :</strong> &nbsp;${est.date.replace(/-/g, '년 ').substring(0, 11)}일</div>
              <div style="font-size: 0.8rem; font-weight: bold; margin-top: 6px; color: #333;">아래와 같이 견적합니다.</div>
            </div>

            <!-- 공급자 정보 -->
            <div style="width: 53%;">
              <table style="width: 100%; border-collapse: collapse; border: 1.5px solid #000; font-size: 0.65rem; text-align: left;">
                <tr style="height: 18px;">
                  <td rowspan="4" style="width: 16px; text-align: center; font-weight: bold; background: #f2f2f2; border: 1px solid #000; line-height: 1.2; letter-spacing: 1px;">공<br>급<br>자</td>
                  <td style="background: #f2f2f2; font-weight: bold; text-align: center; width: 50px; border: 1px solid #000; padding: 2px;">상호(법인)</td>
                  <td style="border: 1px solid #000; padding: 2px; font-weight: bold;">${est.supplier_name}</td>
                  <td style="background: #f2f2f2; font-weight: bold; text-align: center; width: 45px; border: 1px solid #000; padding: 2px;">대표자</td>
                  <td style="border: 1px solid #000; padding: 2px; text-align: center; position: relative; font-weight: bold;">
                    ${est.supplier_owner}
                    ${sealImg ? `
                      <img src="${sealImg}" style="position: absolute; width: 28px; height: 28px; right: 2px; top: 50%; transform: translateY(-50%); opacity: 0.85;" />
                    ` : `
                      <span style="color: red; font-weight: bold; border: 1px solid red; border-radius: 50%; padding: 1px 2px; font-size: 0.55rem; position: absolute; right: 4px; top: 50%; transform: translateY(-50%); scale: 0.85;">인</span>
                    `}
                  </td>
                </tr>
                <tr style="height: 18px;">
                  <td style="background: #f2f2f2; font-weight: bold; text-align: center; border: 1px solid #000; padding: 2px;">등록번호</td>
                  <td colspan="3" style="border: 1px solid #000; padding: 2px; font-family: monospace; font-weight: bold; font-size: 0.72rem;">${est.supplier_bizno}</td>
                </tr>
                <tr style="height: 18px;">
                  <td style="background: #f2f2f2; font-weight: bold; text-align: center; border: 1px solid #000; padding: 2px;">사업소주소</td>
                  <td colspan="3" style="border: 1px solid #000; padding: 2px; font-size: 0.6rem;">${est.supplier_address}</td>
                </tr>
                <tr style="height: 18px;">
                  <td style="background: #f2f2f2; font-weight: bold; text-align: center; border: 1px solid #000; padding: 2px;">업태/종목</td>
                  <td style="border: 1px solid #000; padding: 2px;">${est.supplier_biztype}</td>
                  <td style="background: #f2f2f2; font-weight: bold; text-align: center; border: 1px solid #000; padding: 2px;">담당자</td>
                  <td style="border: 1px solid #000; padding: 2px;">${est.supplier_manager} (${est.supplier_phone || ''})</td>
                </tr>
              </table>
            </div>
          </div>

          <!-- 합계 금액 바 -->
          <div style="display: flex; justify-content: space-between; align-items: center; border: 1.5px solid #000; background: #f8fafc; padding: 4px 10px; font-size: 0.8rem; font-weight: bold; margin-bottom: 6px;">
            <span>합 계 금 액</span>
            <span style="letter-spacing: 1px;">${totalKorean}</span>
            <span style="font-family: monospace;">(\\ ${formatNumber(est.total_sum)} 원정 - 부가세 포함)</span>
          </div>

          <!-- 견적 품목 표 -->
          <table style="width: 100%; border-collapse: collapse; border: 1.5px solid #000; font-size: 0.68rem; text-align: center; margin-bottom: 6px;">
            <thead>
              <tr style="background: #f2f2f2; font-weight: bold; height: 22px;">
                <th style="border: 1px solid #000; width: 5%;">No</th>
                <th style="border: 1px solid #000; width: 35%; text-align: left; padding-left: 4px;">품명 및 규격</th>
                <th style="border: 1px solid #000; width: 8%;">단위</th>
                <th style="border: 1px solid #000; width: 8%;">구분</th>
                <th style="border: 1px solid #000; width: 8%;">수량</th>
                <th style="border: 1px solid #000; width: 11%; text-align: right; padding-right: 4px;">단가</th>
                <th style="border: 1px solid #000; width: 13%; text-align: right; padding-right: 4px;">공급가액</th>
                <th style="border: 1px solid #000; width: 10%; text-align: right; padding-right: 4px;">세액</th>
                <th style="border: 1px solid #000; width: 5%;">비고</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
              <!-- 합계 행 -->
              <tr style="background: #f8fafc; font-weight: bold; height: 22px; border-top: 1.5px solid #000;">
                <td colspan="2" style="border: 1px solid #000; text-align: center;">소 계 (합 계)</td>
                <td style="border: 1px solid #000;"></td>
                <td style="border: 1px solid #000;"></td>
                <td style="border: 1px solid #000;"></td>
                <td style="border: 1px solid #000;"></td>
                <td style="border: 1px solid #000; text-align: right; padding-right: 4px; font-family: monospace;">${formatNumber(est.total_amount)}</td>
                <td style="border: 1px solid #000; text-align: right; padding-right: 4px; font-family: monospace;">${formatNumber(est.total_tax)}</td>
                <td style="border: 1px solid #000; font-family: monospace; font-size: 0.6rem;">${page + 1}/${totalPages}</td>
              </tr>
            </tbody>
          </table>

          <!-- 하단 유의 사항 -->
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.6rem; color: #555; margin-top: 4px;">
            <div>* 본 견적서의 유효기간은 발행일로부터 15일간입니다.</div>
            <div style="font-weight: bold; background: #e2e8f0; padding: 1px 6px; border-radius: 4px;">Smart ERP Quotation System</div>
          </div>
        </div>
      `;
    }

    printArea.innerHTML = docHtml;
    setTimeout(() => {
      window.print();
    }, 300);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '20px', textAlign: 'left' }} className="responsive-split">
      {/* 좌측: 견적서 작성 카트 (글래스모피즘) */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.02)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: '12px',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        alignSelf: 'start'
      }}>
        <div>
          <h3 style={{ margin: '0 0 4px 0', color: '#fff', fontSize: '1.15rem' }}>
            {editingId ? '견적서 수정 모드' : '견적서 작성 카트'}
          </h3>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            견적 항목을 카트에 담아 신규 견적서를 저장 및 인쇄합니다.
          </p>
        </div>

        {/* 수신인 및 견적일자 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label>견적 일련번호</label>
              <input type="text" readOnly value={estSerial} style={{ background: 'rgba(0,0,0,0.3)', color: '#a78bfa', fontWeight: 'bold' }} />
            </div>
            <div className="form-group">
              <label>견적 발행 일자</label>
              <input type="date" value={estDate} onChange={e => setEstDate(e.target.value)} required />
            </div>
          </div>
          <div className="form-group">
            <label>수신인 (상호/성명)</label>
            <input type="text" value={estReceiver} onChange={e => setEstReceiver(e.target.value)} placeholder="이마트 가락점 귀하" required />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label>참조</label>
              <input type="text" value={estRef} onChange={e => setEstRef(e.target.value)} placeholder="구매담당자" />
            </div>
            <div className="form-group">
              <label>수신처 연락처</label>
              <input type="text" value={estReceiverPhone} onChange={e => setEstReceiverPhone(e.target.value)} placeholder="010-0000-0000" />
            </div>
          </div>
        </div>

        {/* 공급자 정보 확인/보정 */}
        <div style={{ background: 'rgba(0,0,0,0.15)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)', fontSize: '0.8rem' }}>
          <label style={{ fontWeight: 'bold', color: 'var(--primary-color)', display: 'block', marginBottom: '8px' }}>공급자 정보 확인 (본사 데이터)</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>상호: <input type="text" value={supplierName} onChange={e => setSupplierName(e.target.value)} style={{ padding: '2px 4px', fontSize: '0.75rem', width: '100px' }} /></div>
            <div>대표: <input type="text" value={supplierOwner} onChange={e => setSupplierOwner(e.target.value)} style={{ padding: '2px 4px', fontSize: '0.75rem', width: '70px' }} /></div>
          </div>
        </div>

        {/* 견적 상품 입력 */}
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
            <label>상품 검색 및 선택</label>
            <select value={selectedProduct} onChange={handleProductChange}>
              <option value="">-- 견적 대상 상품 --</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name} (단가: {formatNumber(p.sales_price)}원)</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label>견적 수량</label>
              <input type="number" min="0.1" step="any" value={qty} onChange={e => setQty(parseFloat(e.target.value) || 1)} />
            </div>
            <div className="form-group">
              <label>견적 단가 (원)</label>
              <input type="number" min="0" value={price} onChange={e => setPrice(parseInt(e.target.value, 10) || 0)} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label>규격 (예: BOX, EA)</label>
              <input type="text" value={unit} onChange={e => setUnit(e.target.value)} placeholder="BOX" />
            </div>
            <div className="form-group">
              <label>단위 (예: EA, 벌, 개)</label>
              <input type="text" value={type} onChange={e => setType(e.target.value)} placeholder="벌" />
            </div>
          </div>

          <button type="submit" className="btn" style={{
            background: 'rgba(167, 139, 250, 0.2)',
            color: 'var(--primary-color)',
            border: '1px solid rgba(167, 139, 250, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}>
            <Plus size={16} />
            카트에 견적 추가
          </button>
        </form>

        {/* 카트 목록 */}
        <div>
          <label style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
            견적 카트 품목 ({estCart.length}건)
          </label>
          <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.05)', height: '24px' }}>
                  <th style={{ padding: '4px', textAlign: 'left' }}>품목명</th>
                  <th style={{ padding: '4px', textAlign: 'center', width: '40px' }}>수량</th>
                  <th style={{ padding: '4px', textAlign: 'right', width: '70px' }}>금액</th>
                  <th style={{ padding: '4px', textAlign: 'center', width: '40px' }}>작업</th>
                </tr>
              </thead>
              <tbody>
                {estCart.length === 0 ? (
                  <tr><td colSpan="4" style={{ padding: '15px 0', textAlign: 'center', color: 'var(--text-muted)' }}>카트가 비었습니다.</td></tr>
                ) : (
                  estCart.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', height: '30px' }}>
                      <td style={{ padding: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</td>
                      <td style={{ padding: '2px' }}>
                        <input type="number" value={item.qty} onChange={e => handleCartItemChange(idx, 'qty', e.target.value)} style={{ width: '38px', background: 'rgba(0,0,0,0.3)', border: 'none', color: '#fff', textAlign: 'center', padding: '2px', fontSize: '0.72rem' }} />
                      </td>
                      <td style={{ padding: '2px', textAlign: 'right', fontFamily: 'monospace' }}>{formatNumber(item.total)}</td>
                      <td style={{ padding: '2px', textAlign: 'center' }}>
                        <button type="button" className="btn btn-danger" style={{ padding: '2px 4px', fontSize: '0.65rem' }} onClick={() => handleRemoveCartItem(idx)}>삭제</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 한글 총금액 및 버튼 */}
        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', fontSize: '0.8rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span>한글 총금액:</span>
            <span style={{ fontWeight: 'bold', color: 'var(--primary-color)' }}>{numToKorean(totals.total)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '6px', fontSize: '0.95rem' }}>
            <span>총계액(VAT포함):</span>
            <span style={{ fontWeight: '900', fontFamily: 'monospace' }}>\\ {formatNumber(totals.total)}</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <button type="button" className="btn" style={{ background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: '0.85rem' }} onClick={() => handleSaveEstimate(false)}>
              <Save size={14} style={{ marginRight: '6px' }} />
              견적서 저장
            </button>
            <button type="button" id="save-print-btn" className="btn btn-primary" style={{ fontSize: '0.85rem' }} onClick={() => handleSaveEstimate(true)}>
              <Printer size={14} style={{ marginRight: '6px' }} />
              저장 및 출력
            </button>
          </div>
          {editingId && (
            <button type="button" className="btn btn-danger" style={{ fontSize: '0.85rem' }} onClick={handleCancelEdit}>
              수정 모드 취소
            </button>
          )}
        </div>
      </div>

      {/* 우측: 견적서 리스트 그리드 */}
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
          <h3 style={{ margin: 0, color: '#fff', fontSize: '1.15rem' }}>견적서 발행 원장 내역</h3>
          <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            과거 발행한 견적서 정보를 조회, 수정, 삭제 및 A5 재인쇄를 수행합니다.
          </p>
        </div>

        <div style={{ maxHeight: '520px', overflowY: 'auto' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.03)', position: 'sticky', top: 0, zIndex: 1 }}>
                <th style={{ padding: '8px', width: '80px' }}>일련번호</th>
                <th style={{ padding: '8px', width: '90px' }}>일자</th>
                <th style={{ padding: '8px' }}>수신처</th>
                <th style={{ padding: '8px', textAlign: 'right' }}>총 공급가액</th>
                <th style={{ padding: '8px', textAlign: 'right' }}>부가세</th>
                <th style={{ padding: '8px', textAlign: 'right' }}>총합계액</th>
                <th style={{ padding: '8px', textAlign: 'center', width: '150px' }}>작업</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" style={{ padding: '20px 0', textAlign: 'center' }}>견적 대장을 로드 중입니다...</td></tr>
              ) : estimateList.length === 0 ? (
                <tr><td colSpan="7" style={{ padding: '30px 0', textAlign: 'center', color: 'var(--text-muted)' }}>등록된 견적 발행 정보가 없습니다.</td></tr>
              ) : (
                estimateList.map(est => (
                  <tr key={est.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', cursor: 'pointer' }} onClick={() => handleDetailClick(est.id)}>
                    <td style={{ padding: '8px' }}><code>{est.id}</code></td>
                    <td style={{ padding: '8px' }}>{est.date}</td>
                    <td style={{ padding: '8px', fontWeight: 'bold' }}>{est.receiver}</td>
                    <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace' }}>{formatNumber(est.total_amount)}</td>
                    <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace' }}>{formatNumber(est.total_tax)}</td>
                    <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold', color: 'var(--primary-color)' }}>{formatNumber(est.total_sum)}</td>
                    <td style={{ padding: '8px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                        <button className="btn" style={{ padding: '4px 6px', fontSize: '0.72rem', background: 'rgba(167, 139, 250, 0.15)', color: 'var(--primary-color)', border: '1px solid rgba(167, 139, 250, 0.25)' }} onClick={() => triggerEstimatePrintDoc(est)}>
                          <Printer size={12} />
                          출력
                        </button>
                        <button className="btn" style={{ padding: '4px 6px', fontSize: '0.72rem', background: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24', border: '1px solid rgba(251, 191, 36, 0.25)' }} onClick={() => handleEditEstimate(est)}>
                          수정
                        </button>
                        <button className="btn btn-danger" style={{ padding: '4px 6px', fontSize: '0.72rem' }} onClick={() => handleDeleteEstimate(est.id)}>
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

      {/* 견적서 상세 보기 모달 */}
      {showDetailModal && detailEst && (
        <div className="modal-overlay active" style={{ display: 'flex' }} onClick={() => setShowDetailModal(false)}>
          <div className="modal-content" style={{ maxWidth: '650px', width: '90%' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>견적서 상세 내역 [{detailEst.id}]</h3>
              <button type="button" className="modal-close-btn" onClick={() => setShowDetailModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body" style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '12px', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '6px', fontSize: '0.85rem' }}>
                <div><strong>수신인:</strong> {detailEst.receiver}</div>
                <div><strong>견적일자:</strong> {detailEst.date}</div>
                <div><strong>참조:</strong> {detailEst.ref || '-'}</div>
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
                      {detailEst.items && detailEst.items.map((item, index) => (
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
                <div>공급가액: <strong>{formatNumber(detailEst.total_amount)}원</strong></div>
                <div>세액: <strong>{formatNumber(detailEst.total_tax)}원</strong></div>
                <div style={{ color: 'var(--primary-color)' }}>합계: <strong>{formatNumber(detailEst.total_sum)}원</strong></div>
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
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
                  triggerEstimatePrintDoc(detailEst);
                }}
              >
                <Printer size={14} />
                견적서 재인쇄
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
