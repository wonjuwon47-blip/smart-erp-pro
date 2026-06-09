import React, { useState, useEffect } from 'react';
import { Upload, Trash2, Award, Printer, Download, RefreshCw, Settings as SettingsIcon } from 'lucide-react';
import { hqApi, erpSettingsApi, systemApi } from '../services/api';

export default function Settings({ onDataChange }) {
  // 본사 기본 정보 설정
  const [hqId, setHqId] = useState(null);
  const [hqName, setHqName] = useState('본사 사업소');
  const [owner, setOwner] = useState('대표자명');
  const [bizNo, setBizNo] = useState('123-45-67890');
  const [address, setAddress] = useState('서울특별시 서초구 서초대로 123');
  const [phone, setPhone] = useState('02-1234-5678');
  
  // 인쇄 및 단축키 설정
  const [paperSize, setPaperSize] = useState('A4');
  const [marginTop, setMarginTop] = useState(15);
  const [marginLeft, setMarginLeft] = useState(15);
  const [fontSize, setFontSize] = useState(10);
  const [logoText, setLogoText] = useState('[공급자 보관용]');
  const [sealImage, setSealImage] = useState('');

  // 단축키 매핑 설정
  const [hkF2, setHkF2] = useState('sales');
  const [hkF4, setHkF4] = useState('save');
  const [hkF7, setHkF7] = useState('purchase');
  const [hkF8, setHkF8] = useState('receivables');
  const [hkF9, setHkF9] = useState('excel-import');

  // 로딩 상태
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        setIsLoading(true);
        // 1. 본사 정보 로드
        const hqs = await hqApi.getAll();
        const activeHq = hqs.find(h => h.is_active) || hqs[0];
        if (activeHq) {
          setHqId(activeHq.id);
          setHqName(activeHq.name || '');
          setOwner(activeHq.owner || '');
          setBizNo(activeHq.reg_no || '');
          setPhone(activeHq.phone || '');
          setAddress(activeHq.address || '');
        }

        // 2. ERP 설정 로드
        const settings = await erpSettingsApi.get();
        if (settings) {
          setPaperSize(settings.paper_size || 'A4');
          setMarginTop(settings.margin_top ?? 15);
          setMarginLeft(settings.margin_left ?? 15);
          setFontSize(settings.font_size ?? 10);
          setLogoText(settings.logo_text || '[공급자 보관용]');
          setSealImage(settings.print_seal_image || '');
          setHkF2(settings.hk_f2 || 'sales');
          setHkF4(settings.hk_f4 || 'save');
          setHkF7(settings.hk_f7 || 'purchase');
          setHkF8(settings.hk_f8 || 'receivables');
          setHkF9(settings.hk_f9 || 'excel-import');
        }
      } catch (err) {
        console.error("설정 로드 실패:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, []);

  // 본사 사업소 정보 저장
  const handleSaveHqInfo = async (e) => {
    e.preventDefault();
    try {
      const hqData = {
        name: hqName,
        owner,
        reg_no: bizNo,
        phone,
        address,
        business: "업태 / 종목", // 기본값
        is_active: true
      };

      if (hqId) {
        await hqApi.update(hqId, hqData);
      } else {
        const res = await hqApi.create(hqData);
        if (res && res.id) {
          setHqId(res.id);
        }
      }
      alert("본사 사업소 정보가 성공적으로 저장되었습니다!");
      if (onDataChange) onDataChange();
    } catch (err) {
      console.error(err);
      alert("본사 정보 저장 중 오류가 발생했습니다.");
    }
  };

  // ERP 인쇄/단축키 세부 설정 저장
  const handleSaveErpSettings = async (e) => {
    e.preventDefault();
    try {
      const settingsData = {
        paper_size: paperSize,
        margin_top: parseInt(marginTop, 10) || 0,
        margin_left: parseInt(marginLeft, 10) || 0,
        font_size: parseInt(fontSize, 10) || 10,
        logo_text: logoText,
        print_seal_image: sealImage,
        hk_f2: hkF2,
        hk_f4: hkF4,
        hk_f7: hkF7,
        hk_f8: hkF8,
        hk_f9: hkF9
      };
      await erpSettingsApi.update(settingsData);
      alert("ERP 환경 설정이 성공적으로 저장되었습니다!");
      if (onDataChange) onDataChange();
    } catch (err) {
      console.error(err);
      alert("ERP 환경 설정 저장 중 오류가 발생했습니다.");
    }
  };

  // 대표자 직인 도장 이미지 업로드 (Base64 변환)
  const handleSealUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert("이미지 파일만 업로드할 수 있습니다.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const base64 = evt.target.result;
      setSealImage(base64);
      
      // 상태 변경과 동시에 DB 업데이트 처리
      try {
        const settingsData = {
          paper_size: paperSize,
          margin_top: parseInt(marginTop, 10) || 0,
          margin_left: parseInt(marginLeft, 10) || 0,
          font_size: parseInt(fontSize, 10) || 10,
          logo_text: logoText,
          print_seal_image: base64,
          hk_f2: hkF2,
          hk_f4: hkF4,
          hk_f7: hkF7,
          hk_f8: hkF8,
          hk_f9: hkF9
        };
        await erpSettingsApi.update(settingsData);
        alert("대표자 직인 도장 이미지가 업로드 및 반영되었습니다.");
        if (onDataChange) onDataChange();
      } catch (err) {
        console.error(err);
        alert("직인 이미지 저장 중 오류가 발생했습니다.");
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // 대표자 직인 삭제
  const handleSealDelete = async () => {
    if (!confirm("등록된 대표자 직인 도장 이미지를 삭제하시겠습니까?")) return;
    setSealImage('');
    try {
      const settingsData = {
        paper_size: paperSize,
        margin_top: parseInt(marginTop, 10) || 0,
        margin_left: parseInt(marginLeft, 10) || 0,
        font_size: parseInt(fontSize, 10) || 10,
        logo_text: logoText,
        print_seal_image: '',
        hk_f2: hkF2,
        hk_f4: hkF4,
        hk_f7: hkF7,
        hk_f8: hkF8,
        hk_f9: hkF9
      };
      await erpSettingsApi.update(settingsData);
      alert("직인 이미지가 성공적으로 삭제되었습니다. 이제 기본 붉은색 [인] 인주 텍스트가 대신 출력됩니다.");
      if (onDataChange) onDataChange();
    } catch (err) {
      console.error(err);
      alert("직인 이미지 삭제 중 오류가 발생했습니다.");
    }
  };

  // 데이터 백업 내보내기 (JSON 다운로드)
  const handleExportData = async () => {
    try {
      const data = await systemApi.exportData();
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `smart_erp_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("백업 파일 생성 중 오류가 발생했습니다.");
    }
  };

  // 데이터 복원 (JSON 파일 가져오기)
  const handleImportData = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!confirm("⚠️ 주의! 백업 데이터를 복원하시겠습니까?\n복원 시 기존 데이터(거래처, 상품, 전표, 설정 등)는 완전히 지워지고 백업 데이터로 대체됩니다. 이 작업은 되돌릴 수 없습니다.")) {
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const backupData = JSON.parse(evt.target.result);
        const res = await systemApi.importData(backupData);
        if (res.success) {
          alert("데이터 복원이 성공적으로 완료되었습니다. 최신 정보를 반영하기 위해 시스템을 새로고침합니다.");
          window.location.reload();
        } else {
          alert("데이터 복원에 실패했습니다. 지원되지 않는 백업 양식일 수 있습니다.");
        }
      } catch (err) {
        console.error(err);
        alert("백업 데이터 파일 파싱 중 오류가 발생했습니다.");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // 전체 데이터 리셋 (초기화)
  const handleResetData = async () => {
    if (!confirm("🚨 경고! 전체 데이터를 리셋하시겠습니까?\n본사 정보를 제외한 거래명세서(전표), 견적서, 사원, 거래처, 품목, 원장 보정치 및 환경설정이 완전히 초기화됩니다.")) return;
    if (!confirm("정말로 삭제를 진행하시겠습니까? 데이터는 영구적으로 소실됩니다.")) return;

    try {
      const res = await systemApi.resetData();
      if (res.success) {
        alert("데이터가 완전히 초기화되었습니다. 변경사항 반영을 위해 시스템을 새로고침합니다.");
        window.location.reload();
      } else {
        alert("초기화 과정에서 오류가 발생했습니다.");
      }
    } catch (err) {
      console.error(err);
      alert("초기화 API 요청 중 오류가 발생했습니다.");
    }
  };

  if (isLoading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#fff' }}>
        <RefreshCw className="animate-spin" size={24} style={{ margin: '0 auto 10px auto' }} />
        <span>ERP 설정을 로드 중입니다...</span>
      </div>
    );
  }

  const menuOptions = [
    { value: 'dashboard', label: '대시보드' },
    { value: 'partners', label: '거래처 관리' },
    { value: 'products', label: '품목 관리' },
    { value: 'sales', label: '매출거래 관리' },
    { value: 'purchase', label: '매입거래 관리' },
    { value: 'estimates', label: '견적서 관리' },
    { value: 'receivables', label: '외상대금 관리' },
    { value: 'company-base', label: '회사/부서/은행 관리' },
    { value: 'settings', label: '시스템 설정' }
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', textAlign: 'left' }} className="responsive-split">
      {/* 좌측: 회사 기본 정보 및 도장 설정 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* 회사 기본 정보 */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.02)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '12px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}>
          <div>
            <h3 style={{ margin: '0 0 4px 0', color: '#fff', fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Award size={20} style={{ color: 'var(--primary-color)' }} />
              본사 사업소 정보 설정
            </h3>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              매출 및 매입 거래명세서 발행 시 공급자(본사) 정보로 인쇄될 기본 인적사항입니다.
            </p>
          </div>

          <form onSubmit={handleSaveHqInfo} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="form-group">
              <label>상호 (회사명)</label>
              <input
                type="text"
                required
                value={hqName}
                onChange={(e) => setHqName(e.target.value)}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label>대표자 성명</label>
                <input
                  type="text"
                  required
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>사업자 등록 번호</label>
                <input
                  type="text"
                  required
                  value={bizNo}
                  onChange={(e) => setBizNo(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label>대표 전화 번호</label>
              <input
                type="text"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>사업소 소재지 (주소)</label>
              <input
                type="text"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ marginTop: '8px' }}
            >
              본사 설정 저장
            </button>
          </form>
        </div>

        {/* 대표자 직인 도장 설정 */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.02)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '12px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}>
          <div>
            <h3 style={{ margin: '0 0 4px 0', color: '#fff', fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Printer size={20} style={{ color: '#34d399' }} />
              대표자 직인 이미지 설정
            </h3>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              인쇄 시 출력될 대표자 서명 직인(도장) 이미지 파일을 등록합니다.
            </p>
          </div>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px dashed rgba(255, 255, 255, 0.15)',
            borderRadius: '12px',
            padding: '30px 20px',
            background: 'rgba(0,0,0,0.15)',
            textAlign: 'center',
            gap: '16px'
          }}>
            {sealImage ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '72px',
                  height: '72px',
                  background: '#fff',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 8px 16px rgba(0,0,0,0.3)',
                  padding: '4px'
                }}>
                  <img
                    src={sealImage}
                    alt="CEO Seal"
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                  />
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>대표자 직인 도장이 등록되었습니다.</div>
                <button
                  type="button"
                  className="btn btn-danger"
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.75rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  onClick={handleSealDelete}
                >
                  <Trash2 size={12} />
                  등록 직인 삭제
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'rgba(255,255,255,0.3)'
                }}>
                  <Upload size={28} />
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  배경이 없거나(PNG 투명) 흰색인<br />도장 이미지 파일을 업로드해 주세요.
                </div>
                <button
                  type="button"
                  className="btn"
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    color: '#fff',
                    fontSize: '0.8rem',
                    padding: '6px 16px'
                  }}
                  onClick={() => document.getElementById('seal-file-input').click()}
                >
                  직인 이미지 찾기
                </button>
                <input
                  type="file"
                  id="seal-file-input"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleSealUpload}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 우측: 인쇄 레이아웃, 단축키 매핑, 데이터 관리 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* 인쇄 및 단축키 매핑 설정 */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.02)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '12px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}>
          <div>
            <h3 style={{ margin: '0 0 4px 0', color: '#fff', fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <SettingsIcon size={20} style={{ color: '#a78bfa' }} />
              인쇄 여백 및 단축키 환경 설정
            </h3>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              인쇄 레이아웃의 상세 여백, 로고 문구 및 F2~F9 전역 단축버튼 매핑을 정의합니다.
            </p>
          </div>

          <form onSubmit={handleSaveErpSettings} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label>용지 규격</label>
                <select value={paperSize} onChange={(e) => setPaperSize(e.target.value)}>
                  <option value="A4">A4 (기본)</option>
                  <option value="A5">A5Landscape (견적서/명세서)</option>
                </select>
              </div>
              <div className="form-group">
                <label>기본 폰트 크기 (pt)</label>
                <input
                  type="number"
                  required
                  min="6"
                  max="16"
                  value={fontSize}
                  onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label>상단 인쇄 여백 (Margin Top - px)</label>
                <input
                  type="number"
                  required
                  min="0"
                  max="100"
                  value={marginTop}
                  onChange={(e) => setMarginTop(parseInt(e.target.value, 10))}
                />
              </div>
              <div className="form-group">
                <label>좌측 인쇄 여백 (Margin Left - px)</label>
                <input
                  type="number"
                  required
                  min="0"
                  max="100"
                  value={marginLeft}
                  onChange={(e) => setMarginLeft(parseInt(e.target.value, 10))}
                />
              </div>
            </div>

            <div className="form-group">
              <label>출력 로고 문구 (우측 상단 서브라벨)</label>
              <input
                type="text"
                required
                value={logoText}
                onChange={(e) => setLogoText(e.target.value)}
                placeholder="예: [공급자 보관용]"
              />
            </div>

            <hr style={{ border: '0', borderTop: '1px solid rgba(255,255,255,0.08)', margin: '8px 0' }} />

            <div>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#fff' }}>전역 단축키 지정 (키보드 단축 버튼)</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>F2 키 동작</label>
                  <select value={hkF2} onChange={(e) => setHkF2(e.target.value)}>
                    {menuOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>F4 키 동작</label>
                  <select value={hkF4} onChange={(e) => setHkF4(e.target.value)}>
                    <option value="save">원장 저장/동기화</option>
                    <option value="print">현재 문서 인쇄</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>F7 키 동작</label>
                  <select value={hkF7} onChange={(e) => setHkF7(e.target.value)}>
                    {menuOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>F8 키 동작</label>
                  <select value={hkF8} onChange={(e) => setHkF8(e.target.value)}>
                    {menuOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
                <div className="form-group">
                  <label>F9 키 동작</label>
                  <select value={hkF9} onChange={(e) => setHkF9(e.target.value)}>
                    <option value="excel-import">매출 엑셀가져오기</option>
                    {menuOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="btn"
              style={{
                marginTop: '12px',
                background: 'linear-gradient(135deg, #a78bfa, #8b5cf6)',
                color: '#fff'
              }}
            >
              인쇄 & 단축키 설정 저장
            </button>
          </form>
        </div>

        {/* 시스템 백업 / 복구 / 리셋 */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.02)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '12px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}>
          <div>
            <h3 style={{ margin: '0 0 4px 0', color: '#fff', fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Download size={20} style={{ color: '#f59e0b' }} />
              시스템 관리 및 데이터 백업 / 복구
            </h3>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              클라우드 데이터베이스의 전체 자료를 다운로드 백업하거나, 백업 파일로부터 복원하고 리셋할 수 있습니다.
            </p>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            <button
              type="button"
              className="btn btn-warning"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flex: '1 1 140px', justifyContent: 'center' }}
              onClick={handleExportData}
            >
              <Download size={16} />
              JSON 데이터 백업 다운로드
            </button>

            <button
              type="button"
              className="btn"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                flex: '1 1 140px',
                justifyContent: 'center',
                background: 'rgba(255, 255, 255, 0.1)',
                color: '#fff'
              }}
              onClick={() => document.getElementById('backup-file-input').click()}
            >
              <Upload size={16} />
              백업 파일 업로드 복원
            </button>
            <input
              type="file"
              id="backup-file-input"
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleImportData}
            />

            <button
              type="button"
              className="btn btn-danger"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', width: '100%', justifyContent: 'center', marginTop: '4px' }}
              onClick={handleResetData}
            >
              <Trash2 size={16} />
              🚨 전체 시스템 초기화 (Reset)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
