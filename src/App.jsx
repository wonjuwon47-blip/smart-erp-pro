import React, { useState, useEffect } from 'react';
import AuthScreen from './components/AuthScreen';
import Dashboard from './pages/Dashboard';
import SalesManagement from './pages/SalesManagement';
import PurchaseManagement from './pages/PurchaseManagement';
import ProductManagement from './pages/ProductManagement';
import PartnerManagement from './pages/PartnerManagement';
import Settings from './pages/Settings';
import { authApi, productApi, partnerApi, invoiceApi } from './services/api';
import { Shield, LayoutDashboard, ArrowUpRight, ArrowDownRight, Package, Users, Settings as SettingsIcon, LogOut, Loader2 } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState(null);
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);

  // ERP 전역 데이터 상태
  const [products, setProducts] = useState([]);
  const [partners, setPartners] = useState([]);
  const [invoices, setInvoices] = useState([]);

  // 본사(HQ) 상호 정보 표시용
  const [hqName, setHqName] = useState('본사 사업소');

  useEffect(() => {
    // 1. 기존 세션 토큰 확인
    const token = localStorage.getItem('smart_erp_token');
    const savedUser = localStorage.getItem('smart_erp_user');
    
    if (token && savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('smart_erp_token');
        localStorage.removeItem('smart_erp_user');
      }
    }
    setLoading(false);

    // 2. 세션 만료 강제 로그아웃 리스너 바인딩
    const handleAuthExpired = () => {
      setUser(null);
      alert("세션이 만료되어 자동으로 로그아웃되었습니다. 다시 로그인 해 주세요.");
    };
    window.addEventListener('auth-expired', handleAuthExpired);

    return () => {
      window.removeEventListener('auth-expired', handleAuthExpired);
    };
  }, []);

  // 로그인 상태인 경우 ERP 데이터 동기화
  useEffect(() => {
    if (user) {
      fetchCommonData();
      loadHqInfo();
    }
  }, [user]);

  const loadHqInfo = () => {
    const savedHq = localStorage.getItem('smart_erp_hq_info');
    if (savedHq) {
      try {
        const parsed = JSON.parse(savedHq);
        setHqName(parsed.hqName || '본사 사업소');
      } catch (e) {}
    }
  };

  const fetchCommonData = async () => {
    if (!localStorage.getItem('smart_erp_token')) return;
    setDataLoading(true);
    try {
      const [prodData, partData, invData] = await Promise.all([
        productApi.getAll(),
        partnerApi.getAll(),
        invoiceApi.getAll()
      ]);
      setProducts(prodData);
      setPartners(partData);
      setInvoices(invData);
      loadHqInfo(); // 직인/회사 정보 업데이트 대비 로드
    } catch (err) {
      console.error("ERP data sync fail:", err);
    } finally {
      setDataLoading(false);
    }
  };

  const handleAuthSuccess = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    if (!confirm("정말 로그아웃 하시겠습니까?")) return;
    authApi.logout();
    setUser(null);
    setCurrentTab('dashboard');
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        width: '100vw',
        background: '#0f0c1b',
        color: '#fff',
        fontFamily: 'Inter, sans-serif'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <Loader2 className="spin-icon" size={36} style={{ color: 'var(--primary-color)', animation: 'spin 1.5s linear infinite' }} />
          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>ERP 시스템 보안 검증 중...</div>
        </div>
      </div>
    );
  }

  // 로그인 하지 않은 유저 차단
  if (!user) {
    return <AuthScreen onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      width: '100vw',
      background: 'radial-gradient(circle at bottom left, #1b1333, #0b0816)',
      fontFamily: 'Inter, system-ui, sans-serif',
      color: '#fff',
      boxSizing: 'border-box'
    }}>
      {/* 1. 사이드바 내비게이션 (글래스모피즘) */}
      <aside style={{
        width: '240px',
        background: 'rgba(255, 255, 255, 0.02)',
        backdropFilter: 'blur(10px)',
        borderRight: '1px solid rgba(255, 255, 255, 0.05)',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 16px',
        boxSizing: 'border-box',
        flexShrink: 0
      }} className="sidebar-container">
        {/* 로고 영역 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginBottom: '32px',
          paddingLeft: '8px'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #a78bfa, #818cf8)',
            color: '#fff',
            borderRadius: '8px',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)'
          }}>
            <Shield size={18} />
          </div>
          <span style={{ fontSize: '1.1rem', fontWeight: '800', letterSpacing: '-0.3px', color: '#fff' }}>Smart ERP Pro</span>
        </div>

        {/* 탭 내비게이션 메뉴 */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
          <button
            className={`nav-btn ${currentTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setCurrentTab('dashboard')}
            style={navBtnStyle(currentTab === 'dashboard')}
          >
            <LayoutDashboard size={16} />
            종합 대시보드
          </button>
          
          <button
            className={`nav-btn ${currentTab === 'sales' ? 'active' : ''}`}
            onClick={() => setCurrentTab('sales')}
            style={navBtnStyle(currentTab === 'sales')}
          >
            <ArrowUpRight size={16} />
            매출 거래 관리
          </button>

          <button
            className={`nav-btn ${currentTab === 'purchase' ? 'active' : ''}`}
            onClick={() => setCurrentTab('purchase')}
            style={navBtnStyle(currentTab === 'purchase')}
          >
            <ArrowDownRight size={16} />
            매입 거래 관리
          </button>

          <button
            className={`nav-btn ${currentTab === 'products' ? 'active' : ''}`}
            onClick={() => setCurrentTab('products')}
            style={navBtnStyle(currentTab === 'products')}
          >
            <Package size={16} />
            기초 상품 관리
          </button>

          <button
            className={`nav-btn ${currentTab === 'partners' ? 'active' : ''}`}
            onClick={() => setCurrentTab('partners')}
            style={navBtnStyle(currentTab === 'partners')}
          >
            <Users size={16} />
            기초 거래처 관리
          </button>

          <button
            className={`nav-btn ${currentTab === 'settings' ? 'active' : ''}`}
            onClick={() => setCurrentTab('settings')}
            style={navBtnStyle(currentTab === 'settings')}
          >
            <SettingsIcon size={16} />
            설정 및 데이터 관리
          </button>
        </nav>

        {/* 하단 사용자 정보 및 로그아웃 */}
        <div style={{
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          paddingTop: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ textAlign: 'left', paddingLeft: '8px' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#fff' }}>{user.name} ({user.role})</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{hqName}</div>
          </div>
          <button
            onClick={handleLogout}
            style={{
              padding: '8px 12px',
              fontSize: '0.8rem',
              color: '#fca5a5',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.background = 'rgba(239, 68, 68, 0.15)'}
            onMouseLeave={(e) => e.target.style.background = 'rgba(239, 68, 68, 0.1)'}
          >
            <LogOut size={14} />
            ERP 로그아웃
          </button>
        </div>
      </aside>

      {/* 2. 메인 컨텐츠 영역 */}
      <main style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0, // Flex 하위 요소 스퀴즈 버그 방지
        boxSizing: 'border-box'
      }}>
        {/* 상단 헤더 바 */}
        <header style={{
          height: '64px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          padding: '0 32px',
          background: 'rgba(0,0,0,0.1)',
          boxSizing: 'border-box',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {dataLoading && (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Loader2 className="spin-icon" size={12} style={{ animation: 'spin 1.5s linear infinite' }} />
                데이터 연동 중...
              </span>
            )}
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              회사 라이선스 식별 ID: <strong style={{ color: '#fff', fontFamily: 'monospace' }}>COMP-{user.companyId}</strong>
            </span>
          </div>
        </header>

        {/* 탭 페이지 본문 컨테이너 */}
        <div style={{
          flex: 1,
          padding: '32px',
          overflowY: 'auto',
          boxSizing: 'border-box'
        }}>
          {currentTab === 'dashboard' && (
            <Dashboard products={products} partners={partners} invoices={invoices} />
          )}
          {currentTab === 'sales' && (
            <SalesManagement products={products} partners={partners} invoices={invoices} onDataChange={fetchCommonData} />
          )}
          {currentTab === 'purchase' && (
            <PurchaseManagement products={products} partners={partners} invoices={invoices} onDataChange={fetchCommonData} />
          )}
          {currentTab === 'products' && (
            <ProductManagement products={products} onDataChange={fetchCommonData} />
          )}
          {currentTab === 'partners' && (
            <PartnerManagement partners={partners} onDataChange={fetchCommonData} />
          )}
          {currentTab === 'settings' && (
            <Settings onDataChange={fetchCommonData} />
          )}
        </div>
      </main>
    </div>
  );
}

// 네비게이션 버튼 공용 스타일 헬퍼
function navBtnStyle(isActive) {
  return {
    width: '100%',
    padding: '12px 16px',
    background: isActive ? 'rgba(167, 139, 250, 0.12)' : 'transparent',
    border: 'none',
    borderRadius: '8px',
    color: isActive ? '#fff' : 'rgba(255, 255, 255, 0.6)',
    fontWeight: isActive ? 'bold' : 'normal',
    fontSize: '0.9rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    transition: 'background 0.2s, color 0.2s',
    outline: 'none',
    textAlign: 'left'
  };
}
