import React, { useState, useEffect } from 'react';
import { estimateApi, productApi, hqApi } from '../services/api';
import { Plus, Trash2, Printer, Save, X, Search, FileText } from 'lucide-react';

export default function EstimatesManagement({ products, onDataChange }) {
  const [estimatesList, setEstimatesList] = useState([]);
  const [estCart, setEstCart] = useState([]);
  const [loading, setLoading] = useState(false);

  // 견적서 헤더 폼 상태
  const [serialNo, setSerialNo] = useState('');
  const [estDate, setEstDate] = useState(new Date().toISOString().substring(0, 10));
  const [receiver, setReceiver] = useState('');
  const [ref, setRef] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');

  // 견적 공급자(우리 본사) 상태
  const [supplierName, setSupplierName] = useState('');
  const [supplierBizNo, setSupplierBizNo] = useState('');
  const [supplierOwner, setSupplierOwner] = useState('');
  const [supplierAddress, setSupplierAddress] = useState('');
  const [supplierBizType, setSupplierBizType] = useState('도소매');
  const [supplierBizItem, setSupplierBizItem] = useState('농수산물');
  const [supplierManager, setSupplierManager] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');

  // 현재 수정 중인 견적서 ID
  const [editingId, setEditingId] = useState(null);

  // 신규 품목 입력 폼 상태
  const [selectedProduct, setSelectedProduct] = useState('');
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState(0);
  const [unit, setUnit] = useState('EA');
  const [itemType, setItemType] = useState('벌'); // 규격 구분용

  // 상세 팝업 상태
  const [selectedEstDetail, setSelectedEstDetail] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // 품목 빠른 검색 모달 상태
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // 인쇄 전용 저장 모드 플래그
  const [shouldPrintOnSave, setShouldPrintOnSave] = useState(true);

  useEffect(() => {
    fetchEstimates();
    loadActiveHqInfo();
    generateSerialNo();
  }, []);

  const fetchEstimates = async () => {
    try {
      const data = await estimateApi.getAll();
      setEstimatesList(data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadActiveHqInfo = async () => {
    try {
      const hqs = await hqApi.getAll();
      const activeHq = hqs.find(h => h.is_active) || hqs[0];
      if (activeHq) {
        setSupplierName(activeHq.name);
        setSupplierBizNo(activeHq.reg_no);
        setSupplierOwner(activeHq.owner);
        setSupplierAddress(activeHq.address || '');
        setSupplierPhone(activeHq.phone || '');
        if (activeHq.business) {
          const parts = activeHq.business.split('/');
          setSupplierBizType(parts[0]?.trim() || '도소매');
          setSupplierBizItem(parts[1]?.trim() || '농수산물');
        }
        setSupplierManager(activeHq.owner);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const generateSerialNo = () => {
    const rand1 = Math.floor(Math.random() * 1000);
    const rand2 = Math.floor(Math.random() * 1000);
    setSerialNo(`${rand1}-${rand2}`);
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('ko-KR').format(num || 0);
  };

  // 숫자를 한글 한자 표기로 변환 (예: "일금 백만원정")
  const numToKorean = (num) => {
    if (num === 0) return "일금 영 원정";
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

  // 품목 선택 시 단가 자동 연동
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
      setUnit(prod.unit || 'EA');
      setItemType(prod.origin || '그레이');
    }
  };

  // 대화형 빠른 검색 모달 호출
  const openSearchModal = () => {
    setSearchQuery('');
    setFilteredProducts(products);
    setSelectedIndex(0);
    setShowSearchModal(true);
  };

  const handleSearchInputChange = (e) => {
    const q = e.target.value.toLowerCase().trim();
    setSearchQuery(e.target.value);
    const filtered = products.filter(p => 
      p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)
    );
    setFilteredProducts(filtered);
    setSelectedIndex(0);
  };

  // 키보드로 빠른 검색 제어
  const handleSearchKeyDown = (e) => {
    if (filteredProducts.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((selectedIndex + 1) % filteredProducts.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((selectedIndex - 1 + filteredProducts.length) % filteredProducts.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      selectProductFromModal(filteredProducts[selectedIndex]);
    }
  };

  const selectProductFromModal = (prod) => {
    setSelectedProduct(prod.id);
    setPrice(prod.sales_price || 0);
    setUnit(prod.unit || 'EA');
    setItemType(prod.origin || '그레이');
    setShowSearchModal(false);
  };

  // 카트에 견적 품목 추가
  const handleAddCartItem = (e) => {
    e.preventDefault();
    if (!selectedProduct) {
      alert("품목을 먼저 선택해 주세요.");
      return;
    }

    const prod = products.find(p => p.id === parseInt(selectedProduct, 10));
    if (!prod) return;

    const existing = estCart.find(item => item.name === prod.name);
    if (existing) {
      alert("이미 추가된 상품입니다.");
      return;
    }

    const amount = Math.floor(qty * price);
    const tax = Math.round(amount * 0.1); // 견적서는 10% 자동 과세
    const total = amount + tax;

    const newItem = {
      name: prod.name,
      unit: unit,
      type: itemType,
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
    setUnit('EA');
    setItemType('벌');
  };

  // 카트 품목 정보 수정
  const handleCartItemChange = (index, field, value) => {
    const updated = [...estCart];
    const item = updated[index];

    if (field === 'unit') {
      item.unit = value;
    } else if (field === 'type') {
      item.type = value;
    } else if (field === 'qty') {
      item.qty = parseFloat(value) || 0;
    } else if (field === 'price') {
      item.price = parseInt(value, 10) || 0;
    }

    item.amount = Math.floor(item.qty * item.price);
    item.tax = Math.round(item.amount * 0.1);
    item.total = item.amount + item.tax;
    setEstCart(updated);
  };

  const handleRemoveCartItem = (index) => {
    setEstCart(estCart.filter((_, i) => i !== index));
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

  // 견적서 저장 및 발행
  const handleSaveEstimate = async () => {
    if (!receiver) {
      alert("수신처(거래처명)를 입력해 주세요.");
      return;
    }
    if (estCart.length === 0) {
      alert("견적 품목을 최소 1개 이상 추가해야 합니다.");
      return;
    }

    const payload = {
      serialNo,
      date: estDate,
      receiver,
      ref,
      receiverPhone,
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
        alert("견적서가 정상적으로 수정 완료되었습니다.");
        setEditingId(null);
      } else {
        const res = await estimateApi.create(payload);
        
        // 인쇄 트리거
        if (shouldPrintOnSave) {
          triggerEstimatePrintDoc({
            ...payload,
            id: res.id
          });
        }
      }

      // 폼 리셋
      setEstCart([]);
      setReceiver('');
      setRef('');
      setReceiverPhone('');
      generateSerialNo();
      fetchEstimates();
    } catch (err) {
      alert("견적서 저장에 실패했습니다.");
    }
  };

  // 견적서 수정 모드로 전환
  const handleEditEstimate = async (id) => {
    try {
      const data = await estimateApi.getById(id);
      setEditingId(data.id);
      setSerialNo(data.serial_no);
      setEstDate(data.date);
      setReceiver(data.receiver);
      setRef(data.ref);
      setReceiverPhone(data.receiver_phone);
      
      setSupplierName(data.supplier_name);
      setSupplierBizNo(data.supplier_biz_no);
      setSupplierOwner(data.supplier_owner);
      setSupplierAddress(data.supplier_address);
      setSupplierBizType(data.supplier_biz_type);
      setSupplierBizItem(data.supplier_biz_item);
      setSupplierManager(data.supplier_manager);
      setSupplierPhone(data.supplier_phone);

      setEstCart(data.items.map(item => ({
        name: item.name,
        unit: item.unit,
        type: item.type,
        qty: item.qty,
        price: item.price,
        amount: item.amount,
        tax: item.tax,
        total: item.total
      })));

      alert("견적서 수정 모드로 전환되었습니다. 작성 폼에서 수정한 뒤 저장을 누르세요.");
    } catch (err) {
      alert("견적서 정보를 불러오는 데 실패했습니다.");
    }
  };

  // 견적서 취소
  const handleCancelEdit = () => {
    setEditingId(null);
    setEstCart([]);
    setReceiver('');
    setRef('');
    setReceiverPhone('');
    generateSerialNo();
  };

  const handleDeleteEstimate = async (id, e) => {
    e.stopPropagation();
    if (!confirm("해당 견적서 발행 이력을 영구히 삭제하시겠습니까?")) return;

    try {
      await estimateApi.delete(id);
      alert("견적서가 삭제되었습니다.");
      fetchEstimates();
    } catch (err) {
      alert("견적서 삭제에 실패했습니다.");
    }
  };

  const handleEstimateClick = async (id) => {
    try {
      const detail = await estimateApi.getById(id);
      setSelectedEstDetail(detail);
      setShowDetailModal(true);
    } catch (err) {
      alert("견적서 상세 내역을 가져오지 못했습니다.");
    }
  };

  // ==========================================
  // A5 규격 견적서 인쇄 엔진
  // ==========================================
  const triggerEstimatePrintDoc = (est) => {
    const sealImg = localStorage.getItem('smart_erp_seal_image') || '';
    const totalKorean = numToKorean(est.totalSum);
    const items = est.items || [];
    
    // A5 종이 1페이지당 8개 품목 수용
    const ITEMS_PER_PAGE = 8;
    const totalPages = Math.max(1, Math.ceil(items.length / ITEMS_PER_PAGE));
    let docHtml = "";

    for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
      const pageItems = items.slice(pageIdx * ITEMS_PER_PAGE, (pageIdx + 1) * ITEMS_PER_PAGE);
      const emptyRowCount = ITEMS_PER_PAGE - pageItems.length;
      
      let itemsHtml = "";
      pageItems.forEach((item, idx) => {
        const globalIdx = pageIdx * ITEMS_PER_PAGE + idx + 1;
        itemsHtml += `
          <tr style="height: 18px; border-bottom: 1px solid #000;">
            <td style="border: 1px solid #000; padding: 2px; text-align: center;">${globalIdx}</td>
            <td style="border: 1px solid #000; padding: 2px 4px; font-weight: bold;">${item.name}</td>
            <td style="border: 1px solid #000; padding: 2px; text-align: center;">${item.type || '-'}</td>
            <td style="border: 1px solid #000; padding: 2px; text-align: center;">${item.unit || '-'}</td>
            <td style="border: 1px solid #000; padding: 2px; text-align: center; font-family: monospace;">${item.qty}</td>
            <td style="border: 1px solid #000; padding: 2px 4px; text-align: right; font-family: monospace;">${formatNumber(item.price)}</td>
            <td style="border: 1px solid #000; padding: 2px 4px; text-align: right; font-family: monospace;">${formatNumber(item.amount)}</td>
            <td style="border: 1px solid #000; padding: 2px 4px; text-align: right; font-family: monospace;">${formatNumber(item.tax)}</td>
            <td style="border: 1px solid #000; padding: 2px 4px; text-align: right; font-family: monospace; font-weight: bold;">${formatNumber(item.total)}</td>
          </tr>
        `;
      });

      // 여백 채우기
      for (let i = 0; i < emptyRowCount; i++) {
        itemsHtml += `
          <tr style="height: 18px; border-bottom: 1px solid #000; color: #ccc;">
            <td style="border: 1px solid #000; padding: 2px;">&nbsp;</td>
            <td style="border: 1px solid #000; padding: 2px;">&nbsp;</td>
            <td style="border: 1px solid #000; padding: 2px;">&nbsp;</td>
            <td style="border: 1px solid #000; padding: 2px;">&nbsp;</td>
            <td style="border: 1px solid #000; padding: 2px;">&nbsp;</td>
            <td style="border: 1px solid #000; padding: 2px;">&nbsp;</td>
            <td style="border: 1px solid #000; padding: 2px;">&nbsp;</td>
            <td style="border: 1px solid #000; padding: 2px;">&nbsp;</td>
            <td style="border: 1px solid #000; padding: 2px;">&nbsp;</td>
          </tr>
        `;
      }

      docHtml += `
        <div class="print-page-wrapper" style="page-break-after: always; width: 210mm; height: 148mm; box-sizing: border-box; padding: 6mm; background: #fff; color: #000; font-family: 'Inter', 'Noto Sans KR', sans-serif; position: relative;">
          
          <div style="text-align: center; font-size: 1.5rem; font-weight: 900; letter-spacing: 10px; margin-bottom: 8px;">견 적 서</div>
          
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px; gap: 10px;">
            <!-- 수신인 정보 (좌측) -->
            <div style="width: 48%; font-size: 0.72rem; line-height: 1.5; display: flex; flexDirection: column; justify-content: space-between;">
              <div style="border-bottom: 1px solid #000; padding: 2px 0;"><strong>일련번호 :</strong> &nbsp;${est.serial_no || est.serialNo}</div>
              <div style="border-bottom: 1px solid #000; padding: 2px 0; font-size: 0.85rem; font-weight: bold;"><strong>귀&nbsp;&nbsp;&nbsp;&nbsp;하 :</strong> &nbsp;${est.receiver}</div>
              <div style="border-bottom: 1px solid #000; padding: 2px 0;"><strong>참&nbsp;&nbsp;&nbsp;&nbsp;조 :</strong> &nbsp;${est.ref || ''}</div>
              <div style="border-bottom: 1px solid #000; padding: 2px 0;"><strong>전화번호 :</strong> &nbsp;${est.receiver_phone || est.receiverPhone || ''}</div>
              <div style="border-bottom: 1px solid #000; padding: 2px 0;"><strong>견적일자 :</strong> &nbsp;${est.date.replace(/-/g, "년 ").substring(0, 12)}일</div>
              <div style="font-weight: 900; font-size: 0.8rem; margin-top: 6px; color: #111;">아래와 같이 견적서 정보를 제공합니다.</div>
            </div>

            <!-- 공급자 정보 (우측) -->
            <div style="width: 50%;">
              <table style="width: 100%; border-collapse: collapse; font-size: 0.68rem; border: 1.5px solid #000;">
                <tr>
                  <td rowspan="4" style="width: 18px; text-align: center; font-weight: bold; background: #f0f0f0; border: 1px solid #000; padding: 2px; line-height: 1.3;">공<br>급<br>자</td>
                  <td style="background: #f0f0f0; font-weight: bold; text-align: center; width: 50px; border: 1px solid #000; padding: 2px;">상호</td>
                  <td style="border: 1px solid #000; padding: 2px 4px; font-weight: bold;">${est.supplier_name || est.supplier.name}</td>
                  <td style="background: #f0f0f0; font-weight: bold; text-align: center; width: 45px; border: 1px solid #000; padding: 2px;">대표자</td>
                  <td style="text-align: center; border: 1px solid #000; padding: 2px; position: relative;">
                    ${est.supplier_owner || est.supplier.owner}
                    ${sealImg ? `
                      <img src="${sealImg}" style="position: absolute; width: 28px; height: 28px; right: 2px; top: 50%; transform: translateY(-50%); opacity: 0.85;" />
                    ` : `
                      <span style="color: red; border: 1px solid red; border-radius: 50%; padding: 1px 2px; font-size: 0.55rem; position: absolute; right: 4px; top: 50%; transform: translateY(-50%);">인</span>
                    `}
                  </td>
                </tr>
                <tr>
                  <td style="background: #f0f0f0; font-weight: bold; text-align: center; border: 1px solid #000; padding: 2px;">사업자번호</td>
                  <td colspan="3" style="border: 1px solid #000; padding: 2px 4px; font-family: monospace; font-weight: bold;">${est.supplier_biz_no || est.supplier.bizNo}</td>
                </tr>
                <tr>
                  <td style="background: #f0f0f0; font-weight: bold; text-align: center; border: 1px solid #000; padding: 2px;">소재지</td>
                  <td colspan="3" style="border: 1px solid #000; padding: 2px 4px; font-size: 0.6rem;">${est.supplier_address || est.supplier.address}</td>
                </tr>
                <tr>
                  <td style="background: #f0f0f0; font-weight: bold; text-align: center; border: 1px solid #000; padding: 2px;">업태/종목</td>
                  <td style="border: 1px solid #000; padding: 2px 4px;">${est.supplier_biz_type || est.supplier.bizType}</td>
                  <td style="background: #f0f0f0; font-weight: bold; text-align: center; border: 1px solid #000; padding: 2px;">담당자</td>
                  <td style="border: 1px solid #000; padding: 2px 4px;">${est.supplier_manager || est.supplier.manager}</td>
                </tr>
                <tr>
                  <td colspan="2" style="background: #f0f0f0; font-weight: bold; text-align: center; border: 1px solid #000; padding: 2px;">연락처</td>
                  <td colspan="3" style="border: 1px solid #000; padding: 2px 4px;">${est.supplier_phone || est.supplier.phone}</td>
                </tr>
              </table>
            </div>
          </div>

          <!-- 합계 금액 바 -->
          <div style="display: flex; justify-content: space-between; align-items: center; border: 1.5px solid #000; background: #f0f0f0; padding: 4px 8px; font-size: 0.8rem; font-weight: bold; margin-bottom: 6px;">
            <span>합 계 금 액</span>
            <span style="letter-spacing: 1px;">${totalKorean}</span>
            <span style="font-family: monospace;">( \\ ${formatNumber(est.totalSum || est.total_sum)} )</span>
          </div>

          <!-- 품목 리스트 -->
          <table style="width: 100%; border-collapse: collapse; font-size: 0.72rem; border: 1.5px solid #000; margin-bottom: 4px;">
            <thead>
              <tr style="background: #f0f0f0; font-weight: bold; text-align: center; height: 20px;">
                <th style="width: 5%; border: 1px solid #000; padding: 2px;">No</th>
                <th style="width: 32%; border: 1px solid #000; padding: 2px; text-align: left;">상품명</th>
                <th style="width: 10%; border: 1px solid #000; padding: 2px;">규격</th>
                <th style="width: 8%; border: 1px solid #000; padding: 2px;">단위</th>
                <th style="width: 8%; border: 1px solid #000; padding: 2px;">수량</th>
                <th style="width: 10%; border: 1px solid #000; padding: 2px; text-align: right;">단가</th>
                <th style="width: 10%; border: 1px solid #000; padding: 2px; text-align: right;">공급가액</th>
                <th style="width: 8%; border: 1px solid #000; padding: 2px; text-align: right;">세액</th>
                <th style="width: 10%; border: 1px solid #000; padding: 2px; text-align: right;">합계금액</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
              <!-- 합계 행 -->
              <tr style="background:#f0f0f0; font-weight:bold; height: 18px; font-size: 0.7rem;">
                <td colspan="2" style="border: 1px solid #000; text-align: center; padding: 2px;">소계 (합계)</td>
                <td style="border: 1px solid #000;"></td>
                <td style="border: 1px solid #000;"></td>
                <td style="border: 1px solid #000;"></td>
                <td style="border: 1px solid #000;"></td>
                <td style="border: 1px solid #000; text-align: right; padding: 2px 4px; font-family: monospace;">${formatNumber(est.totalAmount || est.total_amount)}</td>
                <td style="border: 1px solid #000; text-align: right; padding: 2px 4px; font-family: monospace;">${formatNumber(est.totalTax || est.total_tax)}</td>
                <td style="border: 1px solid #000; text-align: right; padding: 2px 4px; font-family: monospace; font-size: 0.72rem;">\\ ${formatNumber(est.totalSum || est.total_sum)}</td>
              </tr>
            </tbody>
          </table>
          
          <!-- 푸터 페이지 표기 -->
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.65rem; color: #555; margin-top: 4px;">
            <div>* 본 견적서의 유효기간은 발행일로부터 30일입니다.</div>
            <div style="font-weight: bold; background: #ddd; padding: 1px 6px; border-radius: 3px;">
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
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '20px', textAlign: 'left' }} className="responsive-split">
      
      {/* 좌측: 견적서 작성 카트 */}
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
          <h3 style={{ margin: '0 0 4px 0', color: '#fff', fontSize: '1.15rem' }}>
            {editingId ? '견적서 수정 작성 대장' : '견적서 신규 발행 작성'}
          </h3>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            납품 상담 품목 단가 및 공급사 정보를 수동/자동 기입하여 정식 견적서를 인쇄합니다.
          </p>
        </div>

        {/* 견적서 상단 수신 정보 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label>일련번호 (자동생성)</label>
              <input type="text" value={serialNo} onChange={(e) => setSerialNo(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>견적 발행 일자</label>
              <input type="date" value={estDate} onChange={(e) => setEstDate(e.target.value)} required />
            </div>
          </div>
          <div className="form-group">
            <label>수신처 (귀하 상호명) *</label>
            <input type="text" value={receiver} onChange={(e) => setReceiver(e.target.value)} placeholder="수신 거래처명" required />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label>수신처 연락처</label>
              <input type="text" value={receiverPhone} onChange={(e) => setReceiverPhone(e.target.value)} placeholder="010-0000-0000" />
            </div>
            <div className="form-group">
              <label>참조 부서/담당자</label>
              <input type="text" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="구매과 과장" />
            </div>
          </div>
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
            <label>견적 상품 선택</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <select value={selectedProduct} onChange={handleProductChange} style={{ flex: 1 }}>
                <option value="">-- 상품 리스트에서 찾기 --</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.unit} | 단가: {formatNumber(p.sales_price)}원)
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn"
                style={{
                  background: 'rgba(167, 139, 250, 0.12)',
                  color: 'var(--primary-color)',
                  border: '1px solid rgba(167,139,250,0.3)',
                  padding: '8px'
                }}
                onClick={openSearchModal}
                title="키보드 초고속 검색"
              >
                <Search size={16} />
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label>견적 규격</label>
              <input type="text" value={itemType} onChange={(e) => setItemType(e.target.value)} placeholder="그레이" />
            </div>
            <div className="form-group">
              <label>단위</label>
              <input type="text" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="BOX" />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label>견적 수량</label>
              <input type="number" min="0.1" step="any" value={qty} onChange={(e) => setQty(parseFloat(e.target.value) || 1)} />
            </div>
            <div className="form-group">
              <label>견적 단가 (원)</label>
              <input type="number" min="0" value={price} onChange={(e) => setPrice(parseInt(e.target.value, 10) || 0)} />
            </div>
          </div>

          <button type="submit" className="btn" style={{
            background: 'rgba(167, 139, 250, 0.15)',
            color: 'var(--primary-color)',
            border: '1px solid rgba(167,139,250,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}>
            <Plus size={15} />
            견적 카트에 추가
          </button>
        </form>

        {/* 카트 테이블 */}
        <div>
          <label style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
            견적 품목 내역 ({estCart.length}건)
          </label>
          <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.05)', height: '26px' }}>
                  <th style={{ padding: '4px', textAlign: 'left' }}>품목명</th>
                  <th style={{ padding: '4px', textAlign: 'center', width: '45px' }}>규격</th>
                  <th style={{ padding: '4px', textAlign: 'center', width: '45px' }}>수량</th>
                  <th style={{ padding: '4px', textAlign: 'right', width: '75px' }}>단가</th>
                  <th style={{ padding: '4px', textAlign: 'center', width: '35px' }}>삭제</th>
                </tr>
              </thead>
              <tbody>
                {estCart.length === 0 ? (
                  <tr><td colSpan="5" style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)' }}>카트가 비어 있습니다.</td></tr>
                ) : (
                  estCart.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', height: '32px' }}>
                      <td style={{ padding: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.name}>
                        {item.name}
                      </td>
                      <td style={{ padding: '2px' }}>
                        <input type="text" value={item.type} onChange={(e) => handleCartItemChange(idx, 'type', e.target.value)} style={{ width: '40px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '4px', textAlign: 'center', fontSize: '0.75rem', padding: '2px' }} />
                      </td>
                      <td style={{ padding: '2px' }}>
                        <input type="number" value={item.qty} min="0.1" step="any" onChange={(e) => handleCartItemChange(idx, 'qty', e.target.value)} style={{ width: '40px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '4px', textAlign: 'center', fontSize: '0.75rem', padding: '2px' }} />
                      </td>
                      <td style={{ padding: '2px', textAlign: 'right', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                        {formatNumber(item.price)}
                      </td>
                      <td style={{ padding: '2px', textAlign: 'center' }}>
                        <button type="button" className="btn btn-danger" style={{ padding: '2px 4px', fontSize: '0.7rem' }} onClick={() => handleRemoveCartItem(idx)}>
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 요약 박스 */}
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
          <div style={{ color: 'var(--primary-color)', fontSize: '0.78rem', fontWeight: 'bold' }}>
            {numToKorean(totals.total)}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '8px', fontSize: '1rem' }}>
            <span>총 견적 합계</span>
            <span style={{ fontFamily: 'monospace', fontWeight: '900', color: '#fff' }}>{formatNumber(totals.total)}원</span>
          </div>
        </div>

        {/* 제출 및 인쇄 여부 지정 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
            <input type="checkbox" id="est-print-save-toggle" checked={shouldPrintOnSave} onChange={(e) => setShouldPrintOnSave(e.target.checked)} style={{ cursor: 'pointer' }} />
            <label htmlFor="est-print-save-toggle" style={{ cursor: 'pointer' }}>저장 즉시 A5 견적서 인쇄 모달 열기</label>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: editingId ? '1fr 1fr' : '1fr', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              onClick={handleSaveEstimate}
            >
              <Save size={16} />
              {editingId ? '수정 사항 저장/발행' : '견적서 저장 및 발행'}
            </button>
            {editingId && (
              <button
                type="button"
                className="btn"
                style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}
                onClick={handleCancelEdit}
              >
                수정 취소
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 우측: 견적서 발행 리스트 조회 */}
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
          <h3 style={{ margin: 0, color: '#fff', fontSize: '1.15rem' }}>견적서 발행 이력 원장</h3>
          <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            회사에서 과거 임시 또는 정식 발행한 견적서 서류 대장 목록입니다.
          </p>
        </div>

        <div style={{ maxHeight: '520px', overflowY: 'auto' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.03)', position: 'sticky', top: 0, zIndex: 1 }}>
                <th style={{ padding: '10px 8px', borderBottom: '1px solid rgba(255,255,255,0.08)', width: '80px' }}>일자</th>
                <th style={{ padding: '10px 8px', borderBottom: '1px solid rgba(255,255,255,0.08)', width: '90px' }}>일련번호</th>
                <th style={{ padding: '10px 8px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>수신처 (귀하)</th>
                <th style={{ padding: '10px 8px', borderBottom: '1px solid rgba(255,255,255,0.08)', textAlign: 'right' }}>합계 금액</th>
                <th style={{ padding: '10px 8px', borderBottom: '1px solid rgba(255,255,255,0.08)', textAlign: 'center', width: '150px' }}>작업</th>
              </tr>
            </thead>
            <tbody>
              {estimatesList.length === 0 ? (
                <tr><td colSpan="5" style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>발행된 견적서 정보가 존재하지 않습니다.</td></tr>
              ) : (
                estimatesList.map(est => (
                  <tr key={est.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', cursor: 'pointer' }} onClick={() => handleEstimateClick(est.id)}>
                    <td style={{ padding: '10px 8px' }}>{est.date}</td>
                    <td style={{ padding: '10px 8px', fontFamily: 'monospace' }}>{est.serial_no}</td>
                    <td style={{ padding: '10px 8px', fontWeight: 'bold' }}>{est.receiver}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold' }}>{formatNumber(est.total_sum)} 원</td>
                    <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }} onClick={(e) => e.stopPropagation()}>
                        <button type="button" className="btn" style={{ padding: '4px 8px', fontSize: '0.75rem', background: 'rgba(167, 139, 250, 0.2)', color: 'var(--primary-color)', border: '1px solid rgba(167,139,250,0.3)', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => triggerEstimatePrintDoc(est)}>
                          <Printer size={12} />
                          출력
                        </button>
                        <button type="button" className="btn btn-warning" style={{ padding: '4px 8px', fontSize: '0.75rem', background: '#e67e22', borderColor: '#d35400', color: '#fff' }} onClick={() => handleEditEstimate(est.id)}>
                          수정
                        </button>
                        <button type="button" className="btn btn-danger" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={(e) => handleDeleteEstimate(est.id, e)}>
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

      {/* 견적서 상세 내역 모달 */}
      {showDetailModal && selectedEstDetail && (
        <div className="modal-overlay active" style={{ display: 'flex' }} onClick={() => setShowDetailModal(false)}>
          <div className="modal-content" style={{ maxWidth: '650px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>견적서 상세 원장 내역 [일련: {selectedEstDetail.serial_no}]</h3>
              <button type="button" className="modal-close-btn" onClick={() => setShowDetailModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body" style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '6px' }}>
                <div><strong>수신처 귀하:</strong> {selectedEstDetail.receiver}</div>
                <div><strong>견적일자:</strong> {selectedEstDetail.date}</div>
                <div><strong>참조:</strong> {selectedEstDetail.ref || '-'}</div>
                <div><strong>연락처:</strong> {selectedEstDetail.receiver_phone || '-'}</div>
              </div>
              
              <div>
                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>견적 세부 내역</label>
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.05)', height: '24px' }}>
                        <th style={{ padding: '6px', textAlign: 'left' }}>상품명</th>
                        <th style={{ padding: '6px', textAlign: 'center', width: '60px' }}>규격</th>
                        <th style={{ padding: '6px', textAlign: 'center', width: '50px' }}>수량</th>
                        <th style={{ padding: '6px', textAlign: 'right', width: '80px' }}>단가</th>
                        <th style={{ padding: '6px', textAlign: 'right', width: '90px' }}>공급가액</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedEstDetail.items && selectedEstDetail.items.map((item, index) => (
                        <tr key={index} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', height: '30px' }}>
                          <td style={{ padding: '6px' }}>{item.name}</td>
                          <td style={{ padding: '6px', textAlign: 'center' }}>{item.type}</td>
                          <td style={{ padding: '6px', textAlign: 'center' }}>{item.qty} ({item.unit})</td>
                          <td style={{ padding: '6px', textAlign: 'right', fontFamily: 'monospace' }}>{formatNumber(item.price)}</td>
                          <td style={{ padding: '6px', textAlign: 'right', fontFamily: 'monospace' }}>{formatNumber(item.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '24px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px', fontSize: '0.9rem', fontFamily: 'monospace' }}>
                <div>공급가액합: <strong>{formatNumber(selectedEstDetail.total_amount)}원</strong></div>
                <div>세액합: <strong>{formatNumber(selectedEstDetail.total_tax)}원</strong></div>
                <div style={{ color: 'var(--primary-color)' }}>총견적합계: <strong>{formatNumber(selectedEstDetail.total_sum)}원</strong></div>
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'linear-gradient(135deg, #a78bfa, #7c3aed)' }}
                onClick={() => {
                  setShowDetailModal(false);
                  triggerEstimatePrintDoc(selectedEstDetail);
                }}
              >
                <Printer size={14} />
                견적서 즉시 인쇄
              </button>
              <button type="button" className="btn" style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }} onClick={() => setShowDetailModal(false)}>
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 품목 초고속 키보드 검색 모달 */}
      {showSearchModal && (
        <div className="modal-overlay active" style={{ display: 'flex' }} onClick={() => setShowSearchModal(false)}>
          <div className="modal-content" style={{ maxWidth: '450px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>품목 키보드 초고속 검색</h3>
              <button type="button" className="modal-close-btn" onClick={() => setShowSearchModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body" style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                키보드 <kbd style={{ background: '#333', padding: '2px 4px', borderRadius: '3px' }}>↓</kbd> / <kbd style={{ background: '#333', padding: '2px 4px', borderRadius: '3px' }}>↑</kbd> 방향키로 이동 후 <kbd style={{ background: '#333', padding: '2px 4px', borderRadius: '3px' }}>Enter</kbd>를 누르면 즉시 선택됩니다.
              </p>
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchInputChange}
                onKeyDown={handleSearchKeyDown}
                placeholder="검색할 상품명 입력..."
                style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', borderRadius: '6px' }}
                autoFocus
              />
              
              <ul style={{ maxHeight: '250px', overflowY: 'auto', margin: 0, padding: 0, listStyle: 'none', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px' }}>
                {filteredProducts.length === 0 ? (
                  <li style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>일치하는 상품이 없습니다.</li>
                ) : (
                  filteredProducts.map((prod, idx) => (
                    <li
                      key={prod.id}
                      onClick={() => selectProductFromModal(prod)}
                      style={{
                        padding: '10px 12px',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '0.85rem',
                        background: idx === selectedIndex ? 'rgba(167, 139, 250, 0.15)' : 'transparent',
                        borderBottom: '1px solid rgba(255,255,255,0.03)',
                        transition: 'background 0.1s'
                      }}
                      className={idx === selectedIndex ? 'selected' : ''}
                    >
                      <span style={{ fontWeight: 'bold', color: idx === selectedIndex ? 'var(--primary-color)' : '#fff' }}>{prod.name}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatNumber(prod.sales_price)}원 | 재고: {prod.stock}</span>
                    </li>
                  ))
                )}
              </ul>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="btn" style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }} onClick={() => setShowSearchModal(false)}>
                취소
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
