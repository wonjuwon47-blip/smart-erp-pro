import React, { useState, useEffect } from 'react';
import { Upload, Trash2, Award, Printer, Download, RefreshCw, AlertTriangle } from 'lucide-react';
import { settingsApi, backupApi } from '../services/api';

export default function Settings({ onDataChange }) {
  // 본사 기본 정보 설정
  const [hqName, setHqName] = useState('본사 사업소');
  const [owner, setOwner] = useState('대표자명');
  const [bizNo, setBizNo] = useState('123-45-67890');
  const [address, setAddress] = useState('서울특별시 서초구 서초대로 123');
  const [phone, setPhone] = useState('02-1234-5678');
  
  // 직인 도장 이미지 (Base64)
  const [sealImage, setSealImage] = useState('');

  // 용지 및 여백 인쇄 설정
  const [paperSize, setPaperSize] = useState('A5');
  const [marginTop, setMarginTop] = useState(6);
  const [marginLeft, setMarginLeft] = useState(6);
  const [fontSize, setFontSize] = useState(0.72);
  const [logoText, setLogoText] = useState('매 출 거 래 명 세 서');

  // 단축키 사용 여부
  const [useShortcuts, setUseShortcuts] = useState(true);

  useEffect(() => {
    // 본사 정보 및 설정 로드
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      // 1. 본사 정보 로컬스토리지 우선 로드
      const savedHq = localStorage.getItem('smart_erp_hq_info');
      if (savedHq) {
        try {
          const parsed = JSON.parse(savedHq);
          setHqName(parsed.hqName || '본사 사업소');
          setOwner(parsed.owner || '대표자명');
          setBizNo(parsed.bizNo || '123-45-67890');
          setAddress(parsed.address || '서울특별시 서초구 서초대로 123');
          setPhone(parsed.phone || '02-1234-5678');
        } catch (e) {}
      }

      const savedSeal = localStorage.getItem('smart_erp_seal_image');
      if (savedSeal) {
        setSealImage(savedSeal);
      }

      // 2. 백엔드에서 인쇄 및 추가 세팅값 로드
      const backendSettings = await settingsApi.get();
      if (backendSettings) {
        setPaperSize(backendSettings.paper_size || 'A5');
        setMarginTop(backendSettings.margin_top || 6);
        setMarginLeft(backendSettings.margin_left || 6);
        setFontSize(backendSettings.font_size || 0.72);
        setLogoText(backendSettings.logo_text || '매 출 거 래 명 세 서');
        setUseShortcuts(backendSettings.use_shortcuts !== false);

        // 로컬스토리지에도 인쇄 세팅을 동적 갱신하여 인쇄 시 즉각 CSS에 적용될 수 있도록 처리
        localStorage.setItem('smart_erp_print_settings', JSON.stringify({
          paperSize: backendSettings.paper_size || 'A5',
          marginTop: backendSettings.margin_top || 6,
          marginLeft: backendSettings.margin_left || 6,
          fontSize: backendSettings.font_size || 0.72,
          logoText: backendSettings.logo_text || '매 출 거 래 명 세 서'
        }));
      }
    } catch (err) {
      console.error("Failed to load settings:", err);
    }
  };

  const handleSaveHqInfo = (e) => {
    e.preventDefault();
    const info = { hqName, owner, bizNo, address, phone };
    localStorage.setItem('smart_erp_hq_info', JSON.stringify(info));
    alert("본사 사업소 설정이 성공적으로 저장되었습니다!");
    if (onDataChange) onDataChange();
  };

  // 인쇄 및 단축키 설정 백엔드 API 저장
  const handleSavePrintSettings = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        paper_size: paperSize,
        margin_top: parseFloat(marginTop) || 0,
        margin_left: parseFloat(marginLeft) || 0,
        font_size: parseFloat(fontSize) || 0.72,
        logo_text: logoText,
        use_shortcuts: useShortcuts
      };
      await settingsApi.save(payload);

      // 로컬 스토리지 동시 동기화
      localStorage.setItem('smart_erp_print_settings', JSON.stringify({
        paperSize,
        marginTop,
        marginLeft,
        fontSize,
        logoText
      }));
      localStorage.setItem('smart_erp_use_shortcuts', String(useShortcuts));

      alert("인쇄 여백 및 단축키 옵션 설정이 백엔드 DB와 브라우저에 영구 저장되었습니다!");
      if (onDataChange) onDataChange();
    } catch (err) {
      console.error(err);
      alert("설정 저장에 실패했습니다.");
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
    reader.onload = (evt) => {
      const base64 = evt.target.result;
      setSealImage(base64);
      localStorage.setItem('smart_erp_seal_image', base64);
      alert("대표자 직인 도장 이미지가 설정되었습니다. 거래명세서 출력 시 대표명 옆에 자동 인쇄됩니다.");
      if (onDataChange) onDataChange();
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSealDelete = () => {
    if (!confirm("등록된 대표자 직인 도장 이미지를 삭제하시겠습니까?")) return;
    setSealImage('');
    localStorage.removeItem('smart_erp_seal_image');
    alert("직인 이미지가 삭제되었습니다. 이제 기본 붉은색 [인] 인주 텍스트가 대신 출력됩니다.");
    if (onDataChange) onDataChange();
  };

  // 백업 파일 내보내기 (JSON 다운로드)
  const handleExportBackup = async () => {
    try {
      const data = await backupApi.export();
      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(data, null, 2)
      )}`;
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', jsonString);
      downloadAnchor.setAttribute(
        'download',
        `smart_erp_backup_${new Date().toISOString().substring(0, 10)}.json`
      );
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      alert("장부 데이터 백업 JSON 파일이 성공적으로 다운로드되었습니다.");
    } catch (err) {
      console.error(err);
      alert("자료 내보내기에 실패했습니다.");
    }
  };

  // 백업 파일 업로드 복구
  const handleImportBackup = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!confirm("경고: 파일 데이터를 복구하면 현재 데이터베이스의 모든 자료가 덮어씌워져 유실될 수 있습니다.\n계속해서 복구하시겠습니까?")) {
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = JSON.parse(evt.target.result);
        await backupApi.import(data);
        alert("장부 자료 복구가 완료되었습니다. 변경 사항을 반영하기 위해 애플리케이션을 새로고침합니다.");
        window.location.reload();
      } catch (err) {
        console.error(err);
        alert("백업 파일 처리 중 에러가 발생했습니다. 올바른 백업 JSON 구조인지 확인해 주세요.");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // 장부 전체 데이터 초기화
  const handleResetData = async () => {
    if (!confirm("🚨 [경고] 정말로 모든 장부 기록(거래명세서, 견적서, 거래처, 상품 등)을 영구 삭제하시겠습니까?\n이 작업은 취소할 수 없습니다.")) return;
    try {
      await backupApi.reset();
      localStorage.removeItem('smart_erp_hq_info');
      localStorage.removeItem('smart_erp_seal_image');
      alert("모든 데이터베이스 및 로컬 정보가 공장초기화되었습니다.");
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert("장부 데이터 초기화 중 오류가 발생했습니다.");
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '20px', textAlign: 'left' }} className="responsive-split">
      {/* 좌측: 본사 기본 정보 및 장부 관리 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* 본사 정보 */}
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

        {/* 자료 백업/복구 및 장부 초기화 (자료 관리) */}
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
            <h3 style={{ margin: '0 0 4px 0', color: '#fff', fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <RefreshCw size={20} style={{ color: '#fbbf24' }} />
              장부 데이터 백업 및 자료 관리
            </h3>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              데이터를 내보내어 안전하게 보관하거나, 이전 백업본에서 복구 및 리셋을 진행합니다.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <button
              type="button"
              className="btn"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                background: 'rgba(52, 211, 153, 0.15)',
                color: '#34d399',
                border: '1px solid rgba(52, 211, 153, 0.3)'
              }}
              onClick={handleExportBackup}
            >
              <Download size={16} />
              자료 백업 내보내기
            </button>

            <button
              type="button"
              className="btn"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                background: 'rgba(96, 165, 250, 0.15)',
                color: '#60a5fa',
                border: '1px solid rgba(96, 165, 250, 0.3)'
              }}
              onClick={() => document.getElementById('backup-file-input').click()}
            >
              <Upload size={16} />
              백업본 파일 복구
            </button>
            <input
              type="file"
              id="backup-file-input"
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleImportBackup}
            />
          </div>

          <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '16px', marginTop: '4px' }}>
            <button
              type="button"
              className="btn btn-danger"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
              onClick={handleResetData}
            >
              <AlertTriangle size={16} />
              장부 데이터 전체 공장초기화 (리셋)
            </button>
          </div>
        </div>
      </div>

      {/* 우측: 인쇄 상세 여백 설정 및 직인 도장 설정 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* 인쇄 상세 여백 및 용지 규격 설정 */}
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
              <Printer size={20} style={{ color: 'var(--primary-color)' }} />
              거래명세서 인쇄 규격 및 세부 여백 설정
            </h3>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              명세서 및 견적서 출력 시의 용지 크기, 상단/좌측 마진 여백, 폰트 크기 비율을 설정합니다.
            </p>
          </div>

          <form onSubmit={handleSavePrintSettings} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label>기본 출력 용지 크기</label>
                <select value={paperSize} onChange={(e) => setPaperSize(e.target.value)}>
                  <option value="A5">A5 용지 규격 (기본)</option>
                  <option value="A4">A4 용지 규격</option>
                </select>
              </div>
              <div className="form-group">
                <label>로고 및 타이틀 텍스트</label>
                <input
                  type="text"
                  value={logoText}
                  onChange={(e) => setLogoText(e.target.value)}
                  placeholder="예: 매 출 거 래 명 세 서"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label>상단 여백 (Margin, mm)</label>
                <input
                  type="number"
                  min="0"
                  max="50"
                  step="0.5"
                  value={marginTop}
                  onChange={(e) => setMarginTop(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>좌측 여백 (Margin, mm)</label>
                <input
                  type="number"
                  min="0"
                  max="50"
                  step="0.5"
                  value={marginLeft}
                  onChange={(e) => setMarginLeft(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>폰트 글꼴 비율 (Scale, rem)</label>
                <input
                  type="number"
                  min="0.5"
                  max="1.5"
                  step="0.01"
                  value={fontSize}
                  onChange={(e) => setFontSize(e.target.value)}
                />
              </div>
            </div>

            <div style={{
              background: 'rgba(0,0,0,0.15)',
              padding: '12px',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.8rem'
            }}>
              <span>회계 단축키 기능 자동 활성화 (F2/F4/F7/F8/F9)</span>
              <button 
                type="button" 
                onClick={() => setUseShortcuts(!useShortcuts)}
                style={{
                  width: '50px',
                  height: '24px',
                  borderRadius: '12px',
                  background: useShortcuts ? 'var(--primary-color)' : 'rgba(255,255,255,0.1)',
                  border: 'none',
                  position: 'relative',
                  cursor: 'pointer',
                  transition: 'background 0.3s'
                }}
              >
                <div style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  background: '#fff',
                  position: 'absolute',
                  top: '3px',
                  left: useShortcuts ? '29px' : '3px',
                  transition: 'left 0.3s',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }} />
              </button>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
            >
              인쇄 및 기능 옵션 설정 저장
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
              대표자 직인 도장 설정
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
            padding: '24px 20px',
            background: 'rgba(0,0,0,0.15)',
            textAlign: 'center',
            gap: '12px'
          }}>
            {sealImage ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '64px',
                  height: '64px',
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
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>대표자 직인이 등록되었습니다.</div>
                <button
                  type="button"
                  className="btn btn-danger"
                  style={{
                    padding: '4px 10px',
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
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'rgba(255,255,255,0.3)'
                }}>
                  <Upload size={24} />
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  PNG 투명배경 또는 흰색 배경의 도장 파일을 등록하세요.
                </div>
                <button
                  type="button"
                  className="btn"
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    color: '#fff',
                    fontSize: '0.8rem',
                    padding: '5px 12px'
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

        {/* 단축키 매뉴얼 안내 */}
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '8px',
          padding: '16px',
          fontSize: '0.78rem',
          color: 'var(--text-muted)',
          lineHeight: 1.6
        }}>
          💡 <strong>장부 사용 단축키 안내 (활성화 시 작동):</strong>
          <table style={{ width: '100%', marginTop: '6px', borderCollapse: 'collapse' }}>
            <tbody>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}><td style={{ padding: '3px 0', fontWeight: 'bold', color: '#fff', width: '20%' }}>F2</td><td style={{ padding: '3px 0' }}>매출 거래 관리 화면으로 즉시 이동</td></tr>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}><td style={{ padding: '3px 0', fontWeight: 'bold', color: '#fff' }}>F4</td><td style={{ padding: '3px 0' }}>매입 거래 관리 화면으로 즉시 이동</td></tr>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}><td style={{ padding: '3px 0', fontWeight: 'bold', color: '#fff' }}>F7</td><td style={{ padding: '3px 0' }}>외상대금/미수금 관리 화면으로 즉시 이동</td></tr>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}><td style={{ padding: '3px 0', fontWeight: 'bold', color: '#fff' }}>F8</td><td style={{ padding: '3px 0' }}>견적서 관리 화면으로 즉시 이동</td></tr>
              <tr><td style={{ padding: '3px 0', fontWeight: 'bold', color: '#fff' }}>F9</td><td style={{ padding: '3px 0' }}>거래처 및 장바구니에 기입된 전표 저장 및 인쇄 실행</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
