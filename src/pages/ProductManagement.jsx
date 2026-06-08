import React, { useState } from 'react';
import { productApi } from '../services/api';
import * as XLSX from 'xlsx';
import { Plus, Trash2, Edit2, Upload, FileSpreadsheet, Search } from 'lucide-react';

export default function ProductManagement({ products, onDataChange }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState(null);
  
  // 폼 입력 필드
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('EA');
  const [origin, setOrigin] = useState('국내산');
  const [purchasePrice, setPurchasePrice] = useState(0);
  const [salesPrice, setSalesPrice] = useState(0);
  const [taxType, setTaxType] = useState('과세');
  const [stock, setStock] = useState(0);

  const formatNumber = (num) => {
    return new Intl.NumberFormat('ko-KR').format(num || 0);
  };

  // 단위 및 상호 필터 정규화 헬퍼 (1000g -> kg 변환 규칙 강제)
  const sanitizeExcelUnitAndName = (pName, pUnit) => {
    let cleanName = pName || "";
    let cleanUnit = pUnit || "EA";

    // 1000g 또는 1000g/EA 등 중복 단위 걸러내고 Kg로 표준화
    if (cleanUnit.toLowerCase() === '1000g' || cleanUnit === '1000g/EA' || cleanUnit.toLowerCase() === 'g') {
      cleanUnit = 'Kg';
    }

    if (cleanName.includes('1000g')) {
      cleanName = cleanName.replace(/1000g/g, '1Kg');
    } else if (cleanName.includes(' 1000g')) {
      cleanName = cleanName.replace(/ 1000g/g, ' 1Kg');
    }

    return { name: cleanName, unit: cleanUnit };
  };

  const resetForm = () => {
    setCode('');
    setName('');
    setUnit('EA');
    setOrigin('국내산');
    setPurchasePrice(0);
    setSalesPrice(0);
    setTaxType('과세');
    setStock(0);
    setIsEditing(false);
    setCurrentId(null);
  };

  const handleEditClick = (prod) => {
    setIsEditing(true);
    setCurrentId(prod.id);
    setCode(prod.code);
    setName(prod.name);
    setUnit(prod.unit);
    setOrigin(prod.origin);
    setPurchasePrice(prod.purchase_price);
    setSalesPrice(prod.sales_price);
    setTaxType(prod.tax_type);
    setStock(prod.stock);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!code || !name) {
      alert("코드와 품목명을 기입해 주세요.");
      return;
    }

    const payload = {
      code,
      name,
      unit,
      origin,
      purchasePrice,
      salesPrice,
      taxType,
      stock
    };

    try {
      if (isEditing && currentId) {
        await productApi.update(currentId, payload);
        alert("상품 정보가 성공적으로 수정되었습니다.");
      } else {
        await productApi.create(payload);
        alert("신규 상품이 기초 사전에 등록되었습니다.");
      }
      resetForm();
      onDataChange();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || "작업 도중 오류가 발생했습니다.");
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("해당 상품을 삭제하시겠습니까? 관련 재고 목록에서 삭제됩니다.")) return;
    try {
      await productApi.delete(id);
      alert("삭제되었습니다.");
      onDataChange();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || "삭제 중 에러가 발생했습니다.");
    }
  };

  // 엑셀 일괄 업로드 파서
  const handleExcelUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet);

        if (rows.length === 0) {
          alert("엑셀 파일 내에 데이터가 존재하지 않습니다.");
          return;
        }

        let addedCount = 0;
        let skipCount = 0;

        for (const row of rows) {
          // 컬럼 매칭 (품목코드, 품목명, 규격, 원산지, 매입단가, 매출단가, 과세여부, 초기재고)
          const rawCode = String(row['품목코드'] || row['코드'] || 'PRD-' + Math.floor(Math.random()*100000)).trim();
          const rawName = String(row['품목명'] || row['상품명'] || '').trim();
          const rawUnit = String(row['규격'] || row['단위'] || 'EA').trim();
          const rawOrigin = String(row['원산지'] || '국내산').trim();
          const purchaseVal = parseInt(row['매입단가'] || row['매입가'] || 0, 10);
          const salesVal = parseInt(row['매출단가'] || row['매출가'] || 0, 10);
          const rawTax = String(row['과세여부'] || row['구분'] || '과세').trim();
          const rawStock = parseFloat(row['초기재고'] || row['재고'] || 0);

          if (!rawName) {
            skipCount++;
            continue;
          }

          // 1000g -> kg 단위 정제 필터 적용
          const { name: cleanName, unit: cleanUnit } = sanitizeExcelUnitAndName(rawName, rawUnit);

          const payload = {
            code: rawCode,
            name: cleanName,
            unit: cleanUnit,
            origin: rawOrigin,
            purchasePrice: purchaseVal,
            salesPrice: salesVal,
            taxType: rawTax.includes('면세') ? '면세' : '과세',
            stock: rawStock
          };

          try {
            await productApi.create(payload);
            addedCount++;
          } catch (err) {
            // 중복된 경우 스킵
            skipCount++;
          }
        }

        alert(`엑셀 등록 완료!\n성공: ${addedCount}건\n중복/오류 제외: ${skipCount}건`);
        onDataChange();
      } catch (err) {
        console.error("Excel import error:", err);
        alert("엑셀 구조 파싱에 실패했습니다. 올바른 포맷인지 확인해 주세요.");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = ''; // 인풋 클리어
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.origin.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '20px', textAlign: 'left' }} className="responsive-split">
      {/* 좌측: 등록 및 편집 폼 (글래스모피즘) */}
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
            {isEditing ? '기초 품목 정보 수정' : '신규 상품 사전 등록'}
          </h3>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            품목 코드와 상호 기준 데이터를 기입해 매입/매출 거래 시 자동 호출하게 만듭니다.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="form-group">
            <label>품목 코드</label>
            <input
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="예: PRD-3379"
            />
          </div>

          <div className="form-group">
            <label>품목명 (표준화 대상)</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 상하목장 요구르트"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label>규격 (단위)</label>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="예: Kg, BOX, EA"
              />
            </div>
            <div className="form-group">
              <label>원산지</label>
              <input
                type="text"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                placeholder="예: 국내산, 수입산"
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label>기본 매입단가 (원)</label>
              <input
                type="number"
                min="0"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(parseInt(e.target.value, 10) || 0)}
              />
            </div>
            <div className="form-group">
              <label>기본 매출단가 (원)</label>
              <input
                type="number"
                min="0"
                value={salesPrice}
                onChange={(e) => setSalesPrice(parseInt(e.target.value, 10) || 0)}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label>과세 구분</label>
              <select value={taxType} onChange={(e) => setTaxType(e.target.value)}>
                <option value="과세">과세 (10%)</option>
                <option value="면세">면세 (0%)</option>
              </select>
            </div>
            <div className="form-group">
              <label>초기 기초재고 수량</label>
              <input
                type="number"
                step="any"
                value={stock}
                onChange={(e) => setStock(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            {isEditing && (
              <button
                type="button"
                className="btn"
                onClick={resetForm}
                style={{ flex: 1, background: 'rgba(255,255,255,0.1)', color: '#fff' }}
              >
                취소
              </button>
            )}
            <button
              type="submit"
              className="btn btn-primary"
              style={{ flex: 2 }}
            >
              {isEditing ? '수정 완료' : '상품 등록 저장'}
            </button>
          </div>
        </form>

        {/* 엑셀 일괄 업로드 액션 */}
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.06)',
          paddingTop: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div>
            <h4 style={{ margin: '0 0 4px 0', color: '#fff', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FileSpreadsheet size={16} style={{ color: '#34d399' }} />
              엑셀 일괄 등록
            </h4>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              엑셀 컬럼(`품목코드`, `품목명`, `규격`, `원산지`, `매입단가`, `매출단가`, `과세여부`, `초기재고`) 명칭 기준 자동 파싱
            </p>
          </div>
          <button
            type="button"
            className="btn"
            style={{
              background: 'rgba(52, 211, 153, 0.15)',
              border: '1px solid rgba(52, 211, 153, 0.3)',
              color: '#34d399',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
            onClick={() => document.getElementById('excel-file-input').click()}
          >
            <Upload size={16} />
            엑셀 양식 불러오기
          </button>
          <input
            type="file"
            id="excel-file-input"
            accept=".xlsx, .xls"
            style={{ display: 'none' }}
            onChange={handleExcelUpload}
          />
        </div>
      </div>

      {/* 우측: 상품 목록 및 조회 그리드 */}
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
        {/* 상단 검색 바 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
          <h3 style={{ margin: 0, color: '#fff', fontSize: '1.15rem' }}>
            등록 품목 마스터 대장 ({filteredProducts.length}건)
          </h3>
          <div style={{ position: 'relative', width: '200px' }}>
            <Search style={{
              position: 'absolute',
              left: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '14px',
              height: '14px',
              color: 'var(--text-muted)'
            }} />
            <input
              type="text"
              placeholder="품목명, 원산지 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 12px 6px 30px',
                fontSize: '0.8rem',
                background: 'rgba(0,0,0,0.25)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '6px',
                color: '#fff',
                outline: 'none'
              }}
            />
          </div>
        </div>

        {/* 테이블 스크롤 영역 */}
        <div style={{ maxHeight: '520px', overflowY: 'auto' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.03)', position: 'sticky', top: 0, zIndex: 1 }}>
                <th style={{ padding: '8px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>코드</th>
                <th style={{ padding: '8px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>품목명</th>
                <th style={{ padding: '8px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>규격</th>
                <th style={{ padding: '8px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>원산지</th>
                <th style={{ padding: '8px', borderBottom: '1px solid rgba(255,255,255,0.08)', textAlign: 'right' }}>매입가</th>
                <th style={{ padding: '8px', borderBottom: '1px solid rgba(255,255,255,0.08)', textAlign: 'right' }}>매출가</th>
                <th style={{ padding: '8px', borderBottom: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' }}>재고</th>
                <th style={{ padding: '8px', borderBottom: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' }}>작업</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                    등록되었거나 검색 조건에 부합하는 기초 상품 품목 정보가 없습니다.
                  </td>
                </tr>
              ) : (
                filteredProducts.map(prod => (
                  <tr key={prod.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '8px', color: 'var(--text-muted)', fontSize: '0.75rem' }}>{prod.code}</td>
                    <td style={{ padding: '8px', fontWeight: 'bold' }}>{prod.name}</td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      <span style={{
                        padding: '1px 6px',
                        background: prod.unit === 'Kg' ? 'rgba(167, 139, 250, 0.15)' : 'rgba(255,255,255,0.05)',
                        color: prod.unit === 'Kg' ? '#c084fc' : '#fff',
                        borderRadius: '4px',
                        fontSize: '0.75rem'
                      }}>
                        {prod.unit}
                      </span>
                    </td>
                    <td style={{ padding: '8px', textAlign: 'center', fontSize: '0.8rem' }}>{prod.origin}</td>
                    <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace' }}>{formatNumber(prod.purchase_price)}</td>
                    <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace' }}>{formatNumber(prod.sales_price)}</td>
                    <td style={{ padding: '8px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 'bold', color: prod.stock <= 5 ? '#f87171' : '#6ee7b7' }}>
                      {prod.stock}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                        <button
                          type="button"
                          className="btn"
                          style={{ padding: '3px 6px', background: 'rgba(255,255,255,0.08)', color: '#fff' }}
                          onClick={() => handleEditClick(prod)}
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger"
                          style={{ padding: '3px 6px' }}
                          onClick={() => handleDelete(prod.id)}
                        >
                          <Trash2 size={12} />
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
    </div>
  );
}
