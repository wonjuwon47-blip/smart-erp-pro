// 통합 ERP 프로그램 비즈니스 로직 및 목업 시뮬레이터 (이지폼 19종 스크린샷 완벽 대응)

// --- 비즈니스 상수 정의 ---
const TAX_RATE = 0.1;
const STATUS_CREDIT = "청구(외상)";
const STATUS_PAID = "영수(완납)";
const TAX_TYPE_EXEMPT = "면세";
const TAX_TYPE_TAXABLE = "과세";
const PARTNER_TYPE_PURCHASE = "매입처";
const PARTNER_TYPE_SALES = "매출처";
const PARTNER_TYPE_MIXED = "혼합";
const MAX_EMPTY_INVOICE_ROWS = 4;
const OCR_MOCK_DELAY_MS = 1500;
const AUTO_MARKUP_MARGIN = 1.3;
const INLINE_INPUT_STYLE = "background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.15); color:#fff; padding:2px 4px; border-radius:4px;";

// --- HTML 이스케이프 유틸리티 (XSS 방어) ---
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// --- 한국 표준시(KST) 오늘 날짜 구하기 ---
function getKstTodayString() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return (new Date(now.getTime() - offset)).toISOString().substring(0, 10);
}

// --- 엑셀 날짜 일련번호 변환 유틸리티 ---
function parseExcelDate(serial) {
  if (!serial) return "";
  if (isNaN(serial)) {
    const s = String(serial).trim();
    if (s.includes("-")) return s.substring(0, 10);
    return s;
  }
  const dateObj = new Date(Math.round((Number(serial) - 25569) * 86400 * 1000));
  const y = dateObj.getUTCFullYear();
  const m = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// --- 인쇄용 동적 스타일 태그 제어 ---
function injectPrintStyle(cssText) {
  let styleEl = document.getElementById("print-dynamic-style");
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = "print-dynamic-style";
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = cssText;
}

function clearPrintStyle() {
  const styleEl = document.getElementById("print-dynamic-style");
  if (styleEl) {
    styleEl.remove();
  }
}

// --- 라벨 인쇄 스위치 강제 리셋 (OFF 상태로 초기화) ---
function resetLabelPrintToggle() {
  const toggleWrapper = document.getElementById("label-print-toggle-wrapper");
  const inputToggle = document.getElementById("sales-label-print-toggle");
  if (toggleWrapper && inputToggle) {
    inputToggle.value = "off";
    const track = toggleWrapper.querySelector(".toggle-track");
    const textEl = toggleWrapper.querySelector(".toggle-text");
    if (track) track.className = "toggle-track off";
    if (textEl) textEl.textContent = "OFF";
  }
}


// --- 엑셀 단위 및 품명 정규화 (1000g/kg -> kg) ---
function sanitizeExcelUnitAndName(str) {
  if (str === null || str === undefined) return "";
  let s = String(str);
  // 1000g/kg, 1000g(kg), 1000g/1kg 등 혼용/중복 단위는 kg로 단일화
  s = s.replace(/1000g\s*[\/\-\(]?\s*1?kg\s*\)?/gi, 'kg');
  // 1000g 단독 단위도 kg로 치환
  s = s.replace(/1000g/gi, 'kg');
  return s;
}

// --- DOM 요소 캐싱 (유지보수성 향상) ---
const uiElements = {
  get purDate() { return document.getElementById("pur-date"); },
  get purItemIncoming() { return document.getElementById("pur-item-incoming"); },
  get salesDate() { return document.getElementById("sales-date"); },
  get salesItemIncoming() { return document.getElementById("sales-item-incoming"); },
  get printDocumentArea() { return document.getElementById("print-document-area"); },
  get formPurchaseBill() { return document.getElementById("form-purchase-bill"); },
  get formSalesBill() { return document.getElementById("form-sales-bill"); },
  get btnPurchaseSubmit() { return document.getElementById("btn-purchase-submit"); },
  get btnSalesSubmit() { return document.getElementById("btn-sales-submit"); }
};

// --- 1. 초기 데이터베이스 모델 정의 및 오프라인 영속성 보장 ---
const defaultDb = {
  headquarters: [
    { id: "hq01", name: "(주)푸드유통 서울본사", regNo: "120-81-12345", owner: "김대표", address: "서울특별시 강남구 테헤란로 501", business: "도소매 / 농수산물" },
    { id: "hq02", name: "(주)푸드유통 인천지사", regNo: "135-85-99887", owner: "박지사장", address: "인천광역시 남동구 남동대로 12", business: "제조 / 식품가공" }
  ],
  activeHqId: "hq01",
  employees: [
    { code: "E001", name: "홍길동", dept: "영업1부", position: "대리", phone: "010-1234-5678" },
    { code: "E002", name: "김철수", dept: "물류과", position: "과장", phone: "010-9876-5432" }
  ],
  banks: [
    { name: "신한은행", accNo: "110-382-998877", owner: "(주)푸드유통본사", balance: 45000000 },
    { name: "국민은행", accNo: "043-21-0988711", owner: "(주)푸드유통본사", balance: 120000000 }
  ],
  partners: [
    { code: "P001", name: "한울농산 (매입처)", owner: "최한울", bizNo: "113-22-99887", address: "경기도 여주시 가남읍 33", phone: "031-443-1234", type: "매입처" },
    { code: "P002", name: "서해어업 (매입처)", owner: "서서해", bizNo: "220-41-11223", address: "충청남도 보령시 해안로 10", phone: "041-930-5566", type: "매입처" },
    { code: "P003", name: "이마트 가락점 (매출처)", owner: "강이마트", bizNo: "105-87-00991", address: "서울특별시 송파구 양재대로 932", phone: "02-400-8877", type: "매출처" },
    { code: "P004", name: "롯데슈퍼 신촌점 (매출처)", owner: "이롯데", bizNo: "106-88-22334", address: "서울특별시 마포구 백범로 22", phone: "02-334-9988", type: "매출처" }
  ],
  products: [
    { code: "PRD001", name: "경북 부사 사과 (10kg)", unit: "BOX", origin: "국내산(청송)", purchasePrice: 22000, salesPrice: 32000, taxType: "면세", stock: 120 },
    { code: "PRD002", name: "칠레산 포도 (5kg)", unit: "BOX", origin: "칠레산", purchasePrice: 15000, salesPrice: 24000, taxType: "과세", stock: 85 },
    { code: "PRD003", name: "냉동 흰다리새우 (1kg)", unit: "EA", origin: "베트남산", purchasePrice: 8500, salesPrice: 13000, taxType: "과세", stock: 240 }
  ],
  purchases: [
    { 
      id: "PUR-20260515-01", 
      date: "2026-05-15", 
      partner: "한울농산 (매입처)", 
      items: [
        { name: "경북 부사 사과 (10kg)", unit: "BOX", origin: "국내산(청송)", qty: 50, price: 22000, amount: 1100000, tax: 0, total: 1100000 }
      ],
      amount: 1100000, 
      tax: 0, 
      total: 1100000,
      status: "청구(외상)"
    }
  ],
  sales: [
    { 
      id: "SAL-20260520-01", 
      date: "2026-05-20", 
      partner: "이마트 가락점 (매출처)", 
      items: [
        { name: "경북 부사 사과 (10kg)", unit: "BOX", origin: "국내산(청송)", incomingDate: "2026-05-15", qty: 10, price: 32000, amount: 320000, tax: 0, total: 320000 }
      ],
      amount: 320000, 
      tax: 0, 
      total: 320000,
      status: "청구(외상)"
    }
  ],
  settings: {
    paperSize: "A4",
    marginTop: 15,
    marginLeft: 15,
    fontSize: 10,
    logoText: "[공급자 보관용]",
    hkF2: "sales",
    hkF4: "save",
    hkF7: "purchase",
    hkF8: "receivables",
    hkF9: "excel-import",
    printSealImage: "",
    labelFonts: {
      title: 22,
      product: 22,
      origin: 18,
      weight: 28,
      supplier: 10.5,
      date: 23
    },
    labelPreset: "60x60",
    labelWidth: 60,
    labelHeight: 60
  },
  // 거래처별 수금/지급액 누계 (외상 관리용)
  receivablesPayments: {},
  estimates: [],
  uploadedSchoolFiles: []
};

let db = JSON.parse(localStorage.getItem("erp_db_pro")) || defaultDb;

// 호환성 업데이트
db.estimates = db.estimates || [];
if (!db.settings.hkF7) db.settings.hkF7 = "purchase";
if (!db.settings.hkF8) db.settings.hkF8 = "receivables";
if (!db.settings.hkF9) db.settings.hkF9 = "excel-import";
if (db.settings.printSealImage === undefined) db.settings.printSealImage = "";
if (!db.settings.labelFonts) {
  db.settings.labelFonts = {
    title: 22,
    product: 22,
    origin: 18,
    weight: 28,
    supplier: 10.5,
    date: 23
  };
}
if (db.settings.labelPreset === undefined) db.settings.labelPreset = "60x60";
if (db.settings.labelWidth === undefined) db.settings.labelWidth = 60;
if (db.settings.labelHeight === undefined) db.settings.labelHeight = 60;

// --- 매출/매입 데이터를 동기화용 인보이스 스펙으로 양방향 변환 ---
function prepareInvoicesForSync() {
  db.invoices = [];
  db.invoiceItems = [];
  
  if (Array.isArray(db.sales)) {
    db.sales.forEach(sale => {
      db.invoices.push({
        id: sale.id,
        type: '매출',
        partner_name: sale.partner,
        date: sale.date,
        total_amount: sale.totalSupplyValue || sale.amount || 0,
        total_tax: sale.totalTax || sale.tax || 0,
        total_sum: sale.totalAmount || sale.total || 0,
        status: sale.status || STATUS_CREDIT
      });
      
      if (Array.isArray(sale.items)) {
        sale.items.forEach(item => {
          const itemId = "ITM-" + Date.now() + Math.random().toString(36).substring(2, 5);
          db.invoiceItems.push({
            id: itemId,
            invoice_id: sale.id,
            name: item.name || item.productName || "",
            unit: item.unit || item.spec || "EA",
            origin: item.origin || "국산",
            qty: item.qty || 0,
            price: item.price || 0,
            amount: item.supplyValue || item.amount || 0,
            tax: item.tax || 0,
            total: item.totalAmount || item.total || 0,
            is_tax_applied: item.taxType === TAX_TYPE_TAXABLE ? 1 : 0
          });
        });
      }
    });
  }
  
  if (Array.isArray(db.purchases)) {
    db.purchases.forEach(pur => {
      db.invoices.push({
        id: pur.id,
        type: '매입',
        partner_name: pur.partner,
        date: pur.date,
        total_amount: pur.totalSupplyValue || pur.amount || 0,
        total_tax: pur.totalTax || pur.tax || 0,
        total_sum: pur.totalAmount || pur.total || 0,
        status: pur.status || STATUS_CREDIT
      });
      
      if (Array.isArray(pur.items)) {
        pur.items.forEach(item => {
          const itemId = "ITM-" + Date.now() + Math.random().toString(36).substring(2, 5);
          db.invoiceItems.push({
            id: itemId,
            invoice_id: pur.id,
            name: item.name || item.productName || "",
            unit: item.unit || item.spec || "EA",
            origin: item.origin || "국산",
            qty: item.qty || 0,
            price: item.price || 0,
            amount: item.supplyValue || item.amount || 0,
            tax: item.tax || 0,
            total: item.totalAmount || item.total || 0,
            is_tax_applied: item.taxType === TAX_TYPE_TAXABLE ? 1 : 0
          });
        });
      }
    });
  }
}

function restoreSalesAndPurchasesFromInvoices() {
  db.sales = [];
  db.purchases = [];
  
  if (!Array.isArray(db.invoices)) return;
  
  db.invoices.forEach(inv => {
    const items = (db.invoiceItems || [])
      .filter(item => item.invoice_id === inv.id)
      .map(item => {
        return {
          name: item.name,
          unit: item.unit,
          origin: item.origin,
          qty: Number(item.qty),
          price: Number(item.price),
          amount: Number(item.amount),
          tax: Number(item.tax),
          total: Number(item.total),
          incomingDate: inv.date,
          productId: "",
          productName: item.name,
          spec: item.unit,
          taxType: item.is_tax_applied ? TAX_TYPE_TAXABLE : TAX_TYPE_EXEMPT,
          supplyValue: Number(item.amount),
          totalAmount: Number(item.total)
        };
      });
      
    const doc = {
      id: inv.id,
      date: inv.date,
      partner: inv.partner_name,
      items: items,
      amount: Number(inv.total_amount),
      tax: Number(inv.total_tax),
      total: Number(inv.total_sum),
      status: inv.status || STATUS_CREDIT,
      partnerId: "",
      totalSupplyValue: Number(inv.total_amount),
      totalTax: Number(inv.total_tax),
      totalAmount: Number(inv.total_sum),
      printOptionLabel: "off",
      note: inv.type === '매출' ? "매출 전표" : "매입 전표"
    };
    
    if (Array.isArray(db.partners)) {
      const matchPtn = db.partners.find(p => p.name === inv.partner_name);
      if (matchPtn) {
        doc.partnerId = matchPtn.id;
      }
    }
    
    if (inv.type === '매출') {
      db.sales.push(doc);
    } else {
      db.purchases.push(doc);
    }
  });
}

let isSyncing = false;

function saveDb() {
  if (db.settings) {
    db.settings.uploadedFilesJson = JSON.stringify(db.uploadedSchoolFiles || []);
    db.settings.lastUpdated = Date.now();
  }
  prepareInvoicesForSync();
  localStorage.setItem("erp_db_pro", JSON.stringify(db));
  updateDashboard();
  renderReceivablesAndPayables();
  renderEstimatesList();
  
  if (localStorage.getItem("erp_jwt_token") && !isSyncing) {
    syncToCloud();
  }
}

async function syncToCloud() {
  const token = localStorage.getItem("erp_jwt_token");
  if (!token) return;
  
  isSyncing = true;
  try {
    const response = await fetch("/api/erp/backup/import", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        version: "smart-erp-pro-v1",
        headquarters: db.headquarters,
        partners: db.partners,
        products: db.products,
        invoices: db.invoices,
        invoiceItems: db.invoiceItems,
        employees: db.employees,
        banks: db.banks,
        settings: db.settings,
        receivablesPayments: db.receivablesPayments,
        estimates: db.estimates
      })
    });
    
    if (!response.ok) {
      console.warn("클라우드 동기화 실패:", await response.text());
    } else {
      console.log("클라우드 동기화 성공");
    }
  } catch (err) {
    console.error("클라우드 동기화 네트워크 오류:", err);
  } finally {
    isSyncing = false;
  }
}

async function syncFromCloud() {
  const token = localStorage.getItem("erp_jwt_token");
  if (!token) return;
  
  isSyncing = true;
  try {
    const response = await fetch("/api/erp/backup/export", {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log("클라우드 데이터 가져옴:", data);
      
      db.headquarters = data.headquarters || db.headquarters || [];
      db.partners = data.partners || db.partners || [];
      db.products = data.products || db.products || [];
      db.invoices = data.invoices || db.invoices || [];
      db.invoiceItems = data.invoiceItems || db.invoiceItems || [];
      db.employees = data.employees || db.employees || [];
      db.banks = data.banks || db.banks || [];
      db.settings = data.settings || db.settings;
      db.receivablesPayments = data.receivablesPayments || db.receivablesPayments || {};
      db.estimates = data.estimates || db.estimates || [];
      
      // uploadedSchoolFiles 복원 처리
      if (db.settings && db.settings.uploaded_files_json) {
        try {
          db.uploadedSchoolFiles = JSON.parse(db.settings.uploaded_files_json);
        } catch (e) {
          db.uploadedSchoolFiles = [];
        }
      } else if (db.settings && db.settings.uploadedFilesJson) {
        try {
          db.uploadedSchoolFiles = JSON.parse(db.settings.uploadedFilesJson);
        } catch (e) {
          db.uploadedSchoolFiles = [];
        }
      } else {
        db.uploadedSchoolFiles = [];
      }
      window.uploadedSchoolFiles = db.uploadedSchoolFiles;
      
      restoreSalesAndPurchasesFromInvoices();
      
      localStorage.setItem("erp_db_pro", JSON.stringify(db));
      
      updateDashboard();
      renderReceivablesAndPayables();
      renderEstimatesList();
      renderHeadquarters();
      renderEmployees();
      renderBanks();
      renderPartners();
      renderProducts();
      renderSelectOptions();
      renderPurchaseList();
      renderSalesList();
      
      // 취합 리스트 렌더링 호출
      processUploadedSchoolFiles();
    } else {
      console.warn("클라우드 데이터 로드 실패:", await response.text());
    }
  } catch (err) {
    console.error("클라우드 데이터 로드 네트워크 오류:", err);
  } finally {
    isSyncing = false;
  }
}

async function smartSync() {
  const token = localStorage.getItem("erp_jwt_token");
  if (!token || isSyncing) return;
  
  isSyncing = true;
  try {
    const response = await fetch("/api/erp/backup/export", {
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (!response.ok) {
      isSyncing = false;
      return;
    }
    
    const serverData = await response.json();
    const serverLastUpdated = (serverData.settings && serverData.settings.last_updated) 
      ? Number(serverData.settings.last_updated) 
      : 0;
    const localLastUpdated = (db.settings && db.settings.lastUpdated) 
      ? Number(db.settings.lastUpdated) 
      : 0;
    
    if (serverLastUpdated > localLastUpdated) {
      console.log("클라우드 서버가 더 최신입니다. 서버에서 데이터를 가져옵니다. (Server: " + serverLastUpdated + ", Local: " + localLastUpdated + ")");
      isSyncing = false;
      await syncFromCloud();
    } else if (localLastUpdated > serverLastUpdated) {
      console.log("로컬 데이터가 더 최신입니다. 서버로 백업을 전송합니다. (Local: " + localLastUpdated + ", Server: " + serverLastUpdated + ")");
      isSyncing = false;
      await syncToCloud();
    } else {
      console.log("로컬과 클라우드 데이터가 완벽히 일치합니다. (Timestamp: " + localLastUpdated + ")");
      isSyncing = false;
    }
  } catch (e) {
    console.error("스마트 동기화 처리 중 네트워크 에러:", e);
    isSyncing = false;
  }
}


// --- 2. 탭 전환 및 서브탭 통제 ---
const menuItems = document.querySelectorAll(".menu-item[data-tab]");
const tabContents = document.querySelectorAll(".tab-content");
const currentTabTitle = document.getElementById("current-tab-title");
const currentTabDesc = document.getElementById("current-tab-desc");

const tabMeta = {
  dashboard: { title: "통합 대시보드", desc: "회사 핵심 정보 요약 및 활성 본사 설정을 조회합니다." },
  "company-base": { title: "회사/부서/은행 관리", desc: "사업자 정보, 부서 사원 일람, 금융 계좌 잔액 등을 기록 관리합니다." },
  partners: { title: "거래처 정보 관리", desc: "공급망 및 매출처 연락 정보, 사업자등록 정보를 취합합니다." },
  products: { title: "물품(재고) 정보", desc: "취급 품목의 단가, 과세유형, 원산지 규격 및 재고량을 통제합니다." },
  purchase: { title: "매입 거래 관리", desc: "스캔 문서 OCR 인식 파싱 기능 및 다중 품목 매입 전표를 등록합니다." },
  sales: { title: "매출 거래 관리", desc: "매출 건의 다중 출고 품목 전표 작성 및 바코드 물류 라벨지 출력을 연동합니다." },
  receivables: { title: "외상대금/미수금 관리", desc: "거래처별 누적 잔액 파악 및 미수금 수납/지급 원장을 작성합니다." },
  estimates: { title: "견적서 관리", desc: "견적서 작성, 출력 및 이력 관리 기능을 수행합니다." },
  "order-sheet": { title: "통합 발주표 관리", desc: "통합 발주 엑셀 파일을 업로드하고, 일자별 피벗 현황 조회 및 매출 전표 일괄 자동 등록을 처리합니다." },
  settings: { title: "설정 및 데이터 관리", desc: "시스템 환경설정, 출력지 여백 마진 조정, 데이터 백업/복구를 관리합니다." }
};

menuItems.forEach(item => {
  item.addEventListener("click", () => {
    const tabId = item.getAttribute("data-tab");
    menuItems.forEach(i => i.classList.remove("active"));
    tabContents.forEach(tc => tc.classList.remove("active"));
    
    item.classList.add("active");
    const activeTab = document.getElementById(`tab-${tabId}`);
    if (activeTab) activeTab.classList.add("active");
    
    if (tabMeta[tabId]) {
      currentTabTitle.textContent = tabMeta[tabId].title;
      currentTabDesc.textContent = tabMeta[tabId].desc;
    }
    
    // 데이터 새로고침 연계
    if (tabId === 'purchase' || tabId === 'sales') {
      renderSelectOptions();
    }
    if (tabId === 'estimates') {
      prefillEstimateSupplier();
      renderEstimatesList();
    }
    if (tabId === 'order-sheet') {
      renderOrderSheetData();
    }
  });
});

// 서브탭 제어 (회사/부서/은행 내 이너탭)
const innerTabs = document.querySelectorAll(".inner-tab[data-subtab]");
const innerTabContents = document.querySelectorAll(".inner-tab-content");
innerTabs.forEach(it => {
  it.addEventListener("click", () => {
    const subtabId = it.getAttribute("data-subtab");
    innerTabs.forEach(t => t.classList.remove("active"));
    innerTabContents.forEach(tc => tc.classList.remove("active"));
    
    it.classList.add("active");
    document.getElementById(subtabId).classList.add("active");
  });
});

// --- 3. 포맷터 및 대시보드 리액션 ---
function renderCartCommon(cartArray, tbodyId, config) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  tbody.innerHTML = "";
  let totalAmount = 0;
  let totalTax = 0;

  cartArray.forEach((item, idx) => {
    totalAmount += item.amount;
    totalTax += item.tax;
    const incomingVal = item.incomingDate || "";
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><input type="text" value="${escapeHtml(item.name)}" style="width:160px; ${INLINE_INPUT_STYLE} text-align:left;"
        oninput="${config.cartName}[${idx}].name = this.value"></td>
      <td><input type="text" value="${escapeHtml(item.unit || '')}" style="width:70px; ${INLINE_INPUT_STYLE} text-align:center;"
        oninput="${config.cartName}[${idx}].unit = this.value"></td>
      <td><input type="text" value="${escapeHtml(item.origin || '')}" style="width:85px; ${INLINE_INPUT_STYLE} text-align:center;"
        oninput="${config.cartName}[${idx}].origin = this.value"></td>
      <td><input type="date" value="${incomingVal}" style="width:130px; ${INLINE_INPUT_STYLE}"
        oninput="${config.cartName}[${idx}].incomingDate = this.value"></td>
      <td><input type="number" value="${item.qty}" min="0" step="any" style="width:60px; ${INLINE_INPUT_STYLE} text-align:center;"
        oninput="${config.updateFnName}(${idx}, 'qty', this.value)"></td>
      <td><input type="number" value="${item.price}" min="0" style="width:90px; ${INLINE_INPUT_STYLE} text-align:right;"
        oninput="${config.updateFnName}(${idx}, 'price', this.value)"></td>
      <td><input type="number" id="${config.amountIdPrefix}-${idx}" value="${item.amount}" min="0" style="width:90px; ${INLINE_INPUT_STYLE} text-align:right;"
        oninput="${config.updateFnName}(${idx}, 'amount', this.value)"></td>
      <td style="white-space: nowrap;">
        <div style="display: inline-flex; align-items: center; gap: 4px;">
          <input type="checkbox" id="${config.taxIdPrefix}-check-${idx}" ${item.isTaxApplied ? "checked" : ""} 
            onchange="window.toggleCartItemTax('${config.cartName}', ${idx}, '${config.updateFnName}')"
            style="cursor: pointer; width: 14px; height: 14px; accent-color: #a8e6cf;"
            ${(() => {
              const isExempt = item.taxType === TAX_TYPE_EXEMPT;
              return isExempt ? "disabled title='면세 품목'" : "";
            })()}>
          <input type="number" id="${config.taxIdPrefix}-${idx}" value="${item.tax}" min="0" style="width:70px; ${INLINE_INPUT_STYLE} text-align:right;"
            oninput="${config.updateFnName}(${idx}, 'tax', this.value)">
        </div>
      </td>
      <td><button type="button" class="btn btn-danger" style="padding:2px 6px;" onclick="${config.removeFnName}(${idx})">삭제</button></td>
    `;
    tbody.appendChild(row);
  });

  const amtEl = document.getElementById(config.totalAmountId);
  const taxEl = document.getElementById(config.totalTaxId);
  const sumEl = document.getElementById(config.totalSumId);
  if (amtEl) amtEl.value = totalAmount;
  if (taxEl) taxEl.value = totalTax;
  if (sumEl) sumEl.value = totalAmount + totalTax;
}

function formatNumber(num) {
  return new Intl.NumberFormat('ko-KR').format(num || 0);
}

function updateDashboard() {
  // 당월 매출 합산
  const salesSum = db.sales.reduce((acc, curr) => acc + curr.total, 0);
  // 당월 매입 합산
  const purchaseSum = db.purchases.reduce((acc, curr) => acc + curr.total, 0);
  // 사원 수
  document.getElementById("dash-sales-total").textContent = `${formatNumber(salesSum)} 원`;
  document.getElementById("dash-purchase-total").textContent = `${formatNumber(purchaseSum)} 원`;
  document.getElementById("dash-employee-count").textContent = `${db.employees.length} 명`;

  // 미수외상매출금 누적 잔액 연동
  let totalReceivable = 0;
  db.partners.forEach(partner => {
    if (partner.type === "매출처" || partner.type === "혼합") {
      const totalSales = db.sales.filter(s => s.partner === partner.name && s.status === STATUS_CREDIT).reduce((a, c) => a + c.total, 0);
      const recovered = db.receivablesPayments[partner.name]?.recovered || 0;
      totalReceivable += (totalSales - recovered);
    }
  });
  document.getElementById("dash-receivable-total").textContent = `${formatNumber(totalReceivable)} 원`;

  // 활성 본사선택 셀렉트박스 새로고침
  const activeHqSelector = document.getElementById("active-hq-selector");
  if (activeHqSelector) {
    activeHqSelector.innerHTML = db.headquarters.map(hq => 
      `<option value="${hq.id}" ${db.activeHqId === hq.id ? "selected" : ""}>${hq.name}</option>`
    ).join("");
  }

  // 최근 전표 내역 렌더링
  const dashRecentList = document.getElementById("dash-recent-transactions");
  if (dashRecentList) {
    dashRecentList.innerHTML = "";
    const allTx = [
      ...db.purchases.map(p => ({ ...p, type: '매입', style: 'color: var(--danger-color);' })),
      ...db.sales.map(s => ({ ...s, type: '매출', style: 'color: var(--success-color);' }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8);

    if (allTx.length === 0) {
      dashRecentList.innerHTML = `<tr><td colspan="9" style="text-align:center; color: var(--text-muted);">등록된 매입/매출 전표가 없습니다.</td></tr>`;
    } else {
      allTx.forEach(tx => {
        const itemSummary = tx.items.map(i => `${i.name}(${i.qty})`).join(", ");
        const row = document.createElement("tr");
        row.innerHTML = `
          <td><code>${tx.id}</code></td>
          <td><span style="${tx.style}"><strong>${tx.type}</strong></span></td>
          <td>${tx.date}</td>
          <td>${tx.partner}</td>
          <td>${itemSummary}</td>
          <td>${formatNumber(tx.amount)} 원</td>
          <td>${formatNumber(tx.tax)} 원</td>
          <td><strong>${formatNumber(tx.total)} 원</strong></td>
          <td><span class="hotkey-badge">${tx.status}</span></td>
        `;
        dashRecentList.appendChild(row);
      });
    }
  }
}

// 활성 본사 변경 액션
const activeHqSelector = document.getElementById("active-hq-selector");
if (activeHqSelector) {
  activeHqSelector.addEventListener("change", (e) => {
    db.activeHqId = e.target.value;
    saveDb();
  });
}

// --- 4. 회사/사원/은행 정보 CRUD ---
const formHqAdd = document.getElementById("form-hq-add");
function renderHqList() {
  const tbody = document.getElementById("hq-list-rows");
  if (!tbody) return;
  tbody.innerHTML = "";
  db.headquarters.forEach((hq, idx) => {
    const row = document.createElement("tr");
    const stampHtml = hq.stamp 
      ? `<div style="display:flex; align-items:center; gap:8px;">
           <img src="${hq.stamp}" style="width:24px; height:24px; border-radius:50%; border:1px solid rgba(255,255,255,0.15); object-fit:contain; background:#fff;">
           <input type="file" id="change-stamp-${idx}" accept="image/*" style="display:none;" onchange="updateHqStamp(${idx}, this)">
           <button class="btn btn-primary" style="padding: 2px 6px; font-size: 0.65rem;" onclick="document.getElementById('change-stamp-${idx}').click()">변경</button>
         </div>`
      : `<div style="display:flex; align-items:center; gap:8px;">
           <span style="color:var(--text-muted); font-size:0.75rem;">미등록</span>
           <input type="file" id="change-stamp-${idx}" accept="image/*" style="display:none;" onchange="updateHqStamp(${idx}, this)">
           <button class="btn btn-primary" style="padding: 2px 6px; font-size: 0.65rem;" onclick="document.getElementById('change-stamp-${idx}').click()">등록</button>
         </div>`;
    row.innerHTML = `
      <td><strong>${escapeHtml(hq.name)}</strong></td>
      <td>${escapeHtml(hq.regNo)}</td>
      <td>${escapeHtml(hq.owner)}</td>
      <td>${escapeHtml(hq.address)}</td>
      <td>${stampHtml}</td>
      <td>
        <button class="btn btn-danger" style="padding: 4px 8px; font-size: 0.75rem;" onclick="deleteHq(${idx})">삭제</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

window.updateHqStamp = function(idx, input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = function(e) {
      db.headquarters[idx].stamp = e.target.result;
      saveDb();
      renderHqList();
    };
    reader.readAsDataURL(input.files[0]);
  }
};

if (formHqAdd) {
  formHqAdd.addEventListener("submit", (e) => {
    e.preventDefault();
    const stampInput = document.getElementById("add-hq-stamp");
    
    const newHq = {
      id: "hq" + Date.now(),
      name: document.getElementById("add-hq-name").value,
      regNo: document.getElementById("add-hq-reg-no").value,
      owner: document.getElementById("add-hq-owner").value,
      address: document.getElementById("add-hq-address").value,
      business: document.getElementById("add-hq-business").value,
      stamp: ""
    };

    if (stampInput && stampInput.files && stampInput.files[0]) {
      const reader = new FileReader();
      reader.onload = function(evt) {
        newHq.stamp = evt.target.result;
        db.headquarters.push(newHq);
        saveDb();
        renderHqList();
        formHqAdd.reset();
      };
      reader.readAsDataURL(stampInput.files[0]);
    } else {
      db.headquarters.push(newHq);
      saveDb();
      renderHqList();
      formHqAdd.reset();
    }
  });
}

window.deleteHq = function(idx) {
  if (db.headquarters.length <= 1) {
    alert("최소 1개 이상의 본사 정보가 등록되어 있어야 합니다.");
    return;
  }
  if (confirm("해당 사업소 정보를 삭제하시겠습니까?")) {
    db.headquarters.splice(idx, 1);
    db.activeHqId = db.headquarters[0].id;
    saveDb();
    renderHqList();
  }
};

// 사원 CRUD (사원정보입력.png 관련)
const formEmpAdd = document.getElementById("form-employee-add");
function renderEmployeeList() {
  const tbody = document.getElementById("employee-list-rows");
  if(!tbody) return;
  tbody.innerHTML = "";
  db.employees.forEach((emp, idx) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><code>${escapeHtml(emp.code)}</code></td>
      <td><strong>${escapeHtml(emp.name)}</strong></td>
      <td>${escapeHtml(emp.dept)}</td>
      <td>${escapeHtml(emp.position)}</td>
      <td>${escapeHtml(emp.phone)}</td>
      <td>
        <button class="btn btn-danger" style="padding: 4px 8px; font-size: 0.75rem;" onclick="deleteEmployee(${idx})">삭제</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

if(formEmpAdd) {
  formEmpAdd.addEventListener("submit", (e) => {
    e.preventDefault();
    const newEmp = {
      code: document.getElementById("emp-code").value,
      name: document.getElementById("emp-name").value,
      dept: document.getElementById("emp-dept").value,
      position: document.getElementById("emp-position").value,
      phone: document.getElementById("emp-phone").value
    };
    db.employees.push(newEmp);
    saveDb();
    renderEmployeeList();
    formEmpAdd.reset();
  });
}

window.deleteEmployee = function(idx) {
  if(confirm("해당 사원 정보를 영구 삭제하시겠습니까?")) {
    db.employees.splice(idx, 1);
    saveDb();
    renderEmployeeList();
  }
};

// 은행 관리 (은행정보.png 관련)
const formBankAdd = document.getElementById("form-bank-add");
function renderBankList() {
  const tbody = document.getElementById("bank-list-rows");
  if(!tbody) return;
  tbody.innerHTML = "";
  db.banks.forEach((bank, idx) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><strong>${escapeHtml(bank.name)}</strong></td>
      <td>${escapeHtml(bank.accNo)}</td>
      <td>${escapeHtml(bank.owner)}</td>
      <td><strong>${formatNumber(bank.balance)} 원</strong></td>
      <td>
        <button class="btn btn-danger" style="padding: 4px 8px; font-size: 0.75rem;" onclick="deleteBank(${idx})">삭제</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

if(formBankAdd) {
  formBankAdd.addEventListener("submit", (e) => {
    e.preventDefault();
    const newBank = {
      name: document.getElementById("bank-name").value,
      accNo: document.getElementById("bank-acc-no").value,
      owner: document.getElementById("bank-owner").value,
      balance: parseInt(document.getElementById("bank-balance").value) || 0
    };
    db.banks.push(newBank);
    saveDb();
    renderBankList();
    formBankAdd.reset();
  });
}

window.deleteBank = function(idx) {
  if(confirm("해당 은행 계좌 정보를 삭제하시겠습니까?")) {
    db.banks.splice(idx, 1);
    saveDb();
    renderBankList();
  }
};

// --- 5. 거래처 정보 CRUD 및 실시간 검색 기능 ---
const formPartner = document.getElementById("form-partner");
let editingPartnerIndex = null;

function renderPartners() {
  const tbody = document.getElementById("partner-list-rows");
  if(!tbody) return;
  tbody.innerHTML = "";
  
  const searchInputEl = document.getElementById("partner-search-input");
  const searchFilterEl = document.getElementById("partner-search-filter");
  
  const query = searchInputEl ? searchInputEl.value.toLowerCase().trim() : "";
  const filterType = searchFilterEl ? searchFilterEl.value : "all";
  
  db.partners.forEach((p, idx) => {
    // 검색 매칭 필터링
    if (query !== "") {
      let isMatch = false;
      const valName = (p.name || "").toLowerCase();
      const valType = (p.type || "").toLowerCase();
      const valOwner = (p.owner || "").toLowerCase();
      const valBizNo = (p.bizNo || "").toLowerCase().replace(/-/g, '');
      const valPhone = (p.phone || "").toLowerCase().replace(/[^0-9a-zA-Z]/g, '');
      const valAddress = (p.address || "").toLowerCase();
      
      const queryClean = query.replace(/[^0-9a-zA-Z가-힣]/g, '');
      
      if (filterType === "all") {
        isMatch = valName.includes(query) ||
                  valType.includes(query) ||
                  valOwner.includes(query) ||
                  valBizNo.includes(query) ||
                  (p.phone && p.phone.toLowerCase().includes(query)) ||
                  valAddress.includes(query);
      } else if (filterType === "name") {
        isMatch = valName.includes(query);
      } else if (filterType === "type") {
        isMatch = valType.includes(query);
      } else if (filterType === "owner") {
        isMatch = valOwner.includes(query);
      } else if (filterType === "bizNo") {
        isMatch = valBizNo.includes(query.replace(/-/g, ''));
      } else if (filterType === "phone") {
        isMatch = valPhone.includes(queryClean) || (p.phone && p.phone.toLowerCase().includes(query));
      } else if (filterType === "address") {
        isMatch = valAddress.includes(query);
      }
      
      if (!isMatch) return;
    }
    
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><code>${escapeHtml(p.code)}</code></td>
      <td><strong>${escapeHtml(p.name)}</strong></td>
      <td><span class="hotkey-badge">${escapeHtml(p.type)}</span></td>
      <td>${escapeHtml(p.owner)}</td>
      <td>${escapeHtml(p.bizNo)}</td>
      <td>${escapeHtml(p.phone)}</td>
      <td>${escapeHtml(p.address)}</td>
      <td>
        <button class="btn btn-primary" style="padding: 4px 8px; font-size: 0.75rem;" onclick="editPartner(${idx})">수정</button>
        <button class="btn btn-danger" style="padding: 4px 8px; font-size: 0.75rem;" onclick="deletePartner(${idx})">삭제</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

// 거래처 검색 바 실시간 리스너 바인딩
setTimeout(() => {
  const pSearchInput = document.getElementById("partner-search-input");
  const pSearchFilter = document.getElementById("partner-search-filter");
  if (pSearchInput) {
    pSearchInput.addEventListener("input", renderPartners);
  }
  if (pSearchFilter) {
    pSearchFilter.addEventListener("change", renderPartners);
  }
}, 100);

if(formPartner) {
  formPartner.addEventListener("submit", (e) => {
    e.preventDefault();
    const updatedPartner = {
      code: document.getElementById("partner-code").value,
      name: document.getElementById("partner-name").value,
      owner: document.getElementById("partner-owner").value,
      bizNo: document.getElementById("partner-biz-no").value,
      address: document.getElementById("partner-address").value,
      phone: document.getElementById("partner-phone").value,
      type: document.getElementById("partner-type").value
    };

    if (editingPartnerIndex !== null) {
      db.partners[editingPartnerIndex] = updatedPartner;
      editingPartnerIndex = null;
      const submitBtn = document.getElementById("btn-partner-submit");
      if (submitBtn) submitBtn.innerHTML = '<i data-lucide="plus"></i> 거래처 정보 등록';
      const cancelBtn = document.getElementById("btn-cancel-partner-edit");
      if (cancelBtn) cancelBtn.style.display = "none";
      if (window.lucide) window.lucide.createIcons();
    } else {
      db.partners.push(updatedPartner);
    }

    saveDb();
    renderPartners();
    renderSelectOptions();
    formPartner.reset();
  });
}

if(partnerSearchInput) {
  partnerSearchInput.addEventListener("input", renderPartners);
}

window.editPartner = function(idx) {
  const p = db.partners[idx];
  if (!p) return;

  editingPartnerIndex = idx;
  document.getElementById("partner-code").value = p.code || "";
  document.getElementById("partner-name").value = p.name || "";
  document.getElementById("partner-owner").value = p.owner || "";
  document.getElementById("partner-biz-no").value = p.bizNo || "";
  document.getElementById("partner-address").value = p.address || "";
  document.getElementById("partner-phone").value = p.phone || "";
  document.getElementById("partner-type").value = p.type || "혼합";

  const submitBtn = document.getElementById("btn-partner-submit");
  if (submitBtn) submitBtn.innerHTML = '<i data-lucide="check"></i> 거래처 정보 수정 완료';
  const cancelBtn = document.getElementById("btn-cancel-partner-edit");
  if (cancelBtn) cancelBtn.style.display = "inline-block";
  if (window.lucide) window.lucide.createIcons();

  formPartner.scrollIntoView({ behavior: 'smooth' });
};

const cancelPartnerEditBtn = document.getElementById("btn-cancel-partner-edit");
if (cancelPartnerEditBtn) {
  cancelPartnerEditBtn.addEventListener("click", () => {
    editingPartnerIndex = null;
    formPartner.reset();
    const submitBtn = document.getElementById("btn-partner-submit");
    if (submitBtn) submitBtn.innerHTML = '<i data-lucide="plus"></i> 거래처 정보 등록';
    cancelPartnerEditBtn.style.display = "none";
    if (window.lucide) window.lucide.createIcons();
  });
}

window.deletePartner = function(idx) {
  if(confirm("해당 거래처를 삭제하시겠습니까?")) {
    db.partners.splice(idx, 1);
    saveDb();
    renderPartners();
    renderSelectOptions();
  }
};

// --- 6. 물품 정보 CRUD ---
const formProduct = document.getElementById("form-product");
let editingProductIndex = null;

function renderProducts() {
  const tbody = document.getElementById("product-list-rows");
  if(!tbody) return;
  tbody.innerHTML = "";
  
  const searchInputEl = document.getElementById("product-search-input");
  const query = searchInputEl ? searchInputEl.value.toLowerCase().trim() : "";

  db.products.forEach((p, idx) => {
    // 품목명 검색 매칭 필터링
    if (query !== "") {
      const matchName = p.name && p.name.toLowerCase().includes(query);
      if (!matchName) return;
    }

    const row = document.createElement("tr");
    row.innerHTML = `
      <td><code>${escapeHtml(p.code)}</code></td>
      <td><strong>${escapeHtml(p.name)}</strong></td>
      <td>${escapeHtml(p.unit)}</td>
      <td><span style="color: var(--accent-color);">${escapeHtml(p.origin)}</span></td>
      <td>${formatNumber(p.purchasePrice)} 원</td>
      <td>${formatNumber(p.salesPrice)} 원</td>
      <td><span class="hotkey-badge">${escapeHtml(p.taxType)}</span></td>
      <td><strong>${p.stock}</strong></td>
      <td>
        <button class="btn btn-primary" style="padding: 4px 8px; font-size: 0.75rem;" onclick="editProduct(${idx})">수정</button>
        <button class="btn btn-danger" style="padding: 4px 8px; font-size: 0.75rem;" onclick="deleteProduct(${idx})">삭제</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

// 물품 검색 바 실시간 리스너 바인딩
setTimeout(() => {
  const prodSearchInput = document.getElementById("product-search-input");
  if (prodSearchInput) {
    prodSearchInput.addEventListener("input", renderProducts);
  }
}, 100);

if(formProduct) {
  formProduct.addEventListener("submit", (e) => {
    e.preventDefault();
    const updatedProduct = {
      code: document.getElementById("prod-code").value,
      name: document.getElementById("prod-name").value,
      unit: document.getElementById("prod-unit").value,
      origin: document.getElementById("prod-origin").value,
      purchasePrice: parseInt(document.getElementById("prod-purchase-price").value) || 0,
      salesPrice: parseInt(document.getElementById("prod-sales-price").value) || 0,
      taxType: document.getElementById("prod-tax-type").value,
      stock: parseInt(document.getElementById("prod-stock").value) || 0
    };

    if (editingProductIndex !== null) {
      db.products[editingProductIndex] = updatedProduct;
      editingProductIndex = null;
      const submitBtn = document.getElementById("btn-product-submit");
      if (submitBtn) submitBtn.innerHTML = '<i data-lucide="plus"></i> 물품 정보 저장';
      const cancelBtn = document.getElementById("btn-cancel-product-edit");
      if (cancelBtn) cancelBtn.style.display = "none";
      if (window.lucide) window.lucide.createIcons();
    } else {
      db.products.push(updatedProduct);
    }

    saveDb();
    renderProducts();
    formProduct.reset();
  });
}

window.editProduct = function(idx) {
  const p = db.products[idx];
  if (!p) return;

  editingProductIndex = idx;
  document.getElementById("prod-code").value = p.code || "";
  document.getElementById("prod-name").value = p.name || "";
  document.getElementById("prod-unit").value = p.unit || "";
  document.getElementById("prod-origin").value = p.origin || "";
  document.getElementById("prod-purchase-price").value = p.purchasePrice || 0;
  document.getElementById("prod-sales-price").value = p.salesPrice || 0;
  document.getElementById("prod-tax-type").value = p.taxType || "과세";
  document.getElementById("prod-stock").value = p.stock || 0;

  const submitBtn = document.getElementById("btn-product-submit");
  if (submitBtn) submitBtn.innerHTML = '<i data-lucide="check"></i> 물품 정보 수정 완료';
  const cancelBtn = document.getElementById("btn-cancel-product-edit");
  if (cancelBtn) cancelBtn.style.display = "inline-block";
  if (window.lucide) window.lucide.createIcons();

  formProduct.scrollIntoView({ behavior: 'smooth' });
};

const cancelProductEditBtn = document.getElementById("btn-cancel-product-edit");
if (cancelProductEditBtn) {
  cancelProductEditBtn.addEventListener("click", () => {
    editingProductIndex = null;
    formProduct.reset();
    const submitBtn = document.getElementById("btn-product-submit");
    if (submitBtn) submitBtn.innerHTML = '<i data-lucide="plus"></i> 물품 정보 저장';
    cancelProductEditBtn.style.display = "none";
    if (window.lucide) window.lucide.createIcons();
  });
}

window.deleteProduct = function(idx) {
  if(confirm("해당 물품을 목록에서 제거합니까?")) {
    db.products.splice(idx, 1);
    saveDb();
    renderProducts();
  }
};

// --- 7. 셀렉트 박스 동적 데이터 탑재 및 검색 필터링 매핑 ---
function renderSelectOptions() {
  const purFilterPartner = document.getElementById("pur-filter-partner");
  const salesFilterPartner = document.getElementById("sales-filter-partner");

  // 조회용 필터 셀렉트 연계
  const filterPartnersHtml = '<option value="">전체 거래처</option>' + db.partners.map(p => `<option value="${p.name}">${p.name}</option>`).join("");
  if(purFilterPartner) purFilterPartner.innerHTML = filterPartnersHtml;
  if(salesFilterPartner) salesFilterPartner.innerHTML = filterPartnersHtml;

  // 검색형 거래처 자동완성 바인딩 및 갱신
  initSearchablePartnerAutocomplete();
}

// 검색형 거래처 자동완성 초기화 및 이벤트 리스너 세팅
function initSearchablePartnerAutocomplete() {
  setupPartnerInput("pur-partner", "pur-partner-dropdown", () => db.partners.filter(p => p.type === '매입처' || p.type === '혼합'));
  setupPartnerInput("sales-partner", "sales-partner-dropdown", () => db.partners.filter(p => p.type === '매출처' || p.type === '혼합'));
}

// 개별 검색 자동완성 인풋 제어 도우미 함수
function setupPartnerInput(inputId, dropdownId, getPartnerListFn) {
  const inputEl = document.getElementById(inputId);
  const dropdownEl = document.getElementById(dropdownId);
  if (!inputEl || !dropdownEl) return;

  if (inputEl.dataset.autocompleteBound === "true") {
    return;
  }
  inputEl.dataset.autocompleteBound = "true";

  function renderDropdown(filterText = "") {
    const query = filterText.toLowerCase().trim();
    const partners = getPartnerListFn();
    const filtered = partners.filter(p => 
      p.name.toLowerCase().includes(query) || 
      (p.bizNo && p.bizNo.replace(/-/g, '').includes(query)) ||
      (p.owner && p.owner.toLowerCase().includes(query))
    );

    dropdownEl.innerHTML = "";

    if (filtered.length === 0) {
      dropdownEl.innerHTML = `<div style="padding: 10px 14px; color: var(--text-muted); font-size: 0.85rem; text-align: center;">검색 결과가 없습니다.</div>`;
      return;
    }

    filtered.forEach(p => {
      const itemEl = document.createElement("div");
      itemEl.style.padding = "10px 14px";
      itemEl.style.cursor = "pointer";
      itemEl.style.fontSize = "0.85rem";
      itemEl.style.transition = "background 0.2s ease";
      itemEl.style.borderBottom = "1px solid rgba(255, 255, 255, 0.03)";
      itemEl.className = "dropdown-item-partner";
      
      itemEl.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <strong style="color: #fff;">${escapeHtml(p.name)}</strong>
          <span style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(p.owner || '')} ${p.bizNo ? '/' + escapeHtml(p.bizNo) : ''}</span>
        </div>
      `;
      
      itemEl.addEventListener("mouseenter", () => {
        itemEl.style.background = "rgba(167, 139, 250, 0.15)";
      });
      itemEl.addEventListener("mouseleave", () => {
        itemEl.style.background = "transparent";
      });

      itemEl.addEventListener("mousedown", (e) => {
        e.preventDefault();
        inputEl.value = p.name;
        dropdownEl.style.display = "none";
        
        inputEl.dispatchEvent(new Event("change"));
        inputEl.dispatchEvent(new Event("input"));
      });

      dropdownEl.appendChild(itemEl);
    });
  }

  inputEl.addEventListener("focus", () => {
    dropdownEl.style.display = "block";
    renderDropdown(inputEl.value);
  });

  inputEl.addEventListener("input", () => {
    dropdownEl.style.display = "block";
    renderDropdown(inputEl.value);
  });

  inputEl.addEventListener("blur", () => {
    setTimeout(() => {
      dropdownEl.style.display = "none";
    }, 200);
  });
}

// --- 8. 대화형 품목 검색 레이어 모달 비즈니스 로직 ---
let currentActiveSearchTarget = ""; // "purchase" or "sales"
let modalSearchSelectedIndex = 0;
let modalFilteredProducts = [];

const searchModal = document.getElementById("product-search-modal");
const searchInput = document.getElementById("modal-search-input");
const modalProductList = document.getElementById("modal-product-list");
const btnCloseModal = document.getElementById("btn-close-modal");

function openSearchModal(target) {
  currentActiveSearchTarget = target;
  modalSearchSelectedIndex = 0;
  searchInput.value = "";
  searchModal.classList.add("active");
  searchInput.focus();
  renderModalProducts();
}

function closeSearchModal() {
  searchModal.classList.remove("active");
}

if(btnCloseModal) btnCloseModal.onclick = closeSearchModal;

function renderModalProducts() {
  modalProductList.innerHTML = "";
  const query = searchInput.value.toLowerCase().trim();
  
  modalFilteredProducts = db.products.filter(p => 
    p.name.toLowerCase().includes(query) || p.origin.toLowerCase().includes(query)
  );

  if(modalFilteredProducts.length === 0) {
    modalProductList.innerHTML = `<li style="padding:12px; color:var(--text-muted); text-align:center;">검색 결과가 없습니다.</li>`;
    return;
  }

  modalFilteredProducts.forEach((p, idx) => {
    const li = document.createElement("li");
    li.className = `modal-search-item ${idx === modalSearchSelectedIndex ? 'selected' : ''}`;
    const priceToShow = currentActiveSearchTarget === "purchase" ? p.purchasePrice : p.salesPrice;
    li.innerHTML = `
      <span><strong>${p.name}</strong> <small style="color:var(--text-muted);">(${p.unit})</small></span>
      <span>${p.origin} | ${formatNumber(priceToShow)}원</span>
    `;
    li.onclick = () => selectModalProduct(p);
    modalProductList.appendChild(li);
  });
}

if(searchInput) {
  searchInput.addEventListener("input", renderModalProducts);
  searchInput.addEventListener("keydown", (e) => {
    if(modalFilteredProducts.length === 0) return;
    
    if (e.key === "ArrowDown") {
      e.preventDefault();
      modalSearchSelectedIndex = (modalSearchSelectedIndex + 1) % modalFilteredProducts.length;
      renderModalProducts();
      scrollModalItemIntoView();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      modalSearchSelectedIndex = (modalSearchSelectedIndex - 1 + modalFilteredProducts.length) % modalFilteredProducts.length;
      renderModalProducts();
      scrollModalItemIntoView();
    } else if (e.key === "Enter") {
      e.preventDefault();
      const selectedProduct = modalFilteredProducts[modalSearchSelectedIndex];
      if (selectedProduct) selectModalProduct(selectedProduct);
    }
  });
}

function scrollModalItemIntoView() {
  const selectedEl = modalProductList.querySelector('.selected');
  if(selectedEl) {
    selectedEl.scrollIntoView({ block: 'nearest' });
  }
}

function selectModalProduct(prod) {
  closeSearchModal();
  if (currentActiveSearchTarget === "purchase") {
    document.getElementById("pur-item-select-btn").value = prod.name;
    document.getElementById("pur-item-select").value = prod.name;
    document.getElementById("pur-item-unit").value = prod.unit;
    document.getElementById("pur-item-origin").value = prod.origin;
    document.getElementById("pur-item-price").value = prod.purchasePrice;
    
    // 수량 칸으로 포커스 이동
    document.getElementById("pur-item-qty").focus();
    document.getElementById("pur-item-qty").select();
  } else if (currentActiveSearchTarget === "sales") {
    document.getElementById("sales-item-select-btn").value = prod.name;
    document.getElementById("sales-item-select").value = prod.name;
    document.getElementById("sales-item-unit").value = prod.unit;
    document.getElementById("sales-item-origin").value = prod.origin;
    document.getElementById("sales-item-price").value = prod.salesPrice;
    
    // 수량 칸으로 포커스 이동
    document.getElementById("sales-item-qty").focus();
    document.getElementById("sales-item-qty").select();
  } else if (currentActiveSearchTarget === "estimates") {
    document.getElementById("est-item-select-btn").value = prod.name;
    document.getElementById("est-item-select").value = prod.name;
    document.getElementById("est-item-unit").value = prod.origin || "그레이";
    document.getElementById("est-item-price").value = prod.salesPrice;
    
    // 수량 칸으로 포커스 이동
    document.getElementById("est-item-qty").focus();
    document.getElementById("est-item-qty").select();
  }
}

// 모달 오픈 트리거 바인딩
const purBtn = document.getElementById("pur-item-select-btn");
if(purBtn) {
  purBtn.onclick = () => openSearchModal("purchase");
  purBtn.onkeydown = (e) => {
    if(e.key === "Enter") {
      e.preventDefault();
      openSearchModal("purchase");
    }
  };
}
const salesBtn = document.getElementById("sales-item-select-btn");
if(salesBtn) {
  salesBtn.onclick = () => openSearchModal("sales");
  salesBtn.onkeydown = (e) => {
    if(e.key === "Enter") {
      e.preventDefault();
      openSearchModal("sales");
    }
  };
}
const estBtn = document.getElementById("est-item-select-btn");
if(estBtn) {
  estBtn.onclick = () => openSearchModal("estimates");
  estBtn.onkeydown = (e) => {
    if(e.key === "Enter") {
      e.preventDefault();
      openSearchModal("estimates");
    }
  };
}

// 엔터 흐름 포커싱 제어
function bindEnterFocusChain(currentId, nextId, actionOnNextEnter) {
  const currentEl = document.getElementById(currentId);
  if(currentEl) {
    currentEl.addEventListener("keydown", (e) => {
      if(e.key === "Enter") {
        e.preventDefault();
        const nextEl = document.getElementById(nextId);
        if(nextEl) {
          nextEl.focus();
          if(nextEl.tagName === 'INPUT') nextEl.select();
        }
        if(actionOnNextEnter) actionOnNextEnter();
      }
    });
  }
}

// 매입 폼 포커싱 체인
bindEnterFocusChain("pur-item-qty", "pur-item-price");
const purPriceEl = document.getElementById("pur-item-price");
if(purPriceEl) {
  purPriceEl.addEventListener("keydown", (e) => {
    if(e.key === "Enter") {
      e.preventDefault();
      // 품목 추가 실행
      document.getElementById("btn-add-pur-item").click();
      // 다시 품목 선택으로 포커싱 리턴
      document.getElementById("pur-item-select-btn").focus();
    }
  });
}

// 매출 폼 포커싱 체인
bindEnterFocusChain("sales-item-qty", "sales-item-price");
const salesPriceEl = document.getElementById("sales-item-price");
if(salesPriceEl) {
  salesPriceEl.addEventListener("keydown", (e) => {
    if(e.key === "Enter") {
      e.preventDefault();
      // 품목 추가 실행
      document.getElementById("btn-add-sales-item").click();
      // 다시 품목 선택으로 포커싱 리턴
      document.getElementById("sales-item-select-btn").focus();
    }
  });
}

// 견적서 폼 포커싱 체인
bindEnterFocusChain("est-item-qty", "est-item-price");
const estPriceEl = document.getElementById("est-item-price");
if(estPriceEl) {
  estPriceEl.addEventListener("keydown", (e) => {
    if(e.key === "Enter") {
      e.preventDefault();
      // 품목 추가 실행
      document.getElementById("btn-add-est-item").click();
      // 다시 품목 선택으로 포커싱 리턴
      document.getElementById("est-item-select-btn").focus();
    }
  });
}

// --- 9. 전표 품목 임시 장바구니 리스트업 및 전표 발행 ---
let isPurTaxApplied = false;
let isSalesTaxApplied = false;

function resetPurTaxState() {
  isPurTaxApplied = false;
  purchaseCart.forEach(item => {
    item.isTaxApplied = false;
    item.tax = 0;
    item.total = item.amount;
  });
}

function resetSalesTaxState() {
  isSalesTaxApplied = false;
  salesCart.forEach(item => {
    item.isTaxApplied = false;
    item.tax = 0;
    item.total = item.amount;
  });
}

window.toggleCartItemTax = function(cartName, idx, updateFnName) {
  const cart = cartName === 'purchaseCart' ? purchaseCart : salesCart;
  if (!cart || !cart[idx]) return;
  const item = cart[idx];
  
  // 면세 여부 검사
  const prodMeta = db.products.find(p => p.name === item.name);
  const isTaxable = !prodMeta || prodMeta.taxType !== TAX_TYPE_EXEMPT;
  
  if (!isTaxable) {
    item.isTaxApplied = false;
    item.tax = 0;
  } else {
    // 체크박스 엘리먼트 값 읽기
    const prefix = cartName === 'purchaseCart' ? 'pur-tax' : 'sal-tax';
    const checkEl = document.getElementById(`${prefix}-check-${idx}`);
    item.isTaxApplied = checkEl ? checkEl.checked : !item.isTaxApplied;
    item.tax = item.isTaxApplied ? Math.floor(item.amount * TAX_RATE) : 0;
  }
  
  item.total = item.amount + item.tax;
  
  // 합계금액 연동 업데이트
  window[updateFnName](idx, 'tax', item.tax);
  
  if (cartName === 'purchaseCart') {
    renderPurCart();
  } else {
    renderSalesCart();
  }
};

let purchaseCart = [];
let salesCart = [];

// 매입 품목 추가
const btnAddPurItem = document.getElementById("btn-add-pur-item");
if (btnAddPurItem) {
  btnAddPurItem.addEventListener("click", () => {
    const itemName = document.getElementById("pur-item-select").value;
    if(!itemName) {
      alert("품목을 먼저 선택해 주십시오.");
      return;
    }
    const qty = parseFloat(document.getElementById("pur-item-qty").value) || 1.0;
    const origin = document.getElementById("pur-item-origin").value;
    const purDateVal = document.getElementById("pur-date")?.value || getKstTodayString();
    const incomingDate = document.getElementById("pur-item-incoming")?.value || purDateVal;
    const price = parseInt(document.getElementById("pur-item-price").value) || 0;
    const unit = document.getElementById("pur-item-unit").value || "BOX";

    const prodMeta = db.products.find(p => p.name === itemName);
    const amount = Math.floor(qty * price);
    const isTaxable = !prodMeta || prodMeta.taxType !== TAX_TYPE_EXEMPT;
    const tax = 0;
    const total = amount;

    purchaseCart.push({ name: itemName, unit, origin, incomingDate, qty, price, amount, tax, total, isTaxApplied: false, taxType: prodMeta ? prodMeta.taxType : TAX_TYPE_TAXABLE });
    renderPurCart();
    
    // 폼 초기화 (입고일은 매입일자와 매칭)
    document.getElementById("pur-item-select-btn").value = "";
    document.getElementById("pur-item-select").value = "";
    document.getElementById("pur-item-unit").value = "";
    document.getElementById("pur-item-origin").value = "";
    if (document.getElementById("pur-item-incoming")) {
      document.getElementById("pur-item-incoming").value = purDateVal;
    }
    document.getElementById("pur-item-qty").value = "1";
    document.getElementById("pur-item-price").value = "0";
  });
}

function renderPurCart() {
  renderCartCommon(purchaseCart, "pur-cart-rows", {
    cartName: "purchaseCart",
    updateFnName: "updatePurCartNumeric",
    removeFnName: "removePurCartItem",
    amountIdPrefix: "pur-amount",
    taxIdPrefix: "pur-tax",
    totalAmountId: "pur-total-amount",
    totalTaxId: "pur-total-tax",
    totalSumId: "pur-total-sum"
  });
}

window.updatePurCartNumeric = function(idx, key, val) {
  const num = key === 'qty' ? (parseFloat(val) || 0) : (parseInt(val, 10) || 0);
  purchaseCart[idx][key] = num;
  if (key === 'qty' || key === 'price') {
    // 수량·단가 변경 시 공급가액·세액 자동 계산
    const amount = Math.floor(purchaseCart[idx].qty * purchaseCart[idx].price);
    const prodMeta = db.products.find(p => p.name === purchaseCart[idx].name);
    const isTaxable = !prodMeta || prodMeta.taxType !== TAX_TYPE_EXEMPT;
    const tax = purchaseCart[idx].isTaxApplied && isTaxable ? Math.floor(amount * TAX_RATE) : 0;
    purchaseCart[idx].amount = amount;
    purchaseCart[idx].tax = tax;
    // 포커스 유실 없이 해당 셀만 직접 업데이트
    const amountEl = document.getElementById(`pur-amount-${idx}`);
    const taxEl = document.getElementById(`pur-tax-${idx}`);
    if (amountEl) amountEl.value = amount;
    if (taxEl) taxEl.value = tax;
  }
  if (key === 'tax') {
    purchaseCart[idx].isTaxApplied = (num > 0);
    const checkEl = document.getElementById(`pur-tax-check-${idx}`);
    if (checkEl) checkEl.checked = (num > 0);
  }
  purchaseCart[idx].total = purchaseCart[idx].amount + purchaseCart[idx].tax;

  const totalAmount = purchaseCart.reduce((sum, curr) => sum + curr.amount, 0);
  const totalTax = purchaseCart.reduce((sum, curr) => sum + curr.tax, 0);
  document.getElementById("pur-total-amount").value = totalAmount;
  document.getElementById("pur-total-tax").value = totalTax;
  document.getElementById("pur-total-sum").value = totalAmount + totalTax;
};

window.removePurCartItem = function(idx) {
  purchaseCart.splice(idx, 1);
  renderPurCart();
};

// 매입 전표 최종 제출
const formPurchaseBill = document.getElementById("form-purchase-bill");
if (formPurchaseBill) {
  formPurchaseBill.addEventListener("submit", (e) => {
    e.preventDefault();
    if(purchaseCart.length === 0) {
      alert("매입할 세부 거래 품목을 최소 1개 이상 추가하십시오.");
      return;
    }

    const isEditing = (editingPurchaseId !== null);
    const newPurchase = {
      id: isEditing ? editingPurchaseId : "PUR-" + Date.now(),
      date: document.getElementById("pur-date").value,
      partner: document.getElementById("pur-partner").value,
      items: [...purchaseCart],
      amount: parseInt(document.getElementById("pur-total-amount").value) || 0,
      tax: parseInt(document.getElementById("pur-total-tax").value) || 0,
      total: parseInt(document.getElementById("pur-total-sum").value) || 0,
      status: document.getElementById("pur-status").value
    };

    // 재고 증가 반영
    newPurchase.items.forEach(item => {
      const prod = db.products.find(p => p.name === item.name);
      if (prod) prod.stock += item.qty;
    });

    if (isEditing) {
      const idx = db.purchases.findIndex(p => p.id === editingPurchaseId);
      if (idx !== -1) {
        db.purchases[idx] = newPurchase;
      }
      editingPurchaseId = null;
      
      // UI 복원
      const submitBtn = document.getElementById("btn-purchase-submit");
      if(submitBtn) submitBtn.innerHTML = '<i data-lucide="file-check"></i> 매입 전표 발행 및 저장';
      const cancelBtn = document.getElementById("btn-purchase-cancel-edit");
      if (cancelBtn) cancelBtn.style.display = "none";
    } else {
      db.purchases.push(newPurchase);
    }

    saveDb();
    alert("매입 전표가 성공적으로 저장되었습니다.");
    purchaseCart = [];
    renderPurCart();
    formPurchaseBill.reset();
    resetPurTaxState();
    
    const todayStr = getKstTodayString();
    document.getElementById("pur-date").value = todayStr;
    if (document.getElementById("pur-item-incoming")) {
      document.getElementById("pur-item-incoming").value = todayStr;
    }
    
    renderPurchaseList();
    renderProducts();
  });
}

// 매입거래 기간별/거래처별 필터링 기능
function renderPurchaseList() {
  const tbody = document.getElementById("purchase-list-rows");
  if(!tbody) return;
  tbody.innerHTML = "";

  const startVal = document.getElementById("pur-filter-start").value;
  const endVal = document.getElementById("pur-filter-end").value;
  const partnerVal = document.getElementById("pur-filter-partner").value;

  db.purchases.forEach((pur, idx) => {
    // 날짜 조건 필터링
    if (startVal && pur.date < startVal) return;
    if (endVal && pur.date > endVal) return;
    // 거래처 조건 필터링
    if (partnerVal && pur.partner !== partnerVal) return;

    const row = document.createElement("tr");
    row.innerHTML = `
      <td><code>${pur.id}</code></td>
      <td>${pur.date}</td>
      <td><strong>${pur.partner}</strong></td>
      <td>${pur.items.length} 건</td>
      <td><strong>${formatNumber(pur.total)} 원</strong></td>
      <td><span class="hotkey-badge">${pur.status}</span></td>
      <td>
        <button class="btn btn-primary" style="padding: 4px 8px; font-size: 0.75rem;" onclick="reprintPurchaseInvoice(${idx})">명세서 출력</button>
        <button class="btn btn-warning" style="padding: 4px 8px; font-size: 0.75rem; background: #e67e22; border-color: #d35400; color: #fff;" onclick="editPurchase(${idx})">수정</button>
        <button class="btn btn-danger" style="padding: 4px 8px; font-size: 0.75rem;" onclick="deletePurchase(${idx})">삭제</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

window.reprintPurchaseInvoice = function(idx) {
  const pur = db.purchases[idx];
  if(pur) triggerPurchaseInvoicePrintDoc(pur);
};

const btnPurFilter = document.getElementById("btn-pur-filter");
if(btnPurFilter) btnPurFilter.onclick = renderPurchaseList;

window.deletePurchase = function(idx) {
  if(confirm("해당 매입 전표를 삭제하시겠습니까? (재고 수준도 재정렬됩니다)")) {
    const pur = db.purchases[idx];
    pur.items.forEach(item => {
      const prod = db.products.find(p => p.name === item.name);
      if (prod) prod.stock = Math.max(0, prod.stock - item.qty);
    });
    db.purchases.splice(idx, 1);
    saveDb();
    renderPurchaseList();
    renderProducts();
  }
};

window.editPurchase = function(idx) {
  const pur = db.purchases[idx];
  if (!pur) return;

  editingPurchaseId = pur.id;
  purchaseCart = JSON.parse(JSON.stringify(pur.items));
  
  // 각 품목별 부가세 여부를 기존 세액 기준으로 복구 및 면세 여부 획득
  purchaseCart.forEach(item => {
    item.isTaxApplied = (item.tax > 0);
    const prodMeta = db.products.find(p => p.name === item.name);
    item.taxType = prodMeta ? prodMeta.taxType : (item.tax > 0 ? TAX_TYPE_TAXABLE : TAX_TYPE_EXEMPT);
  });

  renderPurCart();

  // 매입 취소 시 재고 환원 (재고 감소)
  pur.items.forEach(item => {
    const prod = db.products.find(p => p.name === item.name);
    if (prod) prod.stock = Math.max(0, prod.stock - item.qty);
  });
  saveDb();
  renderProducts();

  document.getElementById("pur-date").value = pur.date;
  document.getElementById("pur-partner").value = pur.partner;
  document.getElementById("pur-status").value = pur.status;
  if (document.getElementById("pur-item-incoming")) {
    document.getElementById("pur-item-incoming").value = pur.date;
  }

  const submitBtn = document.getElementById("btn-purchase-submit");
  if(submitBtn) submitBtn.innerHTML = '<i data-lucide="printer"></i> 저장 및 명세서 출력';
  const cancelBtn = document.getElementById("btn-purchase-cancel-edit");
  if (cancelBtn) cancelBtn.style.display = "inline-block";

  if (window.lucide) window.lucide.createIcons();
  document.getElementById("form-purchase-bill").scrollIntoView({ behavior: 'smooth' });
};

window.cancelEditPurchase = function() {
  if (editingPurchaseId) {
    const pur = db.purchases.find(p => p.id === editingPurchaseId);
    if (pur) {
      pur.items.forEach(item => {
        const prod = db.products.find(p => p.name === item.name);
        if (prod) prod.stock += item.qty;
      });
      saveDb();
      renderProducts();
    }
  }

  editingPurchaseId = null;
  purchaseCart = [];
  resetPurTaxState(); // 부가세 상태 초기화
  renderPurCart();
  document.getElementById("form-purchase-bill").reset();

  const todayStr = getKstTodayString();
  document.getElementById("pur-date").value = todayStr;
  if (document.getElementById("pur-item-incoming")) {
    document.getElementById("pur-item-incoming").value = todayStr;
  }

  const submitBtn = document.getElementById("btn-purchase-submit");
  if(submitBtn) submitBtn.innerHTML = '<i data-lucide="printer"></i> 저장 및 명세서 출력';
  const cancelBtn = document.getElementById("btn-purchase-cancel-edit");
  if (cancelBtn) cancelBtn.style.display = "none";

  if (window.lucide) window.lucide.createIcons();
};

// 매출 품목 장바구니 추가
const btnAddSalesItem = document.getElementById("btn-add-sales-item");
if (btnAddSalesItem) {
  btnAddSalesItem.addEventListener("click", () => {
    const itemName = document.getElementById("sales-item-select").value;
    if(!itemName) {
      alert("매출 품목을 먼저 검색해 주십시오.");
      return;
    }
    const qty = parseFloat(document.getElementById("sales-item-qty").value) || 1.0;
    const origin = document.getElementById("sales-item-origin").value;
    const salesDateVal = document.getElementById("sales-date")?.value || getKstTodayString();
    const incomingDate = document.getElementById("sales-item-incoming")?.value || salesDateVal;
    const price = parseInt(document.getElementById("sales-item-price").value) || 0;
    const unit = document.getElementById("sales-item-unit").value || "BOX";

    const prodMeta = db.products.find(p => p.name === itemName);
    const amount = Math.floor(qty * price);
    const isTaxable = !prodMeta || prodMeta.taxType !== TAX_TYPE_EXEMPT;
    const tax = 0;
    const total = amount;

    salesCart.push({ name: itemName, unit, origin, incomingDate, qty, price, amount, tax, total, isTaxApplied: false, taxType: prodMeta ? prodMeta.taxType : TAX_TYPE_TAXABLE });
    renderSalesCart();
    
    // 폼 초기화 (입고일은 매출일자와 매칭)
    document.getElementById("sales-item-select-btn").value = "";
    document.getElementById("sales-item-select").value = "";
    document.getElementById("sales-item-unit").value = "";
    document.getElementById("sales-item-origin").value = "";
    if (document.getElementById("sales-item-incoming")) {
      document.getElementById("sales-item-incoming").value = salesDateVal;
    }
    document.getElementById("sales-item-qty").value = "1";
    document.getElementById("sales-item-price").value = "0";
  });
}

function renderSalesCart() {
  renderCartCommon(salesCart, "sales-cart-rows", {
    cartName: "salesCart",
    updateFnName: "updateSalesCartNumeric",
    removeFnName: "removeSalesCartItem",
    amountIdPrefix: "sal-amount",
    taxIdPrefix: "sal-tax",
    totalAmountId: "sales-total-amount",
    totalTaxId: "sales-total-tax",
    totalSumId: "sales-total-sum"
  });
}

window.updateSalesCartNumeric = function(idx, key, val) {
  const num = key === 'qty' ? (parseFloat(val) || 0) : (parseInt(val, 10) || 0);
  salesCart[idx][key] = num;
  if (key === 'qty' || key === 'price') {
    // 수량·단가 변경 시 공급가액·세액 자동 계산
    const amount = Math.floor(salesCart[idx].qty * salesCart[idx].price);
    const prodMeta = db.products.find(p => p.name === salesCart[idx].name);
    const isTaxable = !prodMeta || prodMeta.taxType !== TAX_TYPE_EXEMPT;
    const tax = salesCart[idx].isTaxApplied && isTaxable ? Math.floor(amount * TAX_RATE) : 0;
    salesCart[idx].amount = amount;
    salesCart[idx].tax = tax;
    // 포커스 유실 없이 해당 셀만 직접 업데이트
    const amountEl = document.getElementById(`sal-amount-${idx}`);
    const taxEl = document.getElementById(`sal-tax-${idx}`);
    if (amountEl) amountEl.value = amount;
    if (taxEl) taxEl.value = tax;
  }
  if (key === 'tax') {
    salesCart[idx].isTaxApplied = (num > 0);
    const checkEl = document.getElementById(`sal-tax-check-${idx}`);
    if (checkEl) checkEl.checked = (num > 0);
  }
  salesCart[idx].total = salesCart[idx].amount + salesCart[idx].tax;

  const totalAmount = salesCart.reduce((sum, curr) => sum + curr.amount, 0);
  const totalTax = salesCart.reduce((sum, curr) => sum + curr.tax, 0);
  document.getElementById("sales-total-amount").value = totalAmount;
  document.getElementById("sales-total-tax").value = totalTax;
  document.getElementById("sales-total-sum").value = totalAmount + totalTax;
};

window.removeSalesCartItem = function(idx) {
  salesCart.splice(idx, 1);
  renderSalesCart();
};

let editingSalesId = null;
let editingPurchaseId = null;
let editingEstimateId = null;

let shouldPrintSales = true;
let shouldPrintPurchase = true;
let shouldPrintEstimate = true;

// 매출 전표 최종제출 및 라벨지 프린터 대화상자 트리거
const formSalesBill = document.getElementById("form-sales-bill");
if (formSalesBill) {
  formSalesBill.addEventListener("submit", (e) => {
    e.preventDefault();
    if(salesCart.length === 0) {
      alert("출고 매출 전표작성을 위해 물품을 1개 이상 카트에 기입해 주십시오.");
      return;
    }

    const isEditing = (editingSalesId !== null);
    const newSale = {
      id: isEditing ? editingSalesId : "SAL-" + Date.now(),
      date: document.getElementById("sales-date").value,
      partner: document.getElementById("sales-partner").value,
      items: [...salesCart],
      amount: parseInt(document.getElementById("sales-total-amount").value) || 0,
      tax: parseInt(document.getElementById("sales-total-tax").value) || 0,
      total: parseInt(document.getElementById("sales-total-sum").value) || 0,
      status: document.getElementById("sales-status").value
    };

    // 재고 출고량 차감
    newSale.items.forEach(item => {
      const prod = db.products.find(p => p.name === item.name);
      if (prod) prod.stock = Math.max(0, prod.stock - item.qty);
    });

    if (isEditing) {
      const idx = db.sales.findIndex(s => s.id === editingSalesId);
      if (idx !== -1) {
        db.sales[idx] = newSale;
      }
      editingSalesId = null;
      
      // UI 복원
      const submitBtn = document.getElementById("btn-sales-submit");
      if(submitBtn) submitBtn.innerHTML = '<i data-lucide="printer"></i> 저장 및 명세서/라벨 출력';
      const cancelBtn = document.getElementById("btn-sales-cancel-edit");
      if (cancelBtn) cancelBtn.style.display = "none";
    } else {
      db.sales.push(newSale);
    }
    
    saveDb();
    
    const printToggleEl = document.getElementById("sales-label-print-toggle");
    const isLabelOn = printToggleEl ? printToggleEl.value === "on" : false;

    // 명세서 기본 출력 진행
    if (shouldPrintSales) {
      handleSalesPrint(newSale, isLabelOn);
    } else {
      alert("매출 전표가 성공적으로 저장되었습니다.");
    }

    salesCart = [];
    renderSalesCart();
    formSalesBill.reset();
    resetLabelPrintToggle();
    resetSalesTaxState();
    
    const todayStr = getKstTodayString();
    document.getElementById("sales-date").value = todayStr;
    if (document.getElementById("sales-item-incoming")) {
      document.getElementById("sales-item-incoming").value = todayStr;
    }
    
    renderSalesList();
    renderProducts();
  });
}


function getLabelHtml(sale) {
  const activeHq = db.headquarters.find(hq => hq.id === db.activeHqId) || db.headquarters[0];
  let partnerCore = sale.partner.replace(" (매출처)", "").replace(" (매입처)", "").split(" (")[0].trim();
  if (partnerCore.length > 8) partnerCore = partnerCore.substring(0, 8);
  
  let supplierCore = activeHq.name.replace(/\(주\)/g, "").split(" ")[0].trim();
  if (supplierCore.length > 5) supplierCore = supplierCore.substring(0, 5);

  const width = db.settings.labelWidth || 60;
  const height = db.settings.labelHeight || 60;

  let labelHtml = "";
  sale.items.forEach((item, idx) => {
    const isLast = idx === sale.items.length - 1;
    let itemNameCore = item.name.split("(")[0].trim().replace("경북 부사 ", "").replace("칠레산 ", "").replace("냉동 ", "");
    if (itemNameCore.length > 5) itemNameCore = itemNameCore.substring(0, 5);
    
    let itemOrigin = item.origin ? item.origin.split("(")[0].trim() : "국내산";
    if (itemOrigin.length > 3) itemOrigin = itemOrigin.substring(0, 3);

    const dateStr = sale.date.replace(/-/g, ".");

    let weightVal = "1";
    let weightUnit = "EA";
    const nameMatch = item.name.match(/(\d+)\s*(kg|g|t|EA|BOX|L|ml)/i);
    const originMatch = item.origin ? item.origin.match(/(\d+)\s*(kg|g|t|EA|BOX|L|ml)/i) : null;
    if (nameMatch) {
      weightVal = nameMatch[1];
      weightUnit = nameMatch[2].toLowerCase();
    } else if (originMatch) {
      weightVal = originMatch[1];
      weightUnit = originMatch[2].toLowerCase();
    } else if (item.unit) {
      weightVal = item.qty;
      weightUnit = item.unit.toLowerCase();
    }

    labelHtml += `
      <div class="print-label-box" style="width: ${width}mm; height: ${height}mm; page-break-after: ${isLast ? 'avoid' : 'always'}; box-sizing: border-box; border: 3px solid #000; font-family: 'Noto Sans KR', sans-serif; background: #fff; color: #000; display: flex; flex-direction: column; margin-bottom: 10px;">
        <!-- Row 1: 공급처 -->
        <div style="display: flex; height: 25%; border-bottom: 3px solid #000;">
          <div style="width: 15%; border-right: 3px solid #000; display: flex; align-items: center; justify-content: center; font-size: 10pt; font-weight: bold; writing-mode: vertical-rl; text-orientation: upright; letter-spacing: 2px; background: #fafafa;">공급처</div>
          <div style="width: 85%; display: flex; align-items: center; justify-content: center; font-size: ${db.settings.labelFonts.title}pt; font-weight: 900; letter-spacing: 1px;">${escapeHtml(partnerCore)}</div>
        </div>
        <!-- Row 2: 품종 -->
        <div style="display: flex; height: 25%; border-bottom: 3px solid #000;">
          <div style="width: 15%; border-right: 3px solid #000; display: flex; align-items: center; justify-content: center; font-size: 10pt; font-weight: bold; writing-mode: vertical-rl; text-orientation: upright; letter-spacing: 2px; background: #fafafa;">품종</div>
          <div style="width: 48%; border-right: 3px solid #000; display: flex; align-items: center; justify-content: center; font-size: ${db.settings.labelFonts.product}pt; font-weight: 900;">${escapeHtml(itemNameCore)}</div>
          <div style="width: 12%; border-right: 3px solid #000; display: flex; align-items: center; justify-content: center; font-size: 8pt; font-weight: bold; writing-mode: vertical-rl; text-orientation: upright; line-height: 1; background: #fafafa;">산지</div>
          <div style="width: 25%; display: flex; align-items: center; justify-content: center; font-size: ${db.settings.labelFonts.origin}pt; font-weight: 900;">${escapeHtml(itemOrigin)}</div>
        </div>
        <!-- Row 3: 무게 -->
        <div style="display: flex; height: 25%; border-bottom: 3px solid #000;">
          <div style="width: 15%; border-right: 3px solid #000; display: flex; align-items: center; justify-content: center; font-size: 10pt; font-weight: bold; writing-mode: vertical-rl; text-orientation: upright; letter-spacing: 2px; background: #fafafa;">무게</div>
          <div style="width: 48%; border-right: 3px solid #000; display: flex; align-items: center; justify-content: center; font-size: 14pt; font-weight: bold;">
            <span style="font-size: ${db.settings.labelFonts.weight}pt; font-weight: 900; margin-right: 4px; font-family: 'Inter', sans-serif;">${weightVal}</span> ${escapeHtml(weightUnit)}
          </div>
          <div style="width: 12%; border-right: 3px solid #000; display: flex; align-items: center; justify-content: center; font-size: 7.5pt; font-weight: bold; writing-mode: vertical-rl; text-orientation: upright; line-height: 1.1; background: #fafafa;">공급자</div>
          <div style="width: 25%; display: flex; align-items: center; justify-content: center; font-size: ${db.settings.labelFonts.supplier}pt; font-weight: 900; text-align: center; line-height: 1.2;">${escapeHtml(supplierCore)}</div>
        </div>
        <!-- Row 4: 포장일 -->
        <div style="display: flex; height: 25%;">
          <div style="width: 15%; border-right: 3px solid #000; display: flex; align-items: center; justify-content: center; font-size: 9pt; font-weight: bold; writing-mode: vertical-rl; text-orientation: upright; letter-spacing: 1px; background: #fafafa;">포장일</div>
          <div style="width: 85%; display: flex; align-items: center; justify-content: center; font-size: ${db.settings.labelFonts.date}pt; font-weight: 900; font-family: monospace; letter-spacing: 1.5px;">${escapeHtml(dateStr)}</div>
        </div>
      </div>
    `;
  });
  return labelHtml;
}

function triggerLabelPrintDoc(sale) {
  const width = db.settings.labelWidth || 60;
  const height = db.settings.labelHeight || 60;
  injectPrintStyle(`
    @media print {
      @page {
        size: ${width}mm ${height}mm;
        margin: 0;
      }
    }
  `);
  const printArea = document.getElementById("print-document-area");
  printArea.innerHTML = getLabelHtml(sale);
  setTimeout(() => {
    window.print();
    setTimeout(clearPrintStyle, 2000);
  }, 150);
}

function triggerInvoicePrintDoc(sale) {
  const activeHq = db.headquarters.find(hq => hq.id === db.activeHqId) || db.headquarters[0];
  const printSeal = db.settings.printSealImage || activeHq.stamp;
  const partnerMeta = db.partners.find(p => p.name === sale.partner) || { name: sale.partner, bizNo: "109-51-71804", owner: "박시안", address: "서울특별시 송파구 송파대로 167", phone: "02-478-7822" };
  const printArea = document.getElementById("print-document-area");

  // 외상 및 잔액 계산
  const rp = db.receivablesPayments[sale.partner] || { recovered: 0, totalSales: null };
  const finalReceivable = (rp.totalSales !== undefined && rp.totalSales !== null)
    ? (rp.totalSales - rp.recovered)
    : (db.sales.filter(s => s.partner === sale.partner && s.status === STATUS_CREDIT).reduce((sum, curr) => sum + curr.total, 0) - rp.recovered);

  const currentReceived = sale.status === STATUS_PAID ? sale.total : 0;
  const prevReceivable = finalReceivable - (sale.status === STATUS_CREDIT ? sale.total : 0);
  const totalSumAmount = prevReceivable + sale.total;
  const currentTotalReceivable = totalSumAmount - currentReceived;

  const maxInvoiceRows = 13;
  const totalItems = sale.items.length;
  const totalPages = Math.ceil(Math.max(1, totalItems) / maxInvoiceRows);

  let fullHtml = "";

  for (let page = 0; page < totalPages; page++) {
    const startIndex = page * maxInvoiceRows;
    const endIndex = startIndex + maxInvoiceRows;
    const pageItems = sale.items.slice(startIndex, endIndex);

    let itemsHtml = "";
    
    // 1. 실제 품목 추가
    pageItems.forEach((item, i) => {
      const globalIdx = startIndex + i;
      itemsHtml += `
        <tr style="height: 20px; font-size: 7.5pt; color: #000; line-height: 1.2;">
          <td style="border: 1px solid #4E8B62; padding: 1px 1px; text-align: center; white-space: nowrap;">${globalIdx + 1}</td>
          <td style="border: 1px solid #4E8B62; padding: 1px 3px; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px;">${escapeHtml(item.name)}</td>
          <td style="border: 1px solid #4E8B62; padding: 1px 1px; text-align: center; color: #333; white-space: nowrap;">${escapeHtml(item.unit || "EA")}</td>
          <td style="border: 1px solid #4E8B62; padding: 1px 1px; text-align: center; font-weight: bold; white-space: nowrap;">${item.qty}</td>
          <td style="border: 1px solid #4E8B62; padding: 1px 3px; text-align: right; font-family: monospace; white-space: nowrap;">${formatNumber(item.price)}</td>
          <td style="border: 1px solid #4E8B62; padding: 1px 3px; text-align: right; font-family: monospace; white-space: nowrap;">${formatNumber(item.amount)}</td>
          <td style="border: 1px solid #4E8B62; padding: 1px 3px; text-align: right; font-family: monospace; white-space: nowrap;">${formatNumber(item.tax)}</td>
          <td style="border: 1px solid #4E8B62; padding: 1px 1px; text-align: center; color: #888; white-space: nowrap;">-</td>
        </tr>
      `;
    });

    // 2. 이하여백 추가 (마지막 페이지이며, 품목 개수가 13개 미만일 때만)
    let currentRows = pageItems.length;
    const isLastPage = page === totalPages - 1;
    if (isLastPage && currentRows < maxInvoiceRows) {
      const globalIdx = startIndex + currentRows;
      itemsHtml += `
        <tr style="height: 20px; font-size: 7.5pt; color: #888; line-height: 1.2;">
          <td style="border: 1px solid #4E8B62; padding: 1px 1px; text-align: center; white-space: nowrap;">${globalIdx + 1}</td>
          <td style="border: 1px solid #4E8B62; padding: 1px 3px; text-align: left; font-style: italic; white-space: nowrap;">=====이하여백=====</td>
          <td style="border: 1px solid #4E8B62; padding: 1px 1px; text-align: center; white-space: nowrap;">-</td>
          <td style="border: 1px solid #4E8B62; padding: 1px 1px; text-align: center; white-space: nowrap;">-</td>
          <td style="border: 1px solid #4E8B62; padding: 1px 3px; text-align: right; font-family: monospace; white-space: nowrap;">-</td>
          <td style="border: 1px solid #4E8B62; padding: 1px 3px; text-align: right; font-family: monospace; white-space: nowrap;">-</td>
          <td style="border: 1px solid #4E8B62; padding: 1px 3px; text-align: right; font-family: monospace; white-space: nowrap;">-</td>
          <td style="border: 1px solid #4E8B62; padding: 1px 1px; text-align: center; white-space: nowrap;">-</td>
        </tr>
      `;
      currentRows++;
    }

    // 3. 남은 빈 줄 채워서 총 13줄 맞춤
    const emptyRowsCount = Math.max(0, maxInvoiceRows - currentRows);
    for (let i = 0; i < emptyRowsCount; i++) {
      const globalIdx = startIndex + currentRows + i;
      itemsHtml += `
        <tr style="height: 20px; line-height: 1.2;">
          <td style="border: 1px solid #4E8B62; padding: 1px 1px; text-align: center; font-size: 7.5pt; color: #ccc; white-space: nowrap;">${globalIdx + 1}</td>
          <td style="border: 1px solid #4E8B62; padding: 1px 1px;"></td>
          <td style="border: 1px solid #4E8B62; padding: 1px 1px;"></td>
          <td style="border: 1px solid #4E8B62; padding: 1px 1px;"></td>
          <td style="border: 1px solid #4E8B62; padding: 1px 1px;"></td>
          <td style="border: 1px solid #4E8B62; padding: 1px 1px;"></td>
          <td style="border: 1px solid #4E8B62; padding: 1px 1px;"></td>
          <td style="border: 1px solid #4E8B62; padding: 1px 1px;"></td>
        </tr>
      `;
    }

    // 4. 2줄 상세 회계/잔액 합계 요약 행 추가 (전잔금 3:7 비율, 품목 행과 동일하게 높이 20px로 조정)
    itemsHtml += `
      <tr style="height: 20px; font-size: 7.2pt; font-weight: bold; color: #000; line-height: 1.2;">
        <td colspan="4" style="border: 1px solid #4E8B62; padding: 0; box-sizing: border-box; vertical-align: middle;">
          <div style="display: flex; width: 100%; align-items: center;">
            <div style="width: 30%; background-color: #E4EFE7; text-align: center; font-weight: bold; border-right: 1px solid #4E8B62; padding: 2px 0; box-sizing: border-box; white-space: nowrap;">전잔금</div>
            <div style="width: 70%; text-align: right; font-family: monospace; padding: 2px 4px; box-sizing: border-box; white-space: nowrap; font-weight: bold;">${formatNumber(prevReceivable)}</div>
          </div>
        </td>
        <td colspan="1" style="border: 1px solid #4E8B62; background-color: #E4EFE7; text-align: center; white-space: nowrap; padding: 2px 2px; box-sizing: border-box; vertical-align: middle;">합계</td>
        <td colspan="1" style="border: 1px solid #4E8B62; text-align: right; font-family: monospace; padding: 2px 4px; white-space: nowrap; font-weight: bold; box-sizing: border-box; vertical-align: middle;">${formatNumber(sale.amount)}</td>
        <td colspan="1" style="border: 1px solid #4E8B62; text-align: right; font-family: monospace; padding: 2px 4px; white-space: nowrap; font-weight: bold; box-sizing: border-box; vertical-align: middle;">${formatNumber(sale.tax)}</td>
        <td colspan="1" style="border: 1px solid #4E8B62; text-align: center; color: #000; font-weight: bold; white-space: nowrap; padding: 2px 0px; box-sizing: border-box; vertical-align: middle;">${page + 1}/${totalPages}</td>
      </tr>
      <tr style="height: 20px; font-size: 7.2pt; font-weight: bold; color: #000; line-height: 1.2;">
        <td colspan="2" style="border: 1px solid #4E8B62; padding: 0; box-sizing: border-box; vertical-align: middle;">
          <div style="display: flex; width: 100%; align-items: center;">
            <div style="width: 35%; background-color: #E4EFE7; text-align: center; font-weight: bold; border-right: 1px solid #4E8B62; padding: 2px 0; box-sizing: border-box; white-space: nowrap;">총합계</div>
            <div style="width: 65%; text-align: right; font-family: monospace; padding: 2px 4px; box-sizing: border-box; white-space: nowrap; font-weight: bold; color: #111;">${formatNumber(totalSumAmount)}</div>
          </div>
        </td>
        <td colspan="1" style="border: 1px solid #4E8B62; background-color: #E4EFE7; text-align: center; white-space: nowrap; padding: 2px 2px; box-sizing: border-box; vertical-align: middle;">입금</td>
        <td colspan="1" style="border: 1px solid #4E8B62; text-align: right; font-family: monospace; padding: 2px 4px; white-space: nowrap; font-weight: bold; box-sizing: border-box; vertical-align: middle;">${formatNumber(currentReceived)}</td>
        <td colspan="1" style="border: 1px solid #4E8B62; background-color: #E4EFE7; text-align: center; white-space: nowrap; padding: 2px 2px; box-sizing: border-box; vertical-align: middle;">총잔액</td>
        <td colspan="1" style="border: 1px solid #4E8B62; text-align: right; font-family: monospace; padding: 2px 4px; color: #1e5a32; white-space: nowrap; font-weight: bold; box-sizing: border-box; vertical-align: middle;">${formatNumber(currentTotalReceivable)}</td>
        <td colspan="1" style="border: 1px solid #4E8B62; background-color: #E4EFE7; text-align: center; white-space: nowrap; padding: 2px 2px; box-sizing: border-box; vertical-align: middle;">인수자</td>
        <td colspan="1" style="border: 1px solid #4E8B62; text-align: center; color: #666; font-size: 6.5pt; padding: 2px 0px; white-space: nowrap; box-sizing: border-box; vertical-align: middle;">(인)</td>
      </tr>
    `;

    fullHtml += `
      <div class="print-invoice-page" style="width: 194mm; height: 132mm; display: flex; flex-direction: column; justify-content: space-between; page-break-after: ${page === totalPages - 1 ? 'avoid' : 'always'}; margin: 0; padding: 0; font-family: 'Noto Sans KR', sans-serif; background: #fff; color: #000; box-sizing: border-box;">
        <div>
          <!-- 상단 타이틀 영역 (초슬림 여백) -->
          <div style="font-size: 13pt; font-weight: bold; text-align: left; color: #000; letter-spacing: 1px; margin-bottom: 0px; white-space: nowrap;">매출거래명세서</div>
          <div style="border-bottom: 1px solid #4E8B62; padding-bottom: 0px; font-size: 6.5pt; color: #333; margin-bottom: 2px; font-weight: bold; white-space: nowrap;">
            No: ${sale.id} &nbsp;|&nbsp; Date (일자): ${sale.date.replace(/-/g, "년 ").substring(0, 11)}일
          </div>

          <!-- 공급자 및 공급받는자 인적사항 그리드 (단일 테이블화) -->
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #4E8B62; font-size: 6.5pt; margin-bottom: 2px; text-align: center; color: #000; table-layout: fixed;">
            <tr style="height: 17px; font-weight: bold; font-size: 6.8pt; line-height: 1.2;">
              <td colspan="4" style="border: 1px solid #4E8B62; background-color: #E4EFE7; color: #000; letter-spacing: 12px; padding: 1px 0px; white-space: nowrap;">공급자</td>
              <td colspan="4" style="border: 1px solid #4E8B62; background-color: #E4EFE7; color: #000; letter-spacing: 6px; padding: 1px 0px; white-space: nowrap;">공급받는자</td>
            </tr>
            <tr style="height: 17px; line-height: 1.2;">
              <td style="border: 1px solid #4E8B62; background-color: #E4EFE7; font-weight: bold; width: 12%; white-space: nowrap; padding: 1px 3px; box-sizing: border-box;">사업자등록번호</td>
              <td colspan="3" style="border: 1px solid #4E8B62; font-weight: bold; font-size: 7.2pt; text-align: left; padding: 1px 3px; letter-spacing: 0.5px; white-space: nowrap; box-sizing: border-box;">${activeHq.regNo}</td>
              <td style="border: 1px solid #4E8B62; background-color: #E4EFE7; font-weight: bold; width: 12%; white-space: nowrap; padding: 1px 3px; box-sizing: border-box;">사업자등록번호</td>
              <td colspan="3" style="border: 1px solid #4E8B62; font-weight: bold; font-size: 7.2pt; text-align: left; padding: 1px 3px; letter-spacing: 0.5px; white-space: nowrap; box-sizing: border-box;">${partnerMeta.bizNo || "N/A"}</td>
            </tr>
            <tr style="height: 17px; line-height: 1.2;">
              <td style="border: 1px solid #4E8B62; background-color: #E4EFE7; font-weight: bold; white-space: nowrap; padding: 1px 3px; box-sizing: border-box;">상호</td>
              <td style="border: 1px solid #4E8B62; text-align: left; padding: 1px 3px; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; box-sizing: border-box;">
                ${escapeHtml(activeHq.name)}
              </td>
              <td style="border: 1px solid #4E8B62; background-color: #E4EFE7; font-weight: bold; white-space: nowrap; padding: 1px 3px; box-sizing: border-box;">성명 (대표자)</td>
              <td style="border: 1px solid #4E8B62; text-align: left; padding: 1px 3px; white-space: nowrap; overflow: visible; box-sizing: border-box;">
                <div style="display: inline-block; vertical-align: middle;">
                  ${escapeHtml(activeHq.owner)}
                </div>
                <span style="position: relative; color: #bbb; font-weight: normal; margin-left: 2px; display: inline-block; vertical-align: middle; width: 16px; height: 16px; line-height: 16px; text-align: center;">
                  <div style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 18px; height: 18px; pointer-events: none;">
                    ${printSeal 
                      ? `<img src="${printSeal}" style="width: 18px; height: 18px; object-fit: contain; display: block;">`
                      : `<div style="width: 18px; height: 18px; border: 0.8px solid rgba(231, 76, 60, 0.85); border-radius: 50%; color: rgba(231, 76, 60, 0.85); font-size: 3.8pt; font-weight: bold; text-align: center; line-height: 1; padding: 2px 0px; transform: rotate(-8deg); background: rgba(255,255,255,0.75); display: flex; align-items: center; justify-content: center; box-sizing: border-box; font-family: 'Noto Sans KR', sans-serif;">${escapeHtml(activeHq.owner.substring(0,2))}<br>인</div>`
                    }
                  </div>
                </span>
              </td>
              
              <td style="border: 1px solid #4E8B62; background-color: #E4EFE7; font-weight: bold; white-space: nowrap; padding: 1px 3px; box-sizing: border-box;">상호</td>
              <td style="border: 1px solid #4E8B62; text-align: left; padding: 1px 3px; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; box-sizing: border-box;">${escapeHtml(partnerMeta.name)}</td>
              <td style="border: 1px solid #4E8B62; background-color: #E4EFE7; font-weight: bold; white-space: nowrap; padding: 1px 3px; box-sizing: border-box;">성명 (대표자)</td>
              <td style="border: 1px solid #4E8B62; text-align: left; padding: 1px 3px; white-space: nowrap; overflow: visible; box-sizing: border-box;">
                <div style="display: inline-block; vertical-align: middle;">
                  ${escapeHtml(partnerMeta.owner || "대표")}
                </div>
                <span style="position: relative; color: #bbb; font-weight: normal; margin-left: 2px; display: inline-block; vertical-align: middle; width: 16px; height: 16px; line-height: 16px; text-align: center;">
                  [인]
                  <div style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 18px; height: 18px; pointer-events: none;">
                    <div style="width: 18px; height: 18px; border: 0.8px solid rgba(231, 76, 60, 0.85); border-radius: 50%; color: rgba(231, 76, 60, 0.85); font-size: 3.8pt; font-weight: bold; text-align: center; line-height: 1; padding: 2px 0px; transform: rotate(-8deg); background: rgba(255,255,255,0.75); display: flex; align-items: center; justify-content: center; box-sizing: border-box; font-family: 'Noto Sans KR', sans-serif;">${escapeHtml((partnerMeta.owner || "대표").substring(0,2))}<br>인</div>
                  </div>
                </span>
              </td>
            </tr>
            <tr style="height: 17px; line-height: 1.2;">
              <td style="border: 1px solid #4E8B62; background-color: #E4EFE7; font-weight: bold; white-space: nowrap; padding: 1px 3px; box-sizing: border-box;">사업장 소재지</td>
              <td colspan="3" style="border: 1px solid #4E8B62; text-align: left; padding: 1px 3px; font-size: 6.5pt; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; box-sizing: border-box;">${escapeHtml(activeHq.address)}</td>
              <td style="border: 1px solid #4E8B62; background-color: #E4EFE7; font-weight: bold; white-space: nowrap; padding: 1px 3px; box-sizing: border-box;">사업장 소재지</td>
              <td colspan="3" style="border: 1px solid #4E8B62; text-align: left; padding: 1px 3px; font-size: 6.5pt; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; box-sizing: border-box;">${escapeHtml(partnerMeta.address || "N/A")}</td>
            </tr>
            <tr style="height: 17px; line-height: 1.2;">
              <td style="border: 1px solid #4E8B62; background-color: #E4EFE7; font-weight: bold; white-space: nowrap; padding: 1px 3px; box-sizing: border-box;">업태</td>
              <td style="border: 1px solid #4E8B62; text-align: left; padding: 1px 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; box-sizing: border-box;">도소매</td>
              <td style="border: 1px solid #4E8B62; background-color: #E4EFE7; font-weight: bold; white-space: nowrap; padding: 1px 3px; box-sizing: border-box;">종목</td>
              <td style="border: 1px solid #4E8B62; text-align: left; padding: 1px 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; box-sizing: border-box;">농수산물</td>
              
              <td style="border: 1px solid #4E8B62; background-color: #E4EFE7; font-weight: bold; white-space: nowrap; padding: 1px 3px; box-sizing: border-box;">업태</td>
              <td style="border: 1px solid #4E8B62; text-align: left; padding: 1px 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; box-sizing: border-box;">도소매</td>
              <td style="border: 1px solid #4E8B62; background-color: #E4EFE7; font-weight: bold; white-space: nowrap; padding: 1px 3px; box-sizing: border-box;">종목</td>
              <td style="border: 1px solid #4E8B62; text-align: left; padding: 1px 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; box-sizing: border-box;">음료외</td>
            </tr>
          </table>

          <!-- 품목 그리드 테이블 -->
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #4E8B62; font-size: 7.5pt; margin-bottom: 2px; color: #000; table-layout: fixed;">
            <colgroup>
              <col style="width: 5%;">
              <col style="width: 35%;">
              <col style="width: 8%;">
              <col style="width: 8%;">
              <col style="width: 12%;">
              <col style="width: 15%;">
              <col style="width: 12%;">
              <col style="width: 5%;">
            </colgroup>
            <thead>
              <tr style="background-color: #E4EFE7; height: 20px; color: #000; font-weight: bold; text-align: center; font-size: 7.5pt; line-height: 1.2;">
                <th style="border: 1px solid #4E8B62; white-space: nowrap; padding: 1px 0px;">번호</th>
                <th style="border: 1px solid #4E8B62; white-space: nowrap; padding: 1px 0px;">품목명</th>
                <th style="border: 1px solid #4E8B62; white-space: nowrap; padding: 1px 0px;">규격</th>
                <th style="border: 1px solid #4E8B62; white-space: nowrap; padding: 1px 0px;">수량</th>
                <th style="border: 1px solid #4E8B62; white-space: nowrap; padding: 1px 0px;">단가</th>
                <th style="border: 1px solid #4E8B62; white-space: nowrap; padding: 1px 0px;">공급가액</th>
                <th style="border: 1px solid #4E8B62; white-space: nowrap; padding: 1px 0px;">세액</th>
                <th style="border: 1px solid #4E8B62; white-space: nowrap; padding: 1px 0px;">비고</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
        </div>

        <!-- 하단 정보 및 서명 란 -->
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 6.5pt; margin-top: 2px; color: #000; white-space: nowrap;">
          <div style="font-weight: bold;">
            ${sale.status === STATUS_PAID 
              ? `☑ 영수함 &nbsp;&nbsp;&nbsp;&nbsp; ☐ 청구함`
              : `☐ 영수함 &nbsp;&nbsp;&nbsp;&nbsp; ☑ 청구함`
            }
          </div>
          <div style="font-weight: bold;">
            담당자 : ${escapeHtml(activeHq.owner)} (${escapeHtml(activeHq.phone || "010-1234-5678")})
          </div>
          <div style="color: #666; font-size: 6.0pt;">
            * 본 명세서는 거래 사실을 증명하는 소중한 서류이오니 잘 보관하여 주시기 바랍니다.
          </div>
        </div>
      </div>
    `;
  }

  injectPrintStyle(`
    @media print {
      @page {
        size: A5 landscape;
        margin: 8mm 8mm;
      }
      body {
        margin: 0;
        padding: 0;
        background: #fff;
      }
      #print-document-area {
        display: block !important;
        width: 194mm !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #fff !important;
      }
      .print-invoice-page {
        width: 194mm !important;
        height: 132mm !important;
        margin: 0 !important;
        padding: 0 !important;
        box-sizing: border-box !important;
        display: flex !important;
        flex-direction: column !important;
        justify-content: space-between !important;
        background: #fff !important;
        color: #000 !important;
      }
    }
  `);
  printArea.innerHTML = fullHtml;
  setTimeout(() => {
    window.print();
    setTimeout(clearPrintStyle, 2000);
  }, 150);
}

async function handleSalesPrint(sale, isLabelOn) {
  triggerInvoicePrintDoc(sale);
  if (isLabelOn) {
    await new Promise(resolve => setTimeout(resolve, 500));
    triggerLabelPrintDoc(sale);
  }
}

function triggerPurchaseInvoicePrintDoc(pur) {
  const activeHq = db.headquarters.find(hq => hq.id === db.activeHqId) || db.headquarters[0];
  const printSeal = db.settings.printSealImage || activeHq.stamp;
  const partnerMeta = db.partners.find(p => p.name === pur.partner) || { name: pur.partner, bizNo: "109-51-71804", owner: "박시안", address: "서울특별시 송파구 송파대로 167", phone: "02-478-7822" };
  const printArea = document.getElementById("print-document-area");

  // 외상 및 잔액 계산
  const rp = db.receivablesPayments[pur.partner] || { paid: 0, totalPurchases: null };
  const finalPayable = (rp.totalPurchases !== undefined && rp.totalPurchases !== null)
    ? (rp.totalPurchases - rp.paid)
    : (db.purchases.filter(p => p.partner === pur.partner && p.status === STATUS_CREDIT).reduce((sum, curr) => sum + curr.total, 0) - rp.paid);

  const currentPaid = pur.status === STATUS_PAID ? pur.total : 0;
  const prevPayable = finalPayable - (pur.status === STATUS_CREDIT ? pur.total : 0);
  const totalSumAmount = prevPayable + pur.total;
  const currentTotalPayable = totalSumAmount - currentPaid;

  const maxInvoiceRows = 13;
  const totalItems = pur.items.length;
  const totalPages = Math.ceil(Math.max(1, totalItems) / maxInvoiceRows);

  let fullHtml = "";

  for (let page = 0; page < totalPages; page++) {
    const startIndex = page * maxInvoiceRows;
    const endIndex = startIndex + maxInvoiceRows;
    const pageItems = pur.items.slice(startIndex, endIndex);

    let itemsHtml = "";
    
    // 1. 실제 품목 추가
    pageItems.forEach((item, i) => {
      const globalIdx = startIndex + i;
      itemsHtml += `
        <tr style="height: 20px; font-size: 7.5pt; color: #000; line-height: 1.2;">
          <td style="border: 1px solid #4E8B62; padding: 1px 1px; text-align: center; white-space: nowrap;">${globalIdx + 1}</td>
          <td style="border: 1px solid #4E8B62; padding: 1px 3px; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px;">${escapeHtml(item.name)}</td>
          <td style="border: 1px solid #4E8B62; padding: 1px 1px; text-align: center; color: #333; white-space: nowrap;">${escapeHtml(item.unit || "EA")}</td>
          <td style="border: 1px solid #4E8B62; padding: 1px 1px; text-align: center; font-weight: bold; white-space: nowrap;">${item.qty}</td>
          <td style="border: 1px solid #4E8B62; padding: 1px 3px; text-align: right; font-family: monospace; white-space: nowrap;">${formatNumber(item.price)}</td>
          <td style="border: 1px solid #4E8B62; padding: 1px 3px; text-align: right; font-family: monospace; white-space: nowrap;">${formatNumber(item.amount)}</td>
          <td style="border: 1px solid #4E8B62; padding: 1px 3px; text-align: right; font-family: monospace; white-space: nowrap;">${formatNumber(item.tax)}</td>
          <td style="border: 1px solid #4E8B62; padding: 1px 1px; text-align: center; color: #888; white-space: nowrap;">-</td>
        </tr>
      `;
    });

    // 2. 이하여백 추가 (마지막 페이지이며, 품목 개수가 13개 미만일 때만)
    let currentRows = pageItems.length;
    const isLastPage = page === totalPages - 1;
    if (isLastPage && currentRows < maxInvoiceRows) {
      const globalIdx = startIndex + currentRows;
      itemsHtml += `
        <tr style="height: 20px; font-size: 7.5pt; color: #888; line-height: 1.2;">
          <td style="border: 1px solid #4E8B62; padding: 1px 1px; text-align: center; white-space: nowrap;">${globalIdx + 1}</td>
          <td style="border: 1px solid #4E8B62; padding: 1px 3px; text-align: left; font-style: italic; white-space: nowrap;">=====이하여백=====</td>
          <td style="border: 1px solid #4E8B62; padding: 1px 1px; text-align: center; white-space: nowrap;">-</td>
          <td style="border: 1px solid #4E8B62; padding: 1px 1px; text-align: center; white-space: nowrap;">-</td>
          <td style="border: 1px solid #4E8B62; padding: 1px 3px; text-align: right; font-family: monospace; white-space: nowrap;">-</td>
          <td style="border: 1px solid #4E8B62; padding: 1px 3px; text-align: right; font-family: monospace; white-space: nowrap;">-</td>
          <td style="border: 1px solid #4E8B62; padding: 1px 3px; text-align: right; font-family: monospace; white-space: nowrap;">-</td>
          <td style="border: 1px solid #4E8B62; padding: 1px 1px; text-align: center; white-space: nowrap;">-</td>
        </tr>
      `;
      currentRows++;
    }

    // 3. 남은 빈 줄 채워서 총 13줄 맞춤
    const emptyRowsCount = Math.max(0, maxInvoiceRows - currentRows);
    for (let i = 0; i < emptyRowsCount; i++) {
      const globalIdx = startIndex + currentRows + i;
      itemsHtml += `
        <tr style="height: 20px; line-height: 1.2;">
          <td style="border: 1px solid #4E8B62; padding: 1px 1px; text-align: center; font-size: 7.5pt; color: #ccc; white-space: nowrap;">${globalIdx + 1}</td>
          <td style="border: 1px solid #4E8B62; padding: 1px 1px;"></td>
          <td style="border: 1px solid #4E8B62; padding: 1px 1px;"></td>
          <td style="border: 1px solid #4E8B62; padding: 1px 1px;"></td>
          <td style="border: 1px solid #4E8B62; padding: 1px 1px;"></td>
          <td style="border: 1px solid #4E8B62; padding: 1px 1px;"></td>
          <td style="border: 1px solid #4E8B62; padding: 1px 1px;"></td>
          <td style="border: 1px solid #4E8B62; padding: 1px 1px;"></td>
        </tr>
      `;
    }

    // 4. 2줄 상세 회계/잔액 합계 요약 행 추가 (전잔금 3:7 비율, 품목 행과 동일하게 높이 20px로 조정)
    itemsHtml += `
      <tr style="height: 20px; font-size: 7.2pt; font-weight: bold; color: #000; line-height: 1.2;">
        <td colspan="4" style="border: 1px solid #4E8B62; padding: 0; box-sizing: border-box; vertical-align: middle;">
          <div style="display: flex; width: 100%; align-items: center;">
            <div style="width: 30%; background-color: #E4EFE7; text-align: center; font-weight: bold; border-right: 1px solid #4E8B62; padding: 2px 0; box-sizing: border-box; white-space: nowrap;">전잔금</div>
            <div style="width: 70%; text-align: right; font-family: monospace; padding: 2px 4px; box-sizing: border-box; white-space: nowrap; font-weight: bold;">${formatNumber(prevPayable)}</div>
          </div>
        </td>
        <td colspan="1" style="border: 1px solid #4E8B62; background-color: #E4EFE7; text-align: center; white-space: nowrap; padding: 2px 2px; box-sizing: border-box; vertical-align: middle;">합계</td>
        <td colspan="1" style="border: 1px solid #4E8B62; text-align: right; font-family: monospace; padding: 2px 4px; white-space: nowrap; font-weight: bold; box-sizing: border-box; vertical-align: middle;">${formatNumber(pur.amount)}</td>
        <td colspan="1" style="border: 1px solid #4E8B62; text-align: right; font-family: monospace; padding: 2px 4px; white-space: nowrap; font-weight: bold; box-sizing: border-box; vertical-align: middle;">${formatNumber(pur.tax)}</td>
        <td colspan="1" style="border: 1px solid #4E8B62; text-align: center; color: #000; font-weight: bold; white-space: nowrap; padding: 2px 0px; box-sizing: border-box; vertical-align: middle;">${page + 1}/${totalPages}</td>
      </tr>
      <tr style="height: 20px; font-size: 7.2pt; font-weight: bold; color: #000; line-height: 1.2;">
        <td colspan="2" style="border: 1px solid #4E8B62; padding: 0; box-sizing: border-box; vertical-align: middle;">
          <div style="display: flex; width: 100%; align-items: center;">
            <div style="width: 35%; background-color: #E4EFE7; text-align: center; font-weight: bold; border-right: 1px solid #4E8B62; padding: 2px 0; box-sizing: border-box; white-space: nowrap;">총합계</div>
            <div style="width: 65%; text-align: right; font-family: monospace; padding: 2px 4px; box-sizing: border-box; white-space: nowrap; font-weight: bold; color: #111;">${formatNumber(totalSumAmount)}</div>
          </div>
        </td>
        <td colspan="1" style="border: 1px solid #4E8B62; background-color: #E4EFE7; text-align: center; white-space: nowrap; padding: 2px 2px; box-sizing: border-box; vertical-align: middle;">지급</td>
        <td colspan="1" style="border: 1px solid #4E8B62; text-align: right; font-family: monospace; padding: 2px 4px; white-space: nowrap; font-weight: bold; box-sizing: border-box; vertical-align: middle;">${formatNumber(currentPaid)}</td>
        <td colspan="1" style="border: 1px solid #4E8B62; background-color: #E4EFE7; text-align: center; white-space: nowrap; padding: 2px 2px; box-sizing: border-box; vertical-align: middle;">총잔액</td>
        <td colspan="1" style="border: 1px solid #4E8B62; text-align: right; font-family: monospace; padding: 2px 4px; color: #1e5a32; white-space: nowrap; font-weight: bold; box-sizing: border-box; vertical-align: middle;">${formatNumber(currentTotalPayable)}</td>
        <td colspan="1" style="border: 1px solid #4E8B62; background-color: #E4EFE7; text-align: center; white-space: nowrap; padding: 2px 2px; box-sizing: border-box; vertical-align: middle;">인수자</td>
        <td colspan="1" style="border: 1px solid #4E8B62; text-align: center; color: #666; font-size: 6.5pt; padding: 2px 0px; white-space: nowrap; box-sizing: border-box; vertical-align: middle;">(인)</td>
      </tr>
    `;

    fullHtml += `
      <div class="print-invoice-page" style="width: 194mm; height: 132mm; display: flex; flex-direction: column; justify-content: space-between; page-break-after: ${page === totalPages - 1 ? 'avoid' : 'always'}; margin: 0; padding: 0; font-family: 'Noto Sans KR', sans-serif; background: #fff; color: #000; box-sizing: border-box;">
        <div>
          <!-- 상단 타이틀 영역 (초슬림 여백) -->
          <div style="font-size: 13pt; font-weight: bold; text-align: left; color: #000; letter-spacing: 1px; margin-bottom: 0px; white-space: nowrap;">매입거래명세서</div>
          <div style="border-bottom: 1px solid #4E8B62; padding-bottom: 0px; font-size: 6.5pt; color: #333; margin-bottom: 2px; font-weight: bold; white-space: nowrap;">
            No: ${pur.id} &nbsp;|&nbsp; Date (일자): ${pur.date.replace(/-/g, "년 ").substring(0, 11)}일
          </div>

          <!-- 공급자 및 공급받는자 인적사항 그리드 (단일 테이블화) -->
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #4E8B62; font-size: 6.5pt; margin-bottom: 2px; text-align: center; color: #000; table-layout: fixed;">
            <tr style="height: 17px; font-weight: bold; font-size: 6.8pt; line-height: 1.2;">
              <td colspan="4" style="border: 1px solid #4E8B62; background-color: #E4EFE7; color: #000; letter-spacing: 12px; padding: 1px 0px; white-space: nowrap;">공급자</td>
              <td colspan="4" style="border: 1px solid #4E8B62; background-color: #E4EFE7; color: #000; letter-spacing: 6px; padding: 1px 0px; white-space: nowrap;">공급받는자</td>
            </tr>
            <tr style="height: 17px; line-height: 1.2;">
              <td style="border: 1px solid #4E8B62; background-color: #E4EFE7; font-weight: bold; width: 12%; white-space: nowrap; padding: 1px 3px; box-sizing: border-box;">사업자등록번호</td>
              <td colspan="3" style="border: 1px solid #4E8B62; font-weight: bold; font-size: 7.2pt; text-align: left; padding: 1px 3px; letter-spacing: 0.5px; white-space: nowrap; box-sizing: border-box;">${partnerMeta.bizNo || "N/A"}</td>
              <td style="border: 1px solid #4E8B62; background-color: #E4EFE7; font-weight: bold; width: 12%; white-space: nowrap; padding: 1px 3px; box-sizing: border-box;">사업자등록번호</td>
              <td colspan="3" style="border: 1px solid #4E8B62; font-weight: bold; font-size: 7.2pt; text-align: left; padding: 1px 3px; letter-spacing: 0.5px; white-space: nowrap; box-sizing: border-box;">${activeHq.regNo}</td>
            </tr>
            <tr style="height: 17px; line-height: 1.2;">
              <td style="border: 1px solid #4E8B62; background-color: #E4EFE7; font-weight: bold; white-space: nowrap; padding: 1px 3px; box-sizing: border-box;">상호</td>
              <td style="border: 1px solid #4E8B62; text-align: left; padding: 1px 3px; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; box-sizing: border-box;">
                ${escapeHtml(partnerMeta.name)}
              </td>
              <td style="border: 1px solid #4E8B62; background-color: #E4EFE7; font-weight: bold; white-space: nowrap; padding: 1px 3px; box-sizing: border-box;">성명 (대표자)</td>
              <td style="border: 1px solid #4E8B62; text-align: left; padding: 1px 3px; white-space: nowrap; overflow: visible; box-sizing: border-box;">
                <div style="display: inline-block; vertical-align: middle;">
                  ${escapeHtml(partnerMeta.owner || "대표")}
                </div>
                <span style="position: relative; color: #bbb; font-weight: normal; margin-left: 2px; display: inline-block; vertical-align: middle; width: 16px; height: 16px; line-height: 16px; text-align: center;">
                  [인]
                  <div style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 18px; height: 18px; pointer-events: none;">
                    <div style="width: 18px; height: 18px; border: 0.8px solid rgba(231, 76, 60, 0.85); border-radius: 50%; color: rgba(231, 76, 60, 0.85); font-size: 3.8pt; font-weight: bold; text-align: center; line-height: 1; padding: 2px 0px; transform: rotate(-8deg); background: rgba(255,255,255,0.75); display: flex; align-items: center; justify-content: center; box-sizing: border-box; font-family: 'Noto Sans KR', sans-serif;">${escapeHtml((partnerMeta.owner || "대표").substring(0,2))}<br>인</div>
                  </div>
                </span>
              </td>
              
              <td style="border: 1px solid #4E8B62; background-color: #E4EFE7; font-weight: bold; white-space: nowrap; padding: 1px 3px; box-sizing: border-box;">상호</td>
              <td style="border: 1px solid #4E8B62; text-align: left; padding: 1px 3px; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; box-sizing: border-box;">${escapeHtml(activeHq.name)}</td>
              <td style="border: 1px solid #4E8B62; background-color: #E4EFE7; font-weight: bold; white-space: nowrap; padding: 1px 3px; box-sizing: border-box;">성명 (대표자)</td>
              <td style="border: 1px solid #4E8B62; text-align: left; padding: 1px 3px; white-space: nowrap; overflow: visible; box-sizing: border-box;">
                <div style="display: inline-block; vertical-align: middle;">
                  ${escapeHtml(activeHq.owner)}
                </div>
                <span style="position: relative; color: #bbb; font-weight: normal; margin-left: 2px; display: inline-block; vertical-align: middle; width: 16px; height: 16px; line-height: 16px; text-align: center;">
                  <div style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 18px; height: 18px; pointer-events: none;">
                    ${printSeal 
                      ? `<img src="${printSeal}" style="width: 18px; height: 18px; object-fit: contain; display: block;">`
                      : `<div style="width: 18px; height: 18px; border: 0.8px solid rgba(231, 76, 60, 0.85); border-radius: 50%; color: rgba(231, 76, 60, 0.85); font-size: 3.8pt; font-weight: bold; text-align: center; line-height: 1; padding: 2px 0px; transform: rotate(-8deg); background: rgba(255,255,255,0.75); display: flex; align-items: center; justify-content: center; box-sizing: border-box; font-family: 'Noto Sans KR', sans-serif;">${escapeHtml(activeHq.owner.substring(0,2))}<br>인</div>`
                    }
                  </div>
                </span>
              </td>
            </tr>
            <tr style="height: 17px; line-height: 1.2;">
              <td style="border: 1px solid #4E8B62; background-color: #E4EFE7; font-weight: bold; white-space: nowrap; padding: 1px 3px; box-sizing: border-box;">사업장 소재지</td>
              <td colspan="3" style="border: 1px solid #4E8B62; text-align: left; padding: 1px 3px; font-size: 6.5pt; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; box-sizing: border-box;">${escapeHtml(partnerMeta.address || "N/A")}</td>
              <td style="border: 1px solid #4E8B62; background-color: #E4EFE7; font-weight: bold; white-space: nowrap; padding: 1px 3px; box-sizing: border-box;">사업장 소재지</td>
              <td colspan="3" style="border: 1px solid #4E8B62; text-align: left; padding: 1px 3px; font-size: 6.5pt; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; box-sizing: border-box;">${escapeHtml(activeHq.address)}</td>
            </tr>
            <tr style="height: 17px; line-height: 1.2;">
              <td style="border: 1px solid #4E8B62; background-color: #E4EFE7; font-weight: bold; white-space: nowrap; padding: 1px 3px; box-sizing: border-box;">업태</td>
              <td style="border: 1px solid #4E8B62; text-align: left; padding: 1px 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; box-sizing: border-box;">도소매</td>
              <td style="border: 1px solid #4E8B62; background-color: #E4EFE7; font-weight: bold; white-space: nowrap; padding: 1px 3px; box-sizing: border-box;">종목</td>
              <td style="border: 1px solid #4E8B62; text-align: left; padding: 1px 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; box-sizing: border-box;">음료외</td>
              
              <td style="border: 1px solid #4E8B62; background-color: #E4EFE7; font-weight: bold; white-space: nowrap; padding: 1px 3px; box-sizing: border-box;">업태</td>
              <td style="border: 1px solid #4E8B62; text-align: left; padding: 1px 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; box-sizing: border-box;">도소매</td>
              <td style="border: 1px solid #4E8B62; background-color: #E4EFE7; font-weight: bold; white-space: nowrap; padding: 1px 3px; box-sizing: border-box;">종목</td>
              <td style="border: 1px solid #4E8B62; text-align: left; padding: 1px 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; box-sizing: border-box;">농수산물</td>
            </tr>
          </table>

          <!-- 품목 그리드 테이블 -->
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #4E8B62; font-size: 7.5pt; margin-bottom: 2px; color: #000; table-layout: fixed;">
            <colgroup>
              <col style="width: 5%;">
              <col style="width: 35%;">
              <col style="width: 8%;">
              <col style="width: 8%;">
              <col style="width: 12%;">
              <col style="width: 15%;">
              <col style="width: 12%;">
              <col style="width: 5%;">
            </colgroup>
            <thead>
              <tr style="background-color: #E4EFE7; height: 20px; color: #000; font-weight: bold; text-align: center; font-size: 7.5pt; line-height: 1.2;">
                <th style="border: 1px solid #4E8B62; white-space: nowrap; padding: 1px 0px;">번호</th>
                <th style="border: 1px solid #4E8B62; white-space: nowrap; padding: 1px 0px;">품목명</th>
                <th style="border: 1px solid #4E8B62; white-space: nowrap; padding: 1px 0px;">규격</th>
                <th style="border: 1px solid #4E8B62; white-space: nowrap; padding: 1px 0px;">수량</th>
                <th style="border: 1px solid #4E8B62; white-space: nowrap; padding: 1px 0px;">단가</th>
                <th style="border: 1px solid #4E8B62; white-space: nowrap; padding: 1px 0px;">공급가액</th>
                <th style="border: 1px solid #4E8B62; white-space: nowrap; padding: 1px 0px;">세액</th>
                <th style="border: 1px solid #4E8B62; white-space: nowrap; padding: 1px 0px;">비고</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
        </div>

        <!-- 하단 정보 및 서명 란 -->
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 6.5pt; margin-top: 2px; color: #000; white-space: nowrap;">
          <div style="font-weight: bold;">
            ${pur.status === STATUS_PAID 
              ? `☑ 영수함 &nbsp;&nbsp;&nbsp;&nbsp; ☐ 청구함`
              : `☐ 영수함 &nbsp;&nbsp;&nbsp;&nbsp; ☑ 청구함`
            }
          </div>
          <div style="font-weight: bold;">
            담당자 : ${escapeHtml(activeHq.owner)} (${escapeHtml(activeHq.phone || "010-1234-5678")})
          </div>
          <div style="color: #666; font-size: 6.0pt;">
            * 본 명세서는 거래 사실을 증명하는 소중한 서류이오니 잘 보관하여 주시기 바랍니다.
          </div>
        </div>
      </div>
    `;
  }

  injectPrintStyle(`
    @media print {
      @page {
        size: A5 landscape;
        margin: 8mm 8mm;
      }
      body {
        margin: 0;
        padding: 0;
        background: #fff;
      }
      #print-document-area {
        display: block !important;
        width: 194mm !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #fff !important;
      }
      .print-invoice-page {
        width: 194mm !important;
        height: 132mm !important;
        margin: 0 !important;
        padding: 0 !important;
        box-sizing: border-box !important;
        display: flex !important;
        flex-direction: column !important;
        justify-content: space-between !important;
        background: #fff !important;
        color: #000 !important;
      }
    }
  `);
  printArea.innerHTML = fullHtml;
  setTimeout(() => {
    window.print();
    setTimeout(clearPrintStyle, 2000);
  }, 150);
}

function renderSalesList() {
  const tbody = document.getElementById("sales-list-rows");
  if(!tbody) return;
  tbody.innerHTML = "";

  const startVal = document.getElementById("sales-filter-start").value;
  const endVal = document.getElementById("sales-filter-end").value;
  const partnerVal = document.getElementById("sales-filter-partner").value;

  db.sales.forEach((sal, idx) => {
    // 날짜 및 거래처 필터
    if (startVal && sal.date < startVal) return;
    if (endVal && sal.date > endVal) return;
    if (partnerVal && sal.partner !== partnerVal) return;

    const summary = sal.items.map(i => `${i.name}(${i.qty})`).join(", ");
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><code>${sal.id}</code></td>
      <td>${sal.date}</td>
      <td><strong>${sal.partner}</strong></td>
      <td>${summary}</td>
      <td><strong>${formatNumber(sal.total)} 원</strong></td>
      <td><span class="hotkey-badge">${sal.status}</span></td>
      <td>
        <button class="btn btn-primary" style="padding: 4px 8px; font-size: 0.75rem;" onclick="reprintInvoice(${idx})">명세서 출력</button>
        <button class="btn btn-primary" style="padding: 4px 8px; font-size: 0.75rem; background: var(--accent-color);" onclick="reprintLabel(${idx})">라벨 출력</button>
        <button class="btn btn-warning" style="padding: 4px 8px; font-size: 0.75rem; background: #e67e22; border-color: #d35400; color: #fff;" onclick="editSales(${idx})">수정</button>
        <button class="btn btn-danger" style="padding: 4px 8px; font-size: 0.75rem;" onclick="deleteSales(${idx})">삭제</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

const btnSalesFilter = document.getElementById("btn-sales-filter");
if(btnSalesFilter) btnSalesFilter.onclick = renderSalesList;

window.reprintLabel = function(idx) {
  const sale = db.sales[idx];
  if(sale) triggerLabelPrintDoc(sale);
};

window.reprintInvoice = function(idx) {
  const sale = db.sales[idx];
  if(sale) triggerInvoicePrintDoc(sale);
};

window.deleteSales = function(idx) {
  if(confirm("해당 매출 전표를 삭제하고 수량을 환원하시겠습니까?")) {
    const sale = db.sales[idx];
    sale.items.forEach(item => {
      const prod = db.products.find(p => p.name === item.name);
      if(prod) prod.stock += item.qty;
    });
    db.sales.splice(idx, 1);
    saveDb();
    renderSalesList();
    renderProducts();
  }
};

window.editSales = function(idx) {
  const sale = db.sales[idx];
  if (!sale) return;

  // 수정 모드로 설정
  editingSalesId = sale.id;

  // 매출 입력 카트에 기존 품목 로드 (깊은 복사)
  salesCart = JSON.parse(JSON.stringify(sale.items));

  // 각 품목별 부가세 여부를 기존 세액 기준으로 복구 및 면세 여부 획득
  salesCart.forEach(item => {
    item.isTaxApplied = (item.tax > 0);
    const prodMeta = db.products.find(p => p.name === item.name);
    item.taxType = prodMeta ? prodMeta.taxType : (item.tax > 0 ? TAX_TYPE_TAXABLE : TAX_TYPE_EXEMPT);
  });

  renderSalesCart();

  // 기존 항목 수량만큼 임시로 제품 재고에 환원
  sale.items.forEach(item => {
    const prod = db.products.find(p => p.name === item.name);
    if (prod) prod.stock += item.qty;
  });
  saveDb();
  renderProducts();

  // 폼 정보 기입
  document.getElementById("sales-date").value = sale.date;
  document.getElementById("sales-partner").value = sale.partner;
  document.getElementById("sales-status").value = sale.status;
  if (document.getElementById("sales-item-incoming")) {
    document.getElementById("sales-item-incoming").value = sale.date;
  }

  // UI 수정 모드로 전환
  const submitBtn = document.getElementById("btn-sales-submit");
  if (submitBtn) submitBtn.innerHTML = '<i data-lucide="save"></i> 수정 완료 및 저장/인쇄';
  const cancelBtn = document.getElementById("btn-sales-cancel-edit");
  if (cancelBtn) cancelBtn.style.display = "inline-block";

  if (window.lucide) window.lucide.createIcons();

  // 입력 폼이 있는 상단으로 부드럽게 스크롤
  document.getElementById("form-sales-bill").scrollIntoView({ behavior: 'smooth' });
};

window.cancelEditSales = function() {
  if (editingSalesId) {
    // 취소 시 기존 전표 수량만큼 재고 다시 차감
    const sale = db.sales.find(s => s.id === editingSalesId);
    if (sale) {
      sale.items.forEach(item => {
        const prod = db.products.find(p => p.name === item.name);
        if (prod) prod.stock = Math.max(0, prod.stock - item.qty);
      });
      saveDb();
      renderProducts();
    }
  }

  // 데이터 초기화
  editingSalesId = null;
  salesCart = [];
  resetSalesTaxState(); // 부가세 상태 초기화
  renderSalesCart();
  document.getElementById("form-sales-bill").reset();
  resetLabelPrintToggle();

  const todayStr = getKstTodayString();
  document.getElementById("sales-date").value = todayStr;
  if (document.getElementById("sales-item-incoming")) {
    document.getElementById("sales-item-incoming").value = todayStr;
  }

  // UI 일반 모드로 복원
  const submitBtn = document.getElementById("btn-sales-submit");
  if (submitBtn) submitBtn.innerHTML = '<i data-lucide="printer"></i> 저장 및 명세서/라벨 출력';
  const cancelBtn = document.getElementById("btn-sales-cancel-edit");
  if (cancelBtn) cancelBtn.style.display = "none";

  if (window.lucide) window.lucide.createIcons();
};

// --- 8.1 견적서 관리 비즈니스 로직 ---
let estCart = [];

function numToKorean(num) {
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
}

function prefillEstimateSupplier() {
  const activeHq = db.headquarters.find(hq => hq.id === db.activeHqId) || db.headquarters[0];
  if (activeHq) {
    if (document.getElementById("est-supplier-name")) document.getElementById("est-supplier-name").value = activeHq.name;
    if (document.getElementById("est-supplier-bizno")) document.getElementById("est-supplier-bizno").value = activeHq.regNo;
    if (document.getElementById("est-supplier-owner")) document.getElementById("est-supplier-owner").value = activeHq.owner;
    if (document.getElementById("est-supplier-address")) document.getElementById("est-supplier-address").value = activeHq.address;
    if (document.getElementById("est-supplier-biztype")) document.getElementById("est-supplier-biztype").value = activeHq.business ? activeHq.business.split("/")[0].trim() : "도소매";
    if (document.getElementById("est-supplier-bizitem")) document.getElementById("est-supplier-bizitem").value = activeHq.business ? (activeHq.business.split("/")[1] || activeHq.business).trim() : "농수산물";
    if (document.getElementById("est-supplier-manager")) document.getElementById("est-supplier-manager").value = "김수정";
    if (document.getElementById("est-supplier-phone")) document.getElementById("est-supplier-phone").value = "00-1000-0000";
  }
}

// 견적서 카트 품목 추가
const btnAddEstItem = document.getElementById("btn-add-est-item");
if (btnAddEstItem) {
  btnAddEstItem.addEventListener("click", () => {
    const itemName = document.getElementById("est-item-select").value;
    if (!itemName) {
      alert("견적 품목을 먼저 선택해 주십시오.");
      return;
    }
    const qty = parseFloat(document.getElementById("est-item-qty").value) || 1.0;
    const unit = document.getElementById("est-item-unit").value || "그레이";
    const type = document.getElementById("est-item-type").value || "벌";
    const price = parseInt(document.getElementById("est-item-price").value) || 0;

    const amount = Math.floor(qty * price);
    const tax = Math.floor(amount * TAX_RATE); // 견적서는 과세 기준으로 10% 자동 계산
    const total = amount + tax;

    estCart.push({ name: itemName, unit, type, qty, price, amount, tax, total });
    renderEstCart();

    // 폼 초기화
    document.getElementById("est-item-select-btn").value = "";
    document.getElementById("est-item-select").value = "";
    document.getElementById("est-item-unit").value = "";
    document.getElementById("est-item-qty").value = "1";
    document.getElementById("est-item-price").value = "0";
  });
}

function renderEstCart() {
  const tbody = document.getElementById("est-cart-rows");
  if (!tbody) return;
  tbody.innerHTML = "";
  let totalSum = 0;

  estCart.forEach((item, idx) => {
    totalSum += item.total;
    const row = document.createElement("tr");
    // 각 인풋은 oninput으로만 데이터를 저장. onblur 리렌더링 없음 → 포커스 유실 방지
    row.innerHTML = `
      <td>${item.name}</td>
      <td><input type="text" value="${item.unit || ''}" style="width:80px; ${INLINE_INPUT_STYLE} text-align:center;"
        oninput="estCart[${idx}].unit = this.value"></td>
      <td><input type="text" value="${item.type || ''}" style="width:60px; ${INLINE_INPUT_STYLE} text-align:center;"
        oninput="estCart[${idx}].type = this.value"></td>
      <td><input type="number" value="${item.qty}" min="0" step="any" style="width:60px; ${INLINE_INPUT_STYLE} text-align:center;"
        oninput="updateEstCartNumeric(${idx}, 'qty', this.value)"></td>
      <td><input type="number" value="${item.price}" min="0" style="width:90px; ${INLINE_INPUT_STYLE} text-align:right;"
        oninput="updateEstCartNumeric(${idx}, 'price', this.value)">원</td>
      <td id="est-amount-cell-${idx}">${formatNumber(item.amount)}원</td>
      <td id="est-tax-cell-${idx}">${formatNumber(item.tax)}원</td>
      <td><button type="button" class="btn btn-danger" style="padding:2px 6px;" onclick="removeEstCartItem(${idx})">삭제</button></td>
    `;
    tbody.appendChild(row);
  });

  document.getElementById("est-korean-summary").textContent = numToKorean(totalSum);
  document.getElementById("est-total-val").textContent = `\\ ${formatNumber(totalSum)}`;
}

window.updateEstCartNumeric = function(idx, key, val) {
  const num = key === 'qty' ? (parseFloat(val) || 0) : (parseInt(val, 10) || 0);
  estCart[idx][key] = num;
  if (key === 'qty' || key === 'price') {
    const amount = Math.floor(estCart[idx].qty * estCart[idx].price);
    const tax = Math.floor(amount * TAX_RATE);
    estCart[idx].amount = amount;
    estCart[idx].tax = tax;
    estCart[idx].total = amount + tax;
    // 포커스 유실 없이 해당 셀만 직접 업데이트
    const amountCell = document.getElementById(`est-amount-cell-${idx}`);
    const taxCell = document.getElementById(`est-tax-cell-${idx}`);
    if (amountCell) amountCell.textContent = `${formatNumber(amount)}원`;
    if (taxCell) taxCell.textContent = `${formatNumber(tax)}원`;
  }
  
  const totalSum = estCart.reduce((sum, curr) => sum + curr.total, 0);
  document.getElementById("est-korean-summary").textContent = numToKorean(totalSum);
  document.getElementById("est-total-val").textContent = `\\ ${formatNumber(totalSum)}`;
};

window.removeEstCartItem = function(idx) {
  estCart.splice(idx, 1);
  renderEstCart();
};

// 견적서 제출 및 저장
const formEstimate = document.getElementById("form-estimate");
if (formEstimate) {
  formEstimate.addEventListener("submit", (e) => {
    e.preventDefault();
    if (estCart.length === 0) {
      alert("견적 품목을 최소 1개 이상 등록해 주십시오.");
      return;
    }

    const isEditing = (editingEstimateId !== null);
    const newEst = {
      id: isEditing ? editingEstimateId : document.getElementById("est-serial").value,
      date: document.getElementById("est-date").value,
      receiver: document.getElementById("est-receiver").value,
      ref: document.getElementById("est-ref").value,
      receiverPhone: document.getElementById("est-receiver-phone").value,
      supplier: {
        name: document.getElementById("est-supplier-name").value,
        bizNo: document.getElementById("est-supplier-bizno").value,
        owner: document.getElementById("est-supplier-owner").value,
        address: document.getElementById("est-supplier-address").value,
        bizType: document.getElementById("est-supplier-biztype").value,
        bizItem: document.getElementById("est-supplier-bizitem").value,
        manager: document.getElementById("est-supplier-manager").value,
        phone: document.getElementById("est-supplier-phone").value
      },
      items: [...estCart],
      totalAmount: estCart.reduce((sum, curr) => sum + curr.amount, 0),
      totalTax: estCart.reduce((sum, curr) => sum + curr.tax, 0),
      totalSum: estCart.reduce((sum, curr) => sum + curr.total, 0)
    };

    if (isEditing) {
      const idx = db.estimates.findIndex(est => est.id === editingEstimateId);
      if (idx !== -1) {
        db.estimates[idx] = newEst;
      }
      editingEstimateId = null;
      
      const submitBtn = document.getElementById("btn-estimate-submit");
      if (submitBtn) submitBtn.innerHTML = '<i data-lucide="file-check"></i> 견적서 발행 및 시스템 저장';
      const cancelBtn = document.getElementById("btn-estimate-cancel-edit");
      if (cancelBtn) cancelBtn.style.display = "none";
    } else {
      db.estimates.push(newEst);
    }

    saveDb();
    if (shouldPrintEstimate) {
      alert("견적서가 정상 발행되어 저장되었습니다. 인쇄 레이아웃을 호출합니다.");
      triggerEstimatePrintDoc(newEst);
    } else {
      alert("견적서가 성공적으로 저장되었습니다.");
    }

    // 초기화
    estCart = [];
    renderEstCart();
    formEstimate.reset();
    prefillEstimateSupplier();
    
    // 오늘 날짜 기본 지정
    const todayStr = getKstTodayString();
    document.getElementById("est-date").value = todayStr;
    document.getElementById("est-serial").value = Math.floor(Math.random() * 1000) + "-" + Math.floor(Math.random() * 1000);

    renderEstimatesList();
  });
}

function renderEstimatesList() {
  const tbody = document.getElementById("estimate-list-rows");
  if (!tbody) return;
  tbody.innerHTML = "";

  db.estimates.forEach((est, idx) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><code>${est.id}</code></td>
      <td>${est.date}</td>
      <td><strong>${est.receiver}</strong></td>
      <td>${formatNumber(est.totalAmount)} 원</td>
      <td>${formatNumber(est.totalTax)} 원</td>
      <td><strong>${formatNumber(est.totalSum)} 원</strong></td>
      <td>
        <button class="btn btn-primary" style="padding: 4px 8px; font-size: 0.75rem;" onclick="reprintEstimate(${idx})"><i data-lucide="printer"></i> 인쇄</button>
        <button class="btn btn-warning" style="padding: 4px 8px; font-size: 0.75rem; background: #e67e22; border-color: #d35400; color: #fff;" onclick="editEstimate(${idx})">수정</button>
        <button class="btn btn-danger" style="padding: 4px 8px; font-size: 0.75rem;" onclick="deleteEstimate(${idx})">삭제</button>
      </td>
    `;
    tbody.appendChild(row);
  });
  if (window.lucide) window.lucide.createIcons();
}

window.reprintEstimate = function(idx) {
  const est = db.estimates[idx];
  if (est) triggerEstimatePrintDoc(est);
};

window.deleteEstimate = function(idx) {
  if (confirm("해당 견적서 발행 이력을 삭제하시겠습니까?")) {
    db.estimates.splice(idx, 1);
    saveDb();
    renderEstimatesList();
  }
};

window.editEstimate = function(idx) {
  const est = db.estimates[idx];
  if (!est) return;

  editingEstimateId = est.id;
  estCart = JSON.parse(JSON.stringify(est.items));
  renderEstCart();

  document.getElementById("est-serial").value = est.id;
  document.getElementById("est-date").value = est.date;
  document.getElementById("est-receiver").value = est.receiver;
  document.getElementById("est-ref").value = est.ref || "";
  document.getElementById("est-receiver-phone").value = est.receiverPhone || "";
  
  if (est.supplier) {
    document.getElementById("est-supplier-name").value = est.supplier.name || "";
    document.getElementById("est-supplier-bizno").value = est.supplier.bizNo || "";
    document.getElementById("est-supplier-owner").value = est.supplier.owner || "";
    document.getElementById("est-supplier-address").value = est.supplier.address || "";
    document.getElementById("est-supplier-biztype").value = est.supplier.bizType || "";
    document.getElementById("est-supplier-bizitem").value = est.supplier.bizItem || "";
    document.getElementById("est-supplier-manager").value = est.supplier.manager || "";
    document.getElementById("est-supplier-phone").value = est.supplier.phone || "";
  }

  const submitBtn = document.getElementById("btn-estimate-submit");
  if (submitBtn) submitBtn.innerHTML = '<i data-lucide="save"></i> 수정 완료 및 저장/인쇄';
  const cancelBtn = document.getElementById("btn-estimate-cancel-edit");
  if (cancelBtn) cancelBtn.style.display = "inline-block";

  if (window.lucide) window.lucide.createIcons();
  document.getElementById("form-estimate").scrollIntoView({ behavior: 'smooth' });
};

window.cancelEditEstimate = function() {
  editingEstimateId = null;
  estCart = [];
  renderEstCart();
  document.getElementById("form-estimate").reset();
  prefillEstimateSupplier();

  const todayStr = getKstTodayString();
  document.getElementById("est-date").value = todayStr;
  document.getElementById("est-serial").value = Math.floor(Math.random() * 1000) + "-" + Math.floor(Math.random() * 1000);

  const submitBtn = document.getElementById("btn-estimate-submit");
  if (submitBtn) submitBtn.innerHTML = '<i data-lucide="file-check"></i> 견적서 발행 및 시스템 저장';
  const cancelBtn = document.getElementById("btn-estimate-cancel-edit");
  if (cancelBtn) cancelBtn.style.display = "none";

  if (window.lucide) window.lucide.createIcons();
};

function triggerEstimatePrintDoc(est) {
  const printArea = document.getElementById("print-document-area");
  
  // 견적서 한글 표기 변환
  const totalKorean = numToKorean(est.totalSum);

  // 품목 리스트 바인딩
  let itemsHtml = "";
  const maxEstimateRows = 8;
  
  // 1. 실제 품목 추가
  est.items.forEach((item, i) => {
    itemsHtml += `
      <tr style="height: 17px; font-size: 7.5pt;">
        <td class="text-center" style="border: 1px solid #000; padding: 2px;">${i + 1}</td>
        <td style="border: 1px solid #000; padding: 2px 4px; color:#000;">${escapeHtml(item.name)}</td>
        <td class="text-center" style="border: 1px solid #000; padding: 2px;">${escapeHtml(item.unit || "")}</td>
        <td class="text-center" style="border: 1px solid #000; padding: 2px;">${escapeHtml(item.type || "")}</td>
        <td class="text-center" style="border: 1px solid #000; padding: 2px; font-weight: bold;">${item.qty}</td>
        <td class="text-right" style="border: 1px solid #000; padding: 2px 4px;">${formatNumber(item.price)}</td>
        <td class="text-right" style="border: 1px solid #000; padding: 2px 4px; font-weight: bold;">${formatNumber(item.amount)}</td>
        <td class="text-right" style="border: 1px solid #000; padding: 2px 4px;">${formatNumber(item.tax)}</td>
        <td style="border: 1px solid #000; padding: 2px;"></td>
      </tr>
    `;
  });

  // 2. 이하여백 추가 (품목 개수가 8개 미만일 때만)
  let currentRows = est.items.length;
  if (currentRows < maxEstimateRows) {
    itemsHtml += `
      <tr style="height: 17px; font-size: 7.5pt; color: #888;">
        <td class="text-center" style="border: 1px solid #000; padding: 2px;">${currentRows + 1}</td>
        <td style="border: 1px solid #000; padding: 2px 4px; font-style: italic;">=====이하여백=====</td>
        <td class="text-center" style="border: 1px solid #000; padding: 2px;">-</td>
        <td class="text-center" style="border: 1px solid #000; padding: 2px;">-</td>
        <td class="text-center" style="border: 1px solid #000; padding: 2px;">-</td>
        <td class="text-right" style="border: 1px solid #000; padding: 2px 4px;">-</td>
        <td class="text-right" style="border: 1px solid #000; padding: 2px 4px;">-</td>
        <td class="text-right" style="border: 1px solid #000; padding: 2px 4px;">-</td>
        <td style="border: 1px solid #000; padding: 2px;"></td>
      </tr>
    `;
    currentRows++;
  }

  // 3. 남은 빈 줄 채워서 총 8줄 맞춤
  const emptyRowsCount = Math.max(0, maxEstimateRows - currentRows);
  for (let i = 0; i < emptyRowsCount; i++) {
    itemsHtml += `
      <tr style="height: 17px;">
        <td class="text-center" style="border: 1px solid #000; padding: 2px; font-size: 7.5pt; color: #ccc;">${currentRows + i + 1}</td>
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

  printArea.innerHTML = `
    <div style="width: 194mm; margin: 0 auto; padding: 6px; font-family: 'Noto Sans KR', sans-serif; background: #fff; color: #000; box-sizing: border-box;">
      <div style="text-align: center; font-size: 16pt; font-weight: 700; letter-spacing: 8px; margin-bottom: 10px; margin-top: 5px;">견 적 서</div>
      
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px; gap: 10px;">
        <!-- 수신인 정보 -->
        <div style="width: 48%; font-size: 8pt; line-height: 1.4;">
          <div style="margin-bottom: 3px; border-bottom: 1px solid #ddd; padding-bottom: 2px;"><strong>일련번호 :</strong> &nbsp;${est.id}</div>
          <div style="margin-bottom: 3px; border-bottom: 1px solid #ddd; padding-bottom: 2px;"><strong>수&nbsp;&nbsp;&nbsp;&nbsp;신 :</strong> &nbsp;${est.receiver}</div>
          <div style="margin-bottom: 3px; border-bottom: 1px solid #ddd; padding-bottom: 2px;"><strong>참&nbsp;&nbsp;&nbsp;&nbsp;조 :</strong> &nbsp;${est.ref || ""}</div>
          <div style="margin-bottom: 3px; border-bottom: 1px solid #ddd; padding-bottom: 2px;"><strong>전화번호 :</strong> &nbsp;${est.receiverPhone || ""}</div>
          <div style="margin-bottom: 3px; border-bottom: 1px solid #ddd; padding-bottom: 2px;"><strong>견적일자 :</strong> &nbsp;${est.date.replace(/-/g, "년 ").substring(0, 12)}일</div>
          <div style="border: none; font-size: 9pt; font-weight: bold; margin-top: 8px;">아래와 같이 견적합니다.</div>
        </div>

        <!-- 공급자 정보 -->
        <div style="width: 50%;">
          <table style="width: 100%; border-collapse: collapse; font-size: 7.5pt; border: 1.5px solid #000;">
            <tr>
              <td rowspan="4" style="width: 20px; text-align: center; font-weight: bold; background: #f7fafc; border: 1px solid #000; padding: 2px; line-height: 1.3;">공<br>급<br>자</td>
              <td style="background: #f7fafc; font-weight: bold; text-align: center; width: 55px; border: 1px solid #000; padding: 2px 4px;">상호</td>
              <td style="border: 1px solid #000; padding: 2px 4px;">${escapeHtml(est.supplier.name)}</td>
              <td style="background: #f7fafc; font-weight: bold; text-align: center; width: 45px; border: 1px solid #000; padding: 2px 4px;">대표자</td>
              <td style="text-align: center; border: 1px solid #000; padding: 2px;">${escapeHtml(est.supplier.owner)} (인)</td>
            </tr>
            <tr>
              <td style="background: #f7fafc; font-weight: bold; text-align: center; border: 1px solid #000; padding: 2px 4px;">사업자번호</td>
              <td colspan="3" style="border: 1px solid #000; padding: 2px 4px; font-weight: bold;">${escapeHtml(est.supplier.bizNo)}</td>
            </tr>
            <tr>
              <td style="background: #f7fafc; font-weight: bold; text-align: center; border: 1px solid #000; padding: 2px 4px;">주소</td>
              <td colspan="3" style="border: 1px solid #000; padding: 2px 4px;">${escapeHtml(est.supplier.address)}</td>
            </tr>
            <tr>
              <td style="background: #f7fafc; font-weight: bold; text-align: center; border: 1px solid #000; padding: 2px 4px;">업태</td>
              <td style="border: 1px solid #000; padding: 2px 4px;">${escapeHtml(est.supplier.bizType)}</td>
              <td style="background: #f7fafc; font-weight: bold; text-align: center; border: 1px solid #000; padding: 2px 4px;">종목</td>
              <td style="border: 1px solid #000; padding: 2px 4px;">${escapeHtml(est.supplier.bizItem)}</td>
            </tr>
            <tr>
              <td colspan="2" style="background: #f7fafc; font-weight: bold; text-align: center; border: 1px solid #000; padding: 2px 4px;">담당자</td>
              <td style="border: 1px solid #000; padding: 2px 4px;">${escapeHtml(est.supplier.manager)}</td>
              <td style="background: #f7fafc; font-weight: bold; text-align: center; border: 1px solid #000; padding: 2px 4px;">전화번호</td>
              <td style="border: 1px solid #000; padding: 2px 4px;">${escapeHtml(est.supplier.phone)}</td>
            </tr>
          </table>
        </div>
      </div>

      <!-- 합계 금액 바 -->
      <div style="display: flex; justify-content: space-between; align-items: center; border: 2px solid #000; background: #f1f5f9; padding: 4px 10px; font-size: 9.5pt; font-weight: bold; margin-bottom: 8px;">
        <span>합 계 금 액</span>
        <span style="letter-spacing: 2px;">${totalKorean}</span>
        <span style="font-family: monospace;">(\\ ${formatNumber(est.totalSum)} )</span>
      </div>

      <!-- 품목 리스트 -->
      <table style="width: 100%; border-collapse: collapse; font-size: 8pt; border: 1.5px solid #000;">
        <thead>
          <tr style="background: #f7fafc; font-weight: bold; text-align: center;">
            <th style="width: 5%; border: 1px solid #000; padding: 4px;">No</th>
            <th style="width: 35%; border: 1px solid #000; padding: 4px;">상품명</th>
            <th style="width: 10%; border: 1px solid #000; padding: 4px;">규격</th>
            <th style="width: 8%; border: 1px solid #000; padding: 4px;">단위</th>
            <th style="width: 8%; border: 1px solid #000; padding: 4px;">수량</th>
            <th style="width: 10%; border: 1px solid #000; padding: 4px;">단가</th>
            <th style="width: 12%; border: 1px solid #000; padding: 4px;">공급가액</th>
            <th style="width: 10%; border: 1px solid #000; padding: 4px;">세액</th>
            <th style="width: 10%; border: 1px solid #000; padding: 4px;">비고</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
          <!-- 합계 행 -->
          <tr style="background:#f7fafc; font-weight:bold; height: 18px;">
            <td colspan="2" class="text-center" style="border: 1px solid #000; padding: 2px 4px;">소계 (합계)</td>
            <td style="border: 1px solid #000; padding: 2px;"></td>
            <td style="border: 1px solid #000; padding: 2px;"></td>
            <td style="border: 1px solid #000; padding: 2px;"></td>
            <td style="border: 1px solid #000; padding: 2px;"></td>
            <td class="text-right" style="border: 1px solid #000; padding: 2px 4px; font-family: monospace;">${formatNumber(est.totalAmount)}</td>
            <td class="text-right" style="border: 1px solid #000; padding: 2px 4px; font-family: monospace;">${formatNumber(est.totalTax)}</td>
            <td class="text-center" style="border: 1px solid #000; padding: 2px; font-size: 7.5pt; font-family: monospace;">\\ ${formatNumber(est.totalSum)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;

  injectPrintStyle(`
    @media print {
      @page {
        size: portrait;
        margin: 10mm;
      }
    }
  `);
  setTimeout(() => {
    window.print();
    setTimeout(clearPrintStyle, 2000);
  }, 150);
}

// --- 9. 외상대금 및 미수금 수금/지급장 관리 ---
function renderReceivablesAndPayables() {
  const recBody = document.getElementById("receivable-list-rows");
  const payBody = document.getElementById("payable-list-rows");
  if(!recBody || !payBody) return;

  recBody.innerHTML = "";
  payBody.innerHTML = "";

  db.partners.forEach(partner => {
    // 외상 매출 미수금 집계
    if (partner.type === "매출처" || partner.type === "혼합") {
      const totalSales = (db.receivablesPayments[partner.name]?.totalSales !== undefined && db.receivablesPayments[partner.name]?.totalSales !== null)
        ? db.receivablesPayments[partner.name].totalSales
        : db.sales
            .filter(s => s.partner === partner.name && s.status === STATUS_CREDIT)
            .reduce((sum, curr) => sum + curr.total, 0);
      
      const recovered = db.receivablesPayments[partner.name]?.recovered || 0;
      const balance = totalSales - recovered;

      const row = document.createElement("tr");
      row.innerHTML = `
        <td><strong>${partner.name}</strong></td>
        <td>${formatNumber(totalSales)} 원</td>
        <td>${formatNumber(recovered)} 원</td>
        <td style="color: var(--accent-color); font-weight: bold;">${formatNumber(balance)} 원</td>
        <td>
          <button class="btn btn-success" style="padding:4px 8px; font-size:0.75rem;" onclick="payReceiveMoney('${partner.name}', 'recovered')">수금 등록</button>
          <button class="btn btn-warning" style="padding:4px 8px; font-size:0.75rem; background: #e67e22; border-color: #d35400; color: #fff;" onclick="editReceivablePayment('${partner.name}')">모든 항목 수정</button>
        </td>
      `;
      recBody.appendChild(row);
    }

    // 외상 매입 미지급금 집계
    if (partner.type === "매입처" || partner.type === "혼합") {
      const totalPurchases = (db.receivablesPayments[partner.name]?.totalPurchases !== undefined && db.receivablesPayments[partner.name]?.totalPurchases !== null)
        ? db.receivablesPayments[partner.name].totalPurchases
        : db.purchases
            .filter(p => p.partner === partner.name && p.status === STATUS_CREDIT)
            .reduce((sum, curr) => sum + curr.total, 0);

      const paid = db.receivablesPayments[partner.name]?.paid || 0;
      const balance = totalPurchases - paid;

      const row = document.createElement("tr");
      row.innerHTML = `
        <td><strong>${partner.name}</strong></td>
        <td>${formatNumber(totalPurchases)} 원</td>
        <td>${formatNumber(paid)} 원</td>
        <td style="color: var(--danger-color); font-weight: bold;">${formatNumber(balance)} 원</td>
        <td>
          <button class="btn btn-danger" style="padding:4px 8px; font-size:0.75rem;" onclick="payReceiveMoney('${partner.name}', 'paid')">지급 등록</button>
          <button class="btn btn-warning" style="padding:4px 8px; font-size:0.75rem; background: #e67e22; border-color: #d35400; color: #fff;" onclick="editReceivablePayment('${partner.name}')">모든 항목 수정</button>
        </td>
      `;
      payBody.appendChild(row);
    }
  });
}

window.payReceiveMoney = function(partnerName, mode) {
  const labelText = mode === 'recovered' ? '수금액' : '지급액';
  const amountStr = prompt(`${partnerName} 거래처의 추가 ${labelText}을 입력해 주세요. (원 단위 숫자만 입력)`);
  const amount = parseInt(amountStr);
  if (isNaN(amount) || amount <= 0) return;

  if(!db.receivablesPayments[partnerName]) {
    db.receivablesPayments[partnerName] = { recovered: 0, paid: 0, totalSales: null, totalPurchases: null };
  }
  
  db.receivablesPayments[partnerName][mode] += amount;
  saveDb();
  renderReceivablesAndPayables();
};

window.editReceivablePayment = function(partnerName) {
  if(!db.receivablesPayments[partnerName]) {
    db.receivablesPayments[partnerName] = { recovered: 0, paid: 0, totalSales: null, totalPurchases: null };
  }
  const rp = db.receivablesPayments[partnerName];
  
  const currentSales = (rp.totalSales !== undefined && rp.totalSales !== null)
    ? rp.totalSales
    : db.sales.filter(s => s.partner === partnerName && s.status === "청구(외상)").reduce((sum, curr) => sum + curr.total, 0);

  const currentPurchases = (rp.totalPurchases !== undefined && rp.totalPurchases !== null)
    ? rp.totalPurchases
    : db.purchases.filter(p => p.partner === partnerName && p.status === "청구(외상)").reduce((sum, curr) => sum + curr.total, 0);

  const salesStr = prompt(`[${partnerName}] 거래처의 총 외상 매출액을 설정해주세요. (현재: ${currentSales}원)`, currentSales);
  if (salesStr === null) return;
  const recStr = prompt(`[${partnerName}] 거래처의 총 수금 누계액을 설정해주세요. (현재: ${rp.recovered}원)`, rp.recovered);
  if (recStr === null) return;
  const purchasesStr = prompt(`[${partnerName}] 거래처의 총 외상 매입액을 설정해주세요. (현재: ${currentPurchases}원)`, currentPurchases);
  if (purchasesStr === null) return;
  const payStr = prompt(`[${partnerName}] 거래처의 총 지급 누계액을 설정해주세요. (현재: ${rp.paid}원)`, rp.paid);
  if (payStr === null) return;
  
  db.receivablesPayments[partnerName].totalSales = parseInt(salesStr) || 0;
  db.receivablesPayments[partnerName].recovered = parseInt(recStr) || 0;
  db.receivablesPayments[partnerName].totalPurchases = parseInt(purchasesStr) || 0;
  db.receivablesPayments[partnerName].paid = parseInt(payStr) || 0;
  
  saveDb();
  renderReceivablesAndPayables();
};

// --- 10. OCR 모의 스캔 핸들러 ---
const ocrDropzone = document.getElementById("ocr-dropzone");
const ocrFileInput = document.getElementById("ocr-file-input");
const ocrLoading = document.getElementById("ocr-loading");
const ocrPreviewContainer = document.getElementById("ocr-preview-container");
const ocrPreview = document.getElementById("ocr-preview");
const ocrRawText = document.getElementById("ocr-raw-text");

if (ocrDropzone) {
  ocrDropzone.onclick = () => ocrFileInput.click();
  ocrDropzone.ondragover = (e) => { e.preventDefault(); ocrDropzone.style.borderColor = "var(--primary-color)"; };
  ocrDropzone.ondragleave = () => { ocrDropzone.style.borderColor = "rgba(255,255,255,0.15)"; };
  ocrDropzone.ondrop = (e) => {
    e.preventDefault();
    if(e.dataTransfer.files.length > 0) handleOcrUpload(e.dataTransfer.files[0]);
  };
  ocrFileInput.onchange = (e) => {
    if(e.target.files.length > 0) handleOcrUpload(e.target.files[0]);
  };
}

// Tesseract.js 동적 로딩 프로미스
function loadTesseract() {
  return new Promise((resolve, reject) => {
    if (window.Tesseract) return resolve(window.Tesseract);
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
    script.onload = () => resolve(window.Tesseract);
    script.onerror = () => reject(new Error("Tesseract.js 로드에 실패했습니다."));
    document.head.appendChild(script);
  });
}

function handleOcrUpload(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    ocrPreview.src = e.target.result;
    ocrPreviewContainer.style.display = "block";
  };
  reader.readAsDataURL(file);

  ocrLoading.style.display = "block";
  ocrRawText.innerHTML = "<strong>OCR 분석 준비 중...</strong><br>텍스트 판독 라이브러리를 준비하고 있습니다.";
  
  loadTesseract().then(Tesseract => {
    ocrRawText.innerHTML = "<strong>이미지 텍스트 분석 중... (Tesseract OCR 작동)</strong><br>글자와 숫자 데이터를 추출하는 중입니다. 잠시만 기다려 주세요.";
    return Tesseract.recognize(
      file,
      'kor+eng',
      { logger: m => {
        if (m.status === 'recognizing') {
          ocrRawText.innerHTML = `<strong>이미지 분석 중... (${Math.round(m.progress * 100)}%)</strong><br>한글 및 숫자 텍스트 데이터를 분석하는 중입니다.`;
        }
      }}
    );
  }).then(({ data: { text } }) => {
    ocrLoading.style.display = "none";
    parseOcrText(text);
  }).catch(err => {
    console.error("OCR Failed:", err);
    ocrLoading.style.display = "none";
    fallbackToMock("OCR 텍스트 판독 실패 또는 네트워크 문제로 인해 샘플 예제 데이터를 대신 기입합니다.");
  });
}

function parseOcrText(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  // 1. 사업자번호 추출
  let bizNo = "";
  const bizNoRegex = /\d{3}-\d{2}-\d{5}/;
  for (const line of lines) {
    const match = line.match(bizNoRegex);
    if (match) {
      bizNo = match[0];
      break;
    }
  }
  
  // 2. 공급자 상호 추출
  let partnerName = "";
  for (const line of lines) {
    if (line.includes("상호") || line.includes("상 호") || line.includes("공급자") || line.includes("상호명")) {
      const clean = line.replace(/상호명|상호|상 호|공급자|공급원|[:(]/g, "").trim();
      const parts = clean.split(/\s+/);
      if (parts[0] && parts[0].length > 1) {
        partnerName = parts[0];
        break;
      }
    }
  }
  
  if (!partnerName) {
    for (let i = 0; i < Math.min(lines.length, 12); i++) {
      const line = lines[i];
      if (line.includes("주식회사") || line.includes("(주)") || line.includes("유통") || line.includes("상사") || line.includes("푸드") || line.includes("농산") || line.includes("수산")) {
        const match = line.match(/[가-힣A-Za-z0-9()]+/g);
        if (match) {
          partnerName = match.find(w => w.includes("주식회사") || w.includes("(주)") || w.includes("유통") || w.includes("상사") || w.includes("푸드") || w.includes("농산") || w.includes("수산")) || "";
          if (partnerName) break;
        }
      }
    }
  }
  
  if (!partnerName) {
    partnerName = "OCR 추출 거래처";
  }
  
  // 3. 거래일자 추출
  let invoiceDate = getKstTodayString();
  const dateRegex = /(\d{4})[-./년]\s*(\d{1,2})[-./월]\s*(\d{1,2})/;
  for (const line of lines) {
    const match = line.match(dateRegex);
    if (match) {
      const y = match[1];
      const m = match[2].padStart(2, '0');
      const d = match[3].padStart(2, '0');
      invoiceDate = `${y}-${m}-${d}`;
      break;
    }
  }
  
  // 4. 품목 파싱
  const parsedItems = [];
  const cleanNumber = (str) => parseInt(str.replace(/[^0-9]/g, ''), 10) || 0;
  const cleanFloat = (str) => parseFloat(str.replace(/[^0-9.]/g, '')) || 0;

  for (const line of lines) {
    if (line.length < 5) continue;
    if (line.includes("합계") || line.includes("합 계") || line.includes("공급가액") || line.includes("부가세") || line.includes("세액") || line.includes("소계")) {
      continue;
    }
    
    const tokens = line.split(/\s+/);
    if (tokens.length >= 3) {
      let hasAmount = false;
      let hasPrice = false;
      let hasQty = false;
      
      let amountVal = 0;
      let priceVal = 0;
      let qtyVal = 0;
      
      let tokenIdx = tokens.length - 1;
      
      const lastToken = tokens[tokenIdx];
      const cleanLast = lastToken.replace(/,/g, '');
      const lastVal = cleanNumber(lastToken);
      if (lastVal > 100 && /^\d+$/.test(cleanLast)) {
        amountVal = lastVal;
        hasAmount = true;
        tokenIdx--;
      }
      
      if (hasAmount && tokenIdx >= 0) {
        const priceToken = tokens[tokenIdx];
        const cleanPrice = priceToken.replace(/,/g, '');
        const pVal = cleanNumber(priceToken);
        if (pVal > 0 && /^\d+$/.test(cleanPrice)) {
          priceVal = pVal;
          hasPrice = true;
          tokenIdx--;
        }
      }
      
      if (hasPrice && tokenIdx >= 0) {
        const qtyToken = tokens[tokenIdx];
        const cleanQty = qtyToken.replace(/,/g, '');
        const qVal = cleanFloat(qtyToken);
        if (qVal > 0 && /^\d+(\.\d+)?$/.test(cleanQty)) {
          qtyVal = qVal;
          hasQty = true;
          tokenIdx--;
        }
      }
      
      // 대안 매칭 (수량 단가 금액 순서가 불규칙하거나 뭉쳐서 뽑혔을 때)
      if (!hasQty && tokens.length >= 3) {
        const numTokens = [];
        const numIndices = [];
        tokens.forEach((t, index) => {
          const cleanT = t.replace(/,/g, '');
          if (/^\d+(\.\d+)?$/.test(cleanT)) {
            numTokens.push(cleanT);
            numIndices.push(index);
          }
        });
        
        if (numTokens.length >= 2) {
          amountVal = cleanNumber(numTokens[numTokens.length - 1]);
          priceVal = cleanNumber(numTokens[numTokens.length - 2]);
          qtyVal = numTokens.length >= 3 ? cleanFloat(numTokens[numTokens.length - 3]) : Math.round(amountVal / (priceVal || 1));
          
          if (qtyVal > 0 && priceVal > 0) {
            hasAmount = true;
            hasPrice = true;
            hasQty = true;
            tokenIdx = numIndices[numIndices.length - (numTokens.length >= 3 ? 3 : 2)] - 1;
          }
        }
      }
      
      if (hasAmount && hasPrice && qtyVal > 0) {
        const nameTokens = tokens.slice(0, tokenIdx + 1);
        const name = nameTokens.join(" ").trim();
        if (name && name.length > 1 && !/^\d+$/.test(name)) {
          parsedItems.push({
            code: "OCR-" + Math.floor(Math.random() * 100000),
            name: name,
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
  
  if (parsedItems.length === 0) {
    fallbackToMock("이미지 분석을 완료했으나 명세표 품목 패턴을 발견하지 못해 샘플 데이터로 대체 기입합니다.");
    return;
  }
  
  window.currentOcrData = {
    bizNo: bizNo,
    partnerName: partnerName,
    invoiceDate: invoiceDate,
    items: parsedItems,
    rawText: text
  };
  
  window.openOcrCorrectionModal();
}

function fallbackToMock(reason) {
  console.warn("Fallback trigger:", reason);
  
  const partnerName = "씨제이프레시웨이주식회사";
  const mockOcrItems = [
    { code: "337940", name: "상하목장 요구르트(100ml_유기농 100g/EA)", qty: 190, price: 340, unit: "EA", origin: "국내산" },
    { code: "396562", name: "시투조아 카스테라단호박인절미", qty: 9, price: 14560, unit: "EA", origin: "국내산" },
    { code: "124171", name: "이츠웰 밀품은또띠아(6인치_12장 240g/EA)", qty: 42, price: 2750, unit: "EA", origin: "국내산" },
    { code: "429982", name: "켈로그 콘푸로스트(컵시리얼 40g/EA)", qty: 4, price: 15000, unit: "BOX", origin: "수입산" },
    { code: "163172", name: "이츠웰 사각어묵(740g 어묵_5무첨가 1Kg/EA)", qty: 3, price: 6200, unit: "EA", origin: "국내산" },
    { code: "466444", name: "이츠웰 스위트칠리소스", qty: 1, price: 9540, unit: "EA", origin: "국내산" }
  ];

  window.currentOcrData = {
    bizNo: "603-81-11270",
    partnerName: partnerName,
    invoiceDate: getKstTodayString(),
    items: mockOcrItems.map(item => ({
      code: item.code,
      name: item.name,
      qty: item.qty,
      price: item.price,
      amount: item.qty * item.price,
      unit: item.unit,
      origin: item.origin
    })),
    rawText: `[OCR 판독에 실패하여 예제 데이터가 로드되었습니다]\n사유: ${reason}\n\n씨제이프레시웨이주식회사\n603-81-11270\n대표자: 이경일\n상하목장 요구르트 190개 단가 340원 금액 64,600원\n시투조아 카스테라단호박인절미 9개 단가 14,560원 금액 131,040원\n이츠웰 밀품은또띠아 42개 단가 2,750원 금액 115,500원\n켈로그 콘푸로스트 4개 단가 15,000원 금액 60,000원\n이츠웰 사각어묵 3개 단가 6,200원 금액 18,600원\n이츠웰 스위트칠리소스 1개 단가 9,540원 금액 9,540원`
  };

  window.openOcrCorrectionModal();
}

// --- OCR 수동 교정 모달 핸들러 ---
window.openOcrCorrectionModal = function() {
  const modal = document.getElementById("ocr-correction-modal");
  if (!modal) return;
  
  document.getElementById("ocr-correct-raw").value = window.currentOcrData.rawText;
  document.getElementById("ocr-correct-partner").value = window.currentOcrData.partnerName;
  document.getElementById("ocr-correct-date").value = window.currentOcrData.invoiceDate;
  
  window.renderOcrCorrectionRows();
  
  modal.classList.add("active");
};

window.closeOcrCorrectionModal = function() {
  const modal = document.getElementById("ocr-correction-modal");
  if (modal) modal.classList.remove("active");
};

window.renderOcrCorrectionRows = function() {
  const tbody = document.getElementById("ocr-correct-rows");
  if (!tbody) return;
  tbody.innerHTML = "";
  
  window.currentOcrData.items.forEach((item, idx) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td style="padding: 6px; border-bottom: 1px solid rgba(255,255,255,0.05);">
        <input type="text" value="${escapeHtml(item.name)}" oninput="window.currentOcrData.items[${idx}].name = this.value" style="width: 100%; padding: 4px; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); color: #fff; border-radius: 4px;">
      </td>
      <td style="padding: 6px; border-bottom: 1px solid rgba(255,255,255,0.05); text-align: center;">
        <input type="number" value="${item.qty}" min="0.1" step="any" oninput="window.updateOcrRowNumeric(${idx}, 'qty', this.value)" style="width: 60px; padding: 4px; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); color: #fff; border-radius: 4px; text-align: center;">
      </td>
      <td style="padding: 6px; border-bottom: 1px solid rgba(255,255,255,0.05); text-align: right;">
        <input type="number" value="${item.price}" min="0" oninput="window.updateOcrRowNumeric(${idx}, 'price', this.value)" style="width: 80px; padding: 4px; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); color: #fff; border-radius: 4px; text-align: right;">
      </td>
      <td style="padding: 6px; border-bottom: 1px solid rgba(255,255,255,0.05); text-align: right; font-family: monospace;" id="ocr-correct-amount-${idx}">
        ${formatNumber(item.amount)}
      </td>
      <td style="padding: 6px; border-bottom: 1px solid rgba(255,255,255,0.05); text-align: center;">
        <button type="button" class="btn btn-danger" style="padding: 2px 6px; font-size: 0.7rem;" onclick="window.removeOcrCorrectionRow(${idx})">삭제</button>
      </td>
    `;
    tbody.appendChild(row);
  });
};

window.updateOcrRowNumeric = function(idx, key, val) {
  if (!window.currentOcrData || !window.currentOcrData.items[idx]) return;
  const num = key === 'qty' ? (parseFloat(val) || 0) : (parseInt(val, 10) || 0);
  window.currentOcrData.items[idx][key] = num;
  
  const amount = Math.floor(window.currentOcrData.items[idx].qty * window.currentOcrData.items[idx].price);
  window.currentOcrData.items[idx].amount = amount;
  
  const amountEl = document.getElementById(`ocr-correct-amount-${idx}`);
  if (amountEl) amountEl.textContent = formatNumber(amount);
};

window.addOcrCorrectionRow = function() {
  if (!window.currentOcrData) return;
  window.currentOcrData.items.push({
    code: "OCR-" + Math.floor(Math.random() * 100000),
    name: "새 품목",
    qty: 1,
    price: 0,
    amount: 0,
    unit: "EA",
    origin: "국내산"
  });
  window.renderOcrCorrectionRows();
};

window.removeOcrCorrectionRow = function(idx) {
  if (!window.currentOcrData || !window.currentOcrData.items[idx]) return;
  window.currentOcrData.items.splice(idx, 1);
  window.renderOcrCorrectionRows();
};

window.applyOcrCorrection = function() {
  if (!window.currentOcrData) return;
  
  const partnerName = document.getElementById("ocr-correct-partner").value.trim() || "OCR 추출 거래처";
  const invoiceDate = document.getElementById("ocr-correct-date").value || getKstTodayString();
  
  if (window.currentOcrData.items.length === 0) {
    alert("등록할 품목이 없습니다.");
    return;
  }
  
  let partnerMeta = db.partners.find(p => p.name === partnerName || (window.currentOcrData.bizNo && p.bizNo === window.currentOcrData.bizNo));
  let newPartnerRegistered = false;
  if (!partnerMeta) {
    partnerMeta = {
      code: "P-OCR-" + Date.now().toString().slice(-4),
      name: partnerName,
      owner: "대표자",
      bizNo: window.currentOcrData.bizNo || "000-00-00000",
      address: "OCR 자동 추출 주소",
      phone: "010-0000-0000",
      type: PARTNER_TYPE_PURCHASE
    };
    db.partners.push(partnerMeta);
    newPartnerRegistered = true;
  }
  
  purchaseCart = [];
  let registeredCount = 0;
  
  window.currentOcrData.items.forEach(item => {
    let prod = db.products.find(p => p.name === item.name);
    if (!prod) {
      prod = {
        code: "PRD-" + item.code,
        name: item.name,
        unit: item.unit || "EA",
        origin: item.origin || "국내산",
        purchasePrice: item.price,
        salesPrice: Math.floor(item.price * AUTO_MARKUP_MARGIN),
        taxType: TAX_TYPE_TAXABLE,
        stock: 0
      };
      db.products.push(prod);
      registeredCount++;
    }
    
    const amount = Math.floor(item.qty * item.price);
    purchaseCart.push({
      name: item.name,
      unit: prod.unit,
      origin: prod.origin,
      incomingDate: invoiceDate,
      qty: item.qty,
      price: item.price,
      amount: amount,
      tax: 0,
      total: amount,
      isTaxApplied: false,
      taxType: prod.taxType
    });
  });
  
  if (newPartnerRegistered || registeredCount > 0) {
    saveDb();
    renderProducts();
    renderPartners();
    renderSelectOptions();
  }
  
  renderPurCart();
  
  document.getElementById("pur-partner").value = partnerMeta.name;
  document.getElementById("pur-date").value = invoiceDate;
  if (document.getElementById("pur-item-incoming")) {
    document.getElementById("pur-item-incoming").value = invoiceDate;
  }
  
  const totalAmount = purchaseCart.reduce((sum, curr) => sum + curr.amount, 0);
  document.getElementById("pur-total-amount").value = totalAmount;
  document.getElementById("pur-total-tax").value = 0;
  document.getElementById("pur-total-sum").value = totalAmount;
  
  window.closeOcrCorrectionModal();
  
  let alertMsg = `매입 카트에 최종 반영되었습니다.\n공급자: ${partnerMeta.name}\n등록된 품목 수: ${window.currentOcrData.items.length}개`;
  if (newPartnerRegistered) {
    alertMsg += `\n- 신규 거래처 [${partnerMeta.name}]가 자동 등록되었습니다.`;
  }
  if (registeredCount > 0) {
    alertMsg += `\n- 신규 품목 ${registeredCount}건이 기초 상품 목록에 자동 등록되었습니다.`;
  }
  
  alert(alertMsg);
};

// --- 10.1 엑셀 발주서 일괄 업로드 파서 및 매출전표 생성 ---
let uploadedExcelRows = null;

// 엑셀에서 추출한 날짜를 'YYYY-MM-DD'로 안전하게 변환 (타임존 보정 및 문자열 패턴 처리)
function formatDateString(val) {
  if (val === null || val === undefined || val === "") return "";
  
  // 1. Date 객체인 경우 (타임존 시차 보정을 위해 12시간 더함)
  if (val instanceof Date) {
    const adjustedDate = new Date(val.getTime() + (12 * 60 * 60 * 1000));
    const y = adjustedDate.getFullYear();
    const m = String(adjustedDate.getMonth() + 1).padStart(2, '0');
    const d = String(adjustedDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  
  // 2. 엑셀 날짜 시리얼 숫자 번호인 경우
  if (typeof val === 'number') {
    let serial = val;
    if (serial > 60) serial -= 1; // 1900년 윤년 버그 보정
    const date = new Date((serial - 25568) * 86400 * 1000);
    const adjustedDate = new Date(date.getTime() + (12 * 60 * 60 * 1000));
    const y = adjustedDate.getFullYear();
    const m = String(adjustedDate.getMonth() + 1).padStart(2, '0');
    const d = String(adjustedDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  
  // 3. 문자열 날짜 포맷 정규화
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
    
    // YYYY-MM-DD 포맷과 근접한 경우
    const match = val.replace(/[\/\.]/g, '-').trim();
    if (match.match(/^\d{4}-\d{2}-\d{2}/)) {
      return match.substring(0, 10);
    }
  }
  
  return String(val).trim();
}

// 엑셀 로우 객체에서 다양한 키 바리에이션을 허용하여 데이터를 가져오는 헬퍼 함수
function getExcelRowValue(row, possibleKeys) {
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
}

// 학교명 및 거래처 핵심 이름 추출 헬퍼 (매칭 유연성 극대화)
function getCorePartnerName(name) {
  if (!name) return "";
  return String(name)
    .replace(/\s+/g, "") // 모든 공백 제거
    .replace(/\(매출처\)|\(매입처\)|\(혼합\)/gi, "") // 괄호 용어 제거
    .replace(/(초등학교|중학교|고등학교|유치원|학교|초등|중교|고교|초)/gi, "") // 학교 접미사 제거
    .split(" (")[0]
    .trim();
}

window.loadItemsFromExcel = function(force = false) {
  if (!uploadedExcelRows) return;
  if (editingSalesId !== null && !force) {
    return;
  }
  if (editingSalesId !== null && force) {
    if (!confirm("현재 매출 전표를 수정 중입니다. 엑셀의 품목으로 장바구니를 덮어쓰시겠습니까?")) {
      return;
    }
  }

  const dateEl = document.getElementById("sales-date");
  const partnerEl = document.getElementById("sales-partner");
  if (!dateEl || !partnerEl) return;

  const targetDate = dateEl.value;
  const targetPartner = partnerEl.value;

  if (!targetDate || !targetPartner) return;

  // 매출처명 핵심 이름 추출 (예: "남호초등학교" -> "남호")
  const cleanPartnerName = getCorePartnerName(targetPartner);

  // 매칭 행 필터링
  const matchingRows = uploadedExcelRows.filter(row => {
    const partnerKeys = ['학교', '거래처', '거래처명', '납품처', '바이어', '매출처', '수신', '상호명'];
    const partnerVal = getExcelRowValue(row, partnerKeys) || "";
    const cleanRowPartner = getCorePartnerName(partnerVal);
    if (!cleanRowPartner) return false;

    const dateKeys = ['납품일자', '입고일', '납품기한', '일자', '날짜', '매출일자', '배송일'];
    const dateVal = getExcelRowValue(row, dateKeys) || "";
    const formattedRowDate = formatDateString(dateVal);

    // 핵심 상호명이 서로 포함관계인지 체크 (예: "남호" === "남호")
    const partnerMatches = cleanRowPartner.includes(cleanPartnerName) || cleanPartnerName.includes(cleanRowPartner);
    const dateMatches = formattedRowDate === targetDate;

    return partnerMatches && dateMatches;
  });

  const statusEl = document.getElementById("excel-upload-status");
  if (matchingRows.length === 0) {
    if (statusEl) {
      statusEl.textContent = `엑셀 로드됨 (선택 일자/매출처의 매칭 데이터 없음)`;
      statusEl.style.color = "var(--text-muted)";
    }
    return;
  }

  // 장바구니 품목 채우기
  salesCart = [];
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

    const prodMeta = db.products.find(p => p.name.includes(rawProdName) || rawProdName.includes(p.name)) || {
      name: rawProdName,
      unit: unit || "BOX",
      origin: "국내산",
      taxType: TAX_TYPE_TAXABLE
    };

    const amount = Math.floor(qty * price);
    const isTaxable = prodMeta.taxType !== TAX_TYPE_EXEMPT;
    const tax = isSalesTaxApplied && isTaxable ? Math.floor(amount * TAX_RATE) : 0;
    const total = amount + tax;

    salesCart.push({
      name: sanitizeExcelUnitAndName(prodMeta.name),
      unit: unit || sanitizeExcelUnitAndName(prodMeta.unit) || "BOX",
      origin: prodMeta.origin || "국내산",
      incomingDate: targetDate,
      qty: qty,
      price: price || prodMeta.salesPrice || 0,
      amount: amount,
      tax: tax,
      total: total,
      isTaxApplied: false
    });
  });

  renderSalesCart();
  
  if (statusEl) {
    statusEl.textContent = `엑셀에서 ${salesCart.length}건 품목 로드 완료`;
    statusEl.style.color = "var(--success-color)";
  }
};



// --- 11. 시스템 설정 및 단축키 핸들링 ---
const formPrint = document.getElementById("form-print-settings");
if (formPrint) {
  document.getElementById("setting-paper-size").value = db.settings.paperSize;
  document.getElementById("setting-margin-top").value = db.settings.marginTop;
  document.getElementById("setting-margin-left").value = db.settings.marginLeft;
  document.getElementById("setting-font-size").value = db.settings.fontSize;

  const updateSealPreview = () => {
    const placeholder = document.getElementById("print-seal-preview-placeholder");
    const img = document.getElementById("print-seal-preview-img");
    const deleteBtn = document.getElementById("btn-delete-print-seal");
    if (db.settings.printSealImage) {
      if (placeholder) placeholder.style.display = "none";
      if (img) {
        img.src = db.settings.printSealImage;
        img.style.display = "block";
      }
      if (deleteBtn) deleteBtn.style.display = "inline-block";
    } else {
      if (placeholder) placeholder.style.display = "block";
      if (img) {
        img.src = "";
        img.style.display = "none";
      }
      if (deleteBtn) deleteBtn.style.display = "none";
    }
  };

  updateSealPreview();

  const fileInput = document.getElementById("setting-print-seal-image");
  if (fileInput) {
    fileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        db.settings.printSealImage = evt.target.result;
        saveDb();
        updateSealPreview();
      };
      reader.readAsDataURL(file);
    });
  }

  const deleteBtn = document.getElementById("btn-delete-print-seal");
  if (deleteBtn) {
    deleteBtn.addEventListener("click", () => {
      db.settings.printSealImage = "";
      if (fileInput) fileInput.value = "";
      saveDb();
      updateSealPreview();
    });
  }

  formPrint.onsubmit = (e) => {
    e.preventDefault();
    db.settings.paperSize = document.getElementById("setting-paper-size").value;
    db.settings.marginTop = parseInt(document.getElementById("setting-margin-top").value) || 0;
    db.settings.marginLeft = parseInt(document.getElementById("setting-margin-left").value) || 0;
    db.settings.fontSize = parseInt(document.getElementById("setting-font-size").value) || 10;
    saveDb();
    alert("인쇄 설정 및 대표자 직인 이미지가 저장되었습니다.");
  };
}

const formTemplate = document.getElementById("form-template-settings");
if (formTemplate) {
  document.getElementById("setting-logo-text").value = db.settings.logoText;
  document.getElementById("setting-hk-f2").value = db.settings.hkF2;
  document.getElementById("setting-hk-f4").value = db.settings.hkF4;
  document.getElementById("setting-hk-f7").value = db.settings.hkF7;
  document.getElementById("setting-hk-f8").value = db.settings.hkF8;
  document.getElementById("setting-hk-f9").value = db.settings.hkF9;

  formTemplate.onsubmit = (e) => {
    e.preventDefault();
    db.settings.logoText = document.getElementById("setting-logo-text").value;
    db.settings.hkF2 = document.getElementById("setting-hk-f2").value;
    db.settings.hkF4 = document.getElementById("setting-hk-f4").value;
    db.settings.hkF7 = document.getElementById("setting-hk-f7").value;
    db.settings.hkF8 = document.getElementById("setting-hk-f8").value;
    db.settings.hkF9 = document.getElementById("setting-hk-f9").value;
    saveDb();
    alert("템플릿 정보 및 전역 단축버튼 지정이 완료되었습니다.");
  };
}

// 라벨 디자인 설정 폼 연동
const formLabel = document.getElementById("form-label-settings");
if (formLabel) {
  document.getElementById("setting-lbl-font-title").value = db.settings.labelFonts.title;
  document.getElementById("setting-lbl-font-product").value = db.settings.labelFonts.product;
  document.getElementById("setting-lbl-font-origin").value = db.settings.labelFonts.origin;
  document.getElementById("setting-lbl-font-weight").value = db.settings.labelFonts.weight;
  document.getElementById("setting-lbl-font-supplier").value = db.settings.labelFonts.supplier;
  document.getElementById("setting-lbl-font-date").value = db.settings.labelFonts.date;

  const presetEl = document.getElementById("setting-lbl-size-preset");
  const widthEl = document.getElementById("setting-lbl-width");
  const heightEl = document.getElementById("setting-lbl-height");
  if (presetEl && widthEl && heightEl) {
    presetEl.value = db.settings.labelPreset || "60x60";
    widthEl.value = db.settings.labelWidth || 60;
    heightEl.value = db.settings.labelHeight || 60;
    
    if (presetEl.value !== "custom") {
      widthEl.disabled = true;
      heightEl.disabled = true;
    } else {
      widthEl.disabled = false;
      heightEl.disabled = false;
    }
  }

  formLabel.onsubmit = (e) => {
    e.preventDefault();
    db.settings.labelFonts = {
      title: parseFloat(document.getElementById("setting-lbl-font-title").value) || 22,
      product: parseFloat(document.getElementById("setting-lbl-font-product").value) || 22,
      origin: parseFloat(document.getElementById("setting-lbl-font-origin").value) || 18,
      weight: parseFloat(document.getElementById("setting-lbl-font-weight").value) || 28,
      supplier: parseFloat(document.getElementById("setting-lbl-font-supplier").value) || 10.5,
      date: parseFloat(document.getElementById("setting-lbl-font-date").value) || 23
    };
    db.settings.labelPreset = document.getElementById("setting-lbl-size-preset").value;
    db.settings.labelWidth = parseFloat(document.getElementById("setting-lbl-width").value) || 60;
    db.settings.labelHeight = parseFloat(document.getElementById("setting-lbl-height").value) || 60;

    saveDb();
    alert("라벨 스티커 디자인 및 프린터 설정이 저장되었습니다.");
  };
}

// 라벨 프리셋 변경 핸들러
window.handleLabelPresetChange = function(presetValue) {
  const widthEl = document.getElementById("setting-lbl-width");
  const heightEl = document.getElementById("setting-lbl-height");
  if (!widthEl || !heightEl) return;
  
  if (presetValue === "custom") {
    widthEl.disabled = false;
    heightEl.disabled = false;
    return;
  }
  
  widthEl.disabled = true;
  heightEl.disabled = true;
  
  const specs = {
    "60x60": { w: 60, h: 60, title: 22, product: 22, origin: 18, weight: 28, supplier: 10.5, date: 23 },
    "80x80": { w: 80, h: 80, title: 28, product: 28, origin: 22, weight: 36, supplier: 14, date: 28 },
    "100x100": { w: 100, h: 100, title: 36, product: 36, origin: 28, weight: 46, supplier: 18, date: 36 },
    "100x60": { w: 100, h: 60, title: 26, product: 24, origin: 18, weight: 32, supplier: 12, date: 24 },
    "40x30": { w: 40, h: 30, title: 14, product: 12, origin: 10, weight: 18, supplier: 8, date: 12 }
  };
  
  const spec = specs[presetValue];
  if (spec) {
    widthEl.value = spec.w;
    heightEl.value = spec.h;
    
    document.getElementById("setting-lbl-font-title").value = spec.title;
    document.getElementById("setting-lbl-font-product").value = spec.product;
    document.getElementById("setting-lbl-font-origin").value = spec.origin;
    document.getElementById("setting-lbl-font-weight").value = spec.weight;
    document.getElementById("setting-lbl-font-supplier").value = spec.supplier;
    document.getElementById("setting-lbl-font-date").value = spec.date;
  }
};

// 라벨 테스트 인쇄 핸들러
window.printLabelTest = function() {
  const testSale = {
    id: "TEST-" + Date.now().toString().slice(-4),
    partner: "원주초등학교 (테스트)",
    date: new Date().toISOString().split("T")[0],
    items: [
      {
        name: "친환경 방울토마토 (5kg/BOX)",
        origin: "국내산 (강원도)",
        qty: 1,
        unit: "BOX",
        price: 25000,
        amount: 25000,
        tax: 0,
        total: 25000
      }
    ]
  };
  triggerLabelPrintDoc(testSale);
};

// 키보드 단축키 감지 (F2, F4, F7, F8, F9 커스텀 단축키 포함)
window.addEventListener("keydown", (e) => {
  let targetTab = "";
  if (e.key === "F2") {
    e.preventDefault();
    targetTab = db.settings.hkF2;
  } else if (e.key === "F4") {
    e.preventDefault();
    if(db.settings.hkF4 === 'save') {
      saveDb();
      alert("단축키 [F4] 트리거: 시스템의 모든 로컬 원장을 동기화 완료하였습니다.");
      return;
    } else {
      targetTab = "dashboard";
    }
  } else if (e.key === "F7") {
    e.preventDefault();
    targetTab = db.settings.hkF7;
  } else if (e.key === "F8") {
    e.preventDefault();
    targetTab = db.settings.hkF8;
  } else if (e.key === "F9") {
    e.preventDefault();
    const action = db.settings.hkF9;
    if(action === 'excel-import') {
      const tabItem = document.querySelector(`.menu-item[data-tab='sales']`);
      if(tabItem) tabItem.click();
      setTimeout(() => document.getElementById("sales-excel-file").click(), 200);
      return;
    } else if(action === 'ocr-scan') {
      const tabItem = document.querySelector(`.menu-item[data-tab='purchase']`);
      if(tabItem) tabItem.click();
      setTimeout(() => document.getElementById("ocr-file-input").click(), 200);
      return;
    }
  }

  if (targetTab !== "") {
    const menuItem = document.querySelector(`.menu-item[data-tab='${targetTab}']`);
    if(menuItem) menuItem.click();
  }
});

// --- 12. 자료관리 백업/복구 (자료관리.png) ---
const btnExport = document.getElementById("btn-db-export");
if (btnExport) {
  btnExport.addEventListener("click", () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(db));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `SmartERP_DB_Backup_${getKstTodayString()}.json`);
    dlAnchorElem.click();
  });
}

const btnImportTrigger = document.getElementById("btn-db-import-trigger");
const dbImportFile = document.getElementById("db-import-file");
if (btnImportTrigger && dbImportFile) {
  btnImportTrigger.onclick = () => dbImportFile.click();
  dbImportFile.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const importedData = JSON.parse(evt.target.result);
        if (importedData.headquarters && importedData.partners && importedData.products) {
          db = importedData;
          saveDb();
          alert("성공적으로 데이터베이스 백업본으로부터 ERP 정보를 완벽 복원했습니다.");
          location.reload();
        } else {
          alert("올바른 ERP 백업 파일 형식이 아닙니다.");
        }
      } catch (err) {
        alert("JSON 파싱 에러: 백업 파일 구조를 복원할 수 없습니다.");
      }
    };
    reader.readAsText(file);
  };
}

const btnDbReset = document.getElementById("btn-db-reset");
if (btnDbReset) {
  btnDbReset.addEventListener("click", () => {
    if (confirm("정말로 모든 ERP 데이터베이스를 초기화하고 실무용 새 장부로 개시하시겠습니까?\n저장되어 있던 전표, 거래처, 품목 정보가 영구히 지워집니다.\n(경고: 진행 전 우측의 'PC로 DB 백업본 다운로드'를 통해 백업 파일을 확보해 두십시오.)")) {
      const uniqueHqId = "hq" + Date.now();
      const emptyDb = {
        headquarters: [
          { id: uniqueHqId, name: "우리회사 본사", regNo: "000-00-00000", owner: "대표자명", address: "회사 주소 입력", business: "업태 / 종목" }
        ],
        activeHqId: uniqueHqId,
        employees: [],
        banks: [],
        partners: [],
        products: [],
        purchases: [],
        sales: [],
        settings: {
          paperSize: "A4",
          marginTop: 15,
          marginLeft: 15,
          fontSize: 10,
          logoText: "[공급자 보관용]",
          hkF2: "sales",
          hkF4: "save",
          hkF7: "purchase",
          hkF8: "receivables",
          hkF9: "excel-import"
        },
        receivablesPayments: {},
        estimates: []
      };
      db = emptyDb;
      localStorage.setItem("erp_db_pro", JSON.stringify(db));
      alert("데이터베이스 초기화 완료! 실무 거래 기록을 시작할 수 있습니다.");
      location.reload();
    }
  });
}

// --- 통합 발주 데이터 캐시 객체 ---
window.lastUploadedOrderData = null;
window.uploadedSchoolFiles = db.uploadedSchoolFiles || [];

// --- 개별 학교 발주 파일 비동기 로드 프로미스 ---
function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(new Uint8Array(e.target.result));
    reader.onerror = (e) => reject(e);
    reader.readAsArrayBuffer(file);
  });
}

// --- 업로드된 학교별 발주 파일 목록 취합 및 통합 데이터 생성 ---
function processUploadedSchoolFiles() {
  const fileListEl = document.getElementById("order-sheet-file-list");
  
  if (fileListEl) {
    fileListEl.innerHTML = "";
    (window.uploadedSchoolFiles || []).forEach((fileObj, idx) => {
      const chip = document.createElement("div");
      chip.className = "order-file-chip";
      chip.innerHTML = `
        <span>${escapeHtml(fileObj.school)} (${escapeHtml(fileObj.fileName)})</span>
        <div class="remove-btn" data-index="${idx}">&times;</div>
      `;
      chip.querySelector(".remove-btn").addEventListener("click", (e) => {
        const removeIdx = parseInt(e.target.getAttribute("data-index"));
        window.uploadedSchoolFiles.splice(removeIdx, 1);
        db.uploadedSchoolFiles = window.uploadedSchoolFiles;
        saveDb();
        processUploadedSchoolFiles();
      });
      fileListEl.appendChild(chip);
    });
  }
  
  const mergedRows = [];
  (window.uploadedSchoolFiles || []).forEach(fileObj => {
    mergedRows.push(...fileObj.rows);
  });
  
  // 3중 기본 정렬 적용:
  // 1순위 납품일자(오름차순)
  // 2순위 학교(오름차순, 가나다순)
  // 3순위 품목(오름차순, ㄱ~ㅎ순)
  mergedRows.sort((a, b) => {
    const dateA = a.date || "";
    const dateB = b.date || "";
    if (dateA !== dateB) {
      return dateA.localeCompare(dateB);
    }
    const schoolA = a.school || "";
    const schoolB = b.school || "";
    if (schoolA !== schoolB) {
      return schoolA.localeCompare(schoolB, "ko");
    }
    const productA = a.product || "";
    const productB = b.product || "";
    return productA.localeCompare(productB, "ko");
  });
  
  if (mergedRows.length === 0) {
    window.lastUploadedOrderData = null;
    renderOrderSheetData();
    return;
  }
  
  const dates = [...new Set(mergedRows.map(r => r.date))].sort();
  const uniqueSchools = [...new Set(mergedRows.map(r => r.school))].sort();
  
  const productSummaryMap = {};
  mergedRows.forEach(r => {
    const key = `${r.product}||${r.spec || ""}`;
    if (!productSummaryMap[key]) {
      productSummaryMap[key] = {
        '품목': r.product,
        '규격/단위': r.spec || "",
        '총합계수량': 0
      };
      uniqueSchools.forEach(sch => {
        productSummaryMap[key][sch] = 0;
      });
    }
    productSummaryMap[key][r.school] += r.qty;
    productSummaryMap[key]['총합계수량'] += r.qty;
  });
  
  const summaryHeaders = ['품목', '규격/단위', ...uniqueSchools, '총합계수량'];
  const summaryRows = Object.values(productSummaryMap).sort((a, b) => a['품목'].localeCompare(b['품목']));
  
  window.lastUploadedOrderData = {
    fileName: `${window.uploadedSchoolFiles.length}개 학교 통합`,
    rawRows: mergedRows,
    dates: dates,
    summaryHeaders: summaryHeaders,
    summaryRows: summaryRows
  };
  
  renderOrderSheetData();
}

// --- 통합 발주 상세 테이블 필터 상태 ---
window.orderSheetFilters = {
  date: null,
  school: null,
  product: null,
  spec: null,
  qty: null,
  price: null,
  amount: null,
  status: null
};
window.currentFilteringColumn = "";

// --- 필터링 상태 적용된 현재 활성 행 목록 반환 ---
// --- 필터링 상태 적용된 현재 활성 행 목록 반환 ---
function getFilteredOrderRows() {
  if (!window.lastUploadedOrderData) return [];
  
  return window.lastUploadedOrderData.rawRows.filter(row => {
    const amt = Math.round(row.qty * row.price);
    const st = row.status || "대기";
    
    const match = (colKey, val) => {
      const filterVals = window.orderSheetFilters[colKey];
      if (filterVals === null || filterVals === undefined) return true;
      return filterVals.includes(String(val).trim());
    };
    
    return (
      match('date', row.date) &&
      match('school', row.school) &&
      match('product', row.product) &&
      match('spec', row.spec) &&
      match('qty', row.qty) &&
      match('price', row.price) &&
      match('amount', amt) &&
      match('status', st)
    );
  });
}

// --- 통합 발주표 데이터 테이블 렌더링 ---
function renderOrderSheetData() {
  const container = document.getElementById("order-sheet-data-container");
  const tableRows = document.getElementById("order-sheet-table-rows");
  const tableInfo = document.getElementById("order-sheet-table-info");
  
  if (!window.lastUploadedOrderData) {
    if (container) container.style.display = "none";
    return;
  }
  
  if (container) container.style.display = "block";
  
  const filteredRows = getFilteredOrderRows();
  
  const totalLoad = window.lastUploadedOrderData.rawRows.length;
  const totalFiltered = filteredRows.length;
  const grandTotalAmount = filteredRows.reduce((sum, r) => sum + Math.round(r.qty * r.price), 0);
  
  if (tableInfo) {
    tableInfo.innerHTML = `로드 수: <strong>${totalLoad}</strong>행 | 필터링: <strong>${totalFiltered}</strong>행 | 합계 금액: <strong>${grandTotalAmount.toLocaleString()}</strong>원`;
  }
  
  let html = "";
  if (filteredRows.length === 0) {
    html = `<tr><td colspan="9" style="padding: 30px; color: rgba(255,255,255,0.4);">조건을 만족하는 발주 내역이 없습니다.</td></tr>`;
  } else {
    filteredRows.forEach(r => {
      const rawIdx = window.lastUploadedOrderData.rawRows.indexOf(r);
      const amt = Math.round(r.qty * r.price);
      const st = r.status || "대기";
      
      let rowClass = "";
      if (st === "취소") {
        rowClass = "row-status-cancelled";
      } else if (st === "변경" || st === "추가") {
        rowClass = "row-status-highlight-blue";
      }
      
      const hasDesc = r.desc && r.desc.trim().length > 0;
      const tooltipHtml = hasDesc 
        ? `<span class="tooltip-text">${escapeHtml(r.desc)}</span>` 
        : "";
      const tdClass = hasDesc ? "tooltip-cell" : "";
      
      html += `<tr class="${rowClass}" data-raw-idx="${rawIdx}">`;
      html += `<td style="padding: 6px;"><button type="button" class="btn-row-add-inline inline-row-add" title="아래에 행 추가"><i data-lucide="plus" style="width: 12px; height: 12px; vertical-align: middle;"></i></button></td>`;
      html += `<td><input type="text" class="inline-edit-input inline-date" value="${escapeHtml(r.date)}"></td>`;
      html += `<td><input type="text" class="inline-edit-input inline-school" style="text-align: left;" value="${escapeHtml(r.school)}"></td>`;
      html += `<td style="position: relative;" class="${tdClass}">
                <input type="text" class="inline-edit-input inline-product" style="text-align: left; font-weight: 600;" value="${escapeHtml(r.product)}">
                ${tooltipHtml}
               </td>`;
      html += `<td><input type="text" class="inline-edit-input inline-spec" value="${escapeHtml(r.spec)}"></td>`;
      html += `<td><input type="number" step="any" class="inline-edit-input inline-qty" style="text-align: right; font-weight: bold;" value="${r.qty}"></td>`;
      html += `<td><input type="number" class="inline-edit-input inline-price" style="text-align: right;" value="${r.price}"></td>`;
      html += `<td style="text-align: right; font-weight: bold; color: var(--primary-color);" class="inline-amount">${amt.toLocaleString()}</td>`;
      html += `<td>
                <select class="inline-edit-select inline-status">
                  <option value="대기" ${st === "대기" ? "selected" : ""}>대기</option>
                  <option value="이관 완료" ${st === "이관 완료" ? "selected" : ""}>이관 완료</option>
                  <option value="취소" ${st === "취소" ? "selected" : ""}>취소</option>
                  <option value="변경" ${st === "변경" ? "selected" : ""}>변경</option>
                  <option value="추가" ${st === "추가" ? "selected" : ""}>추가</option>
                </select>
               </td>`;
      html += `</tr>`;
    });
  }
  
  if (tableRows) {
    tableRows.innerHTML = html;
    if (window.lucide) window.lucide.createIcons();
  }
  
  const headers = document.querySelectorAll("#order-sheet-data-table th[data-col]");
  headers.forEach(th => {
    const col = th.getAttribute("data-col");
    if (window.orderSheetFilters[col] !== null && window.orderSheetFilters[col] !== undefined) {
      th.classList.add("filter-active");
    } else {
      th.classList.remove("filter-active");
    }
  });
  
  // 테이블 내 인라인 편집 이벤트 위임 등록
  if (!window.orderSheetTableEventsBound) {
    const tbody = document.getElementById("order-sheet-table-rows");
    if (tbody) {
      tbody.addEventListener("input", (e) => {
        const tr = e.target.closest("tr");
        if (!tr) return;
        const rawIdx = parseInt(tr.getAttribute("data-raw-idx"));
        const rowData = window.lastUploadedOrderData?.rawRows[rawIdx];
        if (!rowData) return;
        
        if (e.target.classList.contains("inline-date")) {
          rowData.date = e.target.value;
        } else if (e.target.classList.contains("inline-school")) {
          rowData.school = e.target.value;
        } else if (e.target.classList.contains("inline-product")) {
          rowData.product = e.target.value;
        } else if (e.target.classList.contains("inline-spec")) {
          rowData.spec = e.target.value;
        } else if (e.target.classList.contains("inline-qty")) {
          rowData.qty = parseFloat(e.target.value) || 0;
          const price = rowData.price || 0;
          const amtEl = tr.querySelector(".inline-amount");
          if (amtEl) amtEl.textContent = Math.round(rowData.qty * price).toLocaleString();
        } else if (e.target.classList.contains("inline-price")) {
          rowData.price = parseFloat(e.target.value) || 0;
          const qty = rowData.qty || 0;
          const amtEl = tr.querySelector(".inline-amount");
          if (amtEl) amtEl.textContent = Math.round(qty * rowData.price).toLocaleString();
        }
      });
      
      tbody.addEventListener("change", (e) => {
        const tr = e.target.closest("tr");
        if (!tr) return;
        const rawIdx = parseInt(tr.getAttribute("data-raw-idx"));
        const rowData = window.lastUploadedOrderData?.rawRows[rawIdx];
        if (!rowData) return;
        
        if (e.target.classList.contains("inline-status")) {
          rowData.status = e.target.value;
          tr.className = "";
          if (rowData.status === "취소") {
            tr.className = "row-status-cancelled";
          } else if (rowData.status === "변경" || rowData.status === "추가") {
            tr.className = "row-status-highlight-blue";
          }
        }
        
        db.uploadedSchoolFiles = window.uploadedSchoolFiles;
        saveDb();
        recalculateOrderSheetStats();
      });
      
      tbody.addEventListener("click", (e) => {
        const btn = e.target.closest(".inline-row-add");
        if (!btn) return;
        
        const tr = btn.closest("tr");
        if (!tr) return;
        
        const rawIdx = parseInt(tr.getAttribute("data-raw-idx"));
        const currentRow = window.lastUploadedOrderData?.rawRows[rawIdx];
        if (!currentRow) return;
        
        // 클릭한 행의 납품일자, 학교명을 복사하여 편의성 제공
        const newRow = {
          date: currentRow.date,
          school: currentRow.school,
          product: "",
          spec: "",
          qty: 0,
          price: 0,
          status: "추가",
          desc: ""
        };
        
        // 원본 배열(window.uploadedSchoolFiles)에서 해당 행 바로 다음에 새 행 삽입
        let inserted = false;
        for (const fileObj of window.uploadedSchoolFiles) {
          const idxInFile = fileObj.rows.indexOf(currentRow);
          if (idxInFile !== -1) {
            fileObj.rows.splice(idxInFile + 1, 0, newRow);
            inserted = true;
            break;
          }
        }
        
        if (!inserted) {
          if (window.uploadedSchoolFiles.length === 0) {
            window.uploadedSchoolFiles = [{
              fileName: "수동 등록 발주표",
              school: "수동 등록",
              rows: []
            }];
          }
          window.uploadedSchoolFiles[0].rows.push(newRow);
        }
        
        db.uploadedSchoolFiles = window.uploadedSchoolFiles;
        saveDb();
        
        // 취합 및 리렌더링
        processUploadedSchoolFiles();
        
        // 삽입된 행의 품목명 입력란으로 자동 포커스 이동
        setTimeout(() => {
          const nextTr = document.getElementById("order-sheet-table-rows").querySelector(`tr[data-raw-idx="${rawIdx + 1}"]`);
          if (nextTr) {
            const input = nextTr.querySelector(".inline-product");
            if (input) input.focus();
          }
        }, 50);
      });
      
      window.orderSheetTableEventsBound = true;
    }
  }
}

// --- 통합 발주표 합계 및 수량 통계 재계산 ---
function recalculateOrderSheetStats() {
  if (!window.lastUploadedOrderData) return;
  const filteredRows = getFilteredOrderRows();
  const totalLoad = window.lastUploadedOrderData.rawRows.length;
  const totalFiltered = filteredRows.length;
  const grandTotalAmount = filteredRows.reduce((sum, r) => sum + Math.round(r.qty * r.price), 0);
  
  const tableInfo = document.getElementById("order-sheet-table-info");
  if (tableInfo) {
    tableInfo.innerHTML = `로드 수: <strong>${totalLoad}</strong>행 | 필터링: <strong>${totalFiltered}</strong>행 | 합계 금액: <strong>${grandTotalAmount.toLocaleString()}</strong>원`;
  }
}

// --- 헤더 필터 시스템 셋업 및 동작 ---
function setupOrderSheetFilters() {
  const table = document.getElementById("order-sheet-data-table");
  const popover = document.getElementById("order-sheet-filter-popover");
  if (!table || !popover) return;
  
  const headers = table.querySelectorAll("th[data-col]");
  headers.forEach(th => {
    th.addEventListener("click", (e) => {
      e.stopPropagation();
      const col = th.getAttribute("data-col");
      window.currentFilteringColumn = col;
      
      const titleEl = document.getElementById("filter-popover-title");
      if (titleEl) {
        const colNames = {
          date: "납품일자",
          school: "학교명",
          product: "품목명",
          spec: "규격/단위",
          qty: "수량",
          price: "단가(원)",
          amount: "금액(원)",
          status: "상태"
        };
        titleEl.textContent = `${colNames[col] || col} 필터`;
      }
      
      const allRows = window.lastUploadedOrderData ? window.lastUploadedOrderData.rawRows : [];
      const uniqueVals = new Set();
      allRows.forEach(row => {
        let val = "";
        if (col === "amount") {
          val = String(Math.round(row.qty * row.price));
        } else if (col === "status") {
          val = row.status || "대기";
        } else {
          val = String(row[col] || "");
        }
        uniqueVals.add(val.trim());
      });
      
      const sortedVals = [...uniqueVals].sort((a, b) => {
        if (!isNaN(a) && !isNaN(b)) return Number(a) - Number(b);
        return a.localeCompare(b);
      });
      
      const optionsContainer = document.getElementById("filter-popover-options");
      if (optionsContainer) {
        optionsContainer.innerHTML = "";
        const activeFilters = window.orderSheetFilters[col];
        
        sortedVals.forEach(val => {
          const isChecked = (activeFilters === null || activeFilters === undefined) ? true : activeFilters.includes(val);
          const label = document.createElement("label");
          
          let displayVal = val;
          if (col === "amount" || col === "price") {
            displayVal = Number(val).toLocaleString() + "원";
          }
          
          label.innerHTML = `
            <input type="checkbox" value="${escapeHtml(val)}" ${isChecked ? "checked" : ""}>
            <span>${escapeHtml(displayVal)}</span>
          `;
          optionsContainer.appendChild(label);
        });
      }
      
      // 검색 입력창 리셋 및 실시간 항목 매칭 연결
      const searchInput = document.getElementById("filter-popover-search");
      if (searchInput) {
        searchInput.value = "";
        searchInput.oninput = (e) => {
          const text = e.target.value.toLowerCase().trim();
          const labels = optionsContainer.querySelectorAll("label");
          labels.forEach(label => {
            const span = label.querySelector("span");
            if (span) {
              const labelText = span.textContent.toLowerCase();
              if (labelText.includes(text)) {
                label.style.display = "flex";
              } else {
                label.style.display = "none";
              }
            }
          });
        };
      }
      
      const rect = th.getBoundingClientRect();
      const parentContainer = document.getElementById("order-sheet-data-container");
      const parentRect = parentContainer.getBoundingClientRect();
      
      let leftPos = rect.left - parentRect.left;
      const topPos = rect.bottom - parentRect.top;
      
      // 가로축 화면 밖으로 탈출 방지용 오프셋 보정
      const popoverWidth = 220;
      if (leftPos + popoverWidth > parentRect.width) {
        leftPos = rect.right - parentRect.left - popoverWidth;
      }
      if (leftPos < 0) leftPos = 0;
      
      popover.style.left = `${leftPos}px`;
      popover.style.top = `${topPos}px`;
      popover.style.display = "block";
    });
  });
  
  document.addEventListener("click", (e) => {
    if (popover.style.display === "block" && !popover.contains(e.target)) {
      popover.style.display = "none";
    }
  });
  
  const btnApply = document.getElementById("btn-filter-apply");
  if (btnApply) {
    btnApply.addEventListener("click", () => {
      const col = window.currentFilteringColumn;
      const optionsContainer = document.getElementById("filter-popover-options");
      if (optionsContainer) {
        const checkedBoxes = optionsContainer.querySelectorAll("input[type='checkbox']:checked");
        const allBoxes = optionsContainer.querySelectorAll("input[type='checkbox']");
        
        if (checkedBoxes.length === allBoxes.length) {
          window.orderSheetFilters[col] = null;
        } else {
          // 체크된 항목 리스트 수집 (아무것도 없으면 빈 배열로 지정해 모두 미매칭)
          window.orderSheetFilters[col] = Array.from(checkedBoxes).map(cb => cb.value);
        }
      }
      popover.style.display = "none";
      renderOrderSheetData();
    });
  }
  
  const btnCancel = document.getElementById("btn-filter-cancel");
  if (btnCancel) {
    btnCancel.addEventListener("click", () => {
      popover.style.display = "none";
    });
  }
  
  const btnClear = document.getElementById("btn-filter-clear-column");
  if (btnClear) {
    btnClear.addEventListener("click", () => {
      window.orderSheetFilters[window.currentFilteringColumn] = null;
      popover.style.display = "none";
      renderOrderSheetData();
    });
  }
  
  const btnSelectAll = document.getElementById("btn-filter-select-all");
  if (btnSelectAll) {
    btnSelectAll.addEventListener("click", () => {
      const optionsContainer = document.getElementById("filter-popover-options");
      if (optionsContainer) {
        const checkboxes = optionsContainer.querySelectorAll("input[type='checkbox']");
        checkboxes.forEach(cb => { cb.checked = true; });
      }
    });
  }
  
  const btnDeselectAll = document.getElementById("btn-filter-deselect-all");
  if (btnDeselectAll) {
    btnDeselectAll.addEventListener("click", () => {
      const optionsContainer = document.getElementById("filter-popover-options");
      if (optionsContainer) {
        const checkboxes = optionsContainer.querySelectorAll("input[type='checkbox']");
        checkboxes.forEach(cb => { cb.checked = false; });
      }
    });
  }
}

// --- 필터링된 발주 상세 내역 기반 매출 전표 일괄 생성 ---
function importOrderSheetSales() {
  if (!window.lastUploadedOrderData) {
    alert("업로드된 발주 데이터가 없습니다.");
    return;
  }
  
  const visibleRows = getFilteredOrderRows();
  const activeRows = visibleRows.filter(r => (r.status || "대기") === "대기");
  
  if (activeRows.length === 0) {
    alert("이관 가능한 '대기' 상태의 발주 내역이 없습니다.\n이미 매출이 등록되었거나 필터링 조건에 대기 중인 항목이 없는지 확인해 주세요.");
    return;
  }
  
  if (!confirm(`현재 필터링된 대기 중인 발주 내역 ${activeRows.length}행을 매출 전표로 일괄 등록하시겠습니까?\n등록 시 날짜 및 학교별로 매출 전표가 자동 묶여 생성되며 재고가 차감됩니다.`)) {
    return;
  }
  
  const groupedOrders = {};
  activeRows.forEach(r => {
    const key = `${r.date}||${r.school}`;
    if (!groupedOrders[key]) {
      groupedOrders[key] = {
        date: r.date,
        school: r.school,
        items: []
      };
    }
    groupedOrders[key].items.push(r);
  });
  
  let salesCreatedCount = 0;
  let newPartnersCreated = 0;
  let newProductsCreated = 0;
  
  for (const groupKey in groupedOrders) {
    const group = groupedOrders[groupKey];
    const orderDate = group.date;
    const schoolName = (group.school || "").trim();
    const items = group.items;
    
    let partnerObj = db.partners.find(p => (p.name || "").trim() === schoolName);
    if (!partnerObj) {
      const ptnId = "PTN-" + Date.now() + Math.random().toString(36).substring(2, 5);
      partnerObj = {
        id: ptnId,
        code: "PTN-" + String(db.partners.length + 1).padStart(3, '0'),
        name: schoolName,
        type: PARTNER_TYPE_SALES,
        ceo: "교장선생님",
        bizNo: "000-00-00000",
        address: "강원도 동해시",
        phone: "033-000-0000"
      };
      db.partners.push(partnerObj);
      newPartnersCreated++;
    }
    
    const cartItems = [];
    items.forEach(item => {
      let productObj = db.products.find(p => p.name === item.product && (p.spec === item.spec || (!p.spec && !item.spec)));
      if (!productObj) {
        const similarProd = db.products.find(p => p.name === item.product);
        const refPrice = similarProd ? (similarProd.salesPrice || similarProd.price || 0) : 0;
        
        const prdId = "PRD-" + Date.now() + Math.random().toString(36).substring(2, 5);
        productObj = {
          id: prdId,
          code: "PRD" + String(db.products.length + 1).padStart(3, '0'),
          name: item.product,
          unit: item.spec ? item.spec.split('/').pop() : "kg",
          origin: "국산",
          purchasePrice: Math.round((item.price || refPrice) * 0.8),
          salesPrice: item.price || refPrice,
          taxType: TAX_TYPE_EXEMPT,
          stock: 0
        };
        db.products.push(productObj);
        newProductsCreated++;
      }
      
      const qty = item.qty;
      const price = item.price || productObj.salesPrice || productObj.price || 0;
      const amount = Math.round(qty * price);
      const tax = productObj.taxType === TAX_TYPE_TAXABLE ? Math.round(amount * TAX_RATE) : 0;
      const total = amount + tax;
      
      productObj.stock = (Number(productObj.stock) || 0) - qty;
      
      cartItems.push({
        productId: productObj.id,
        productName: productObj.name,
        spec: productObj.unit,
        taxType: productObj.taxType,
        qty: qty,
        price: price,
        supplyValue: amount,
        tax: tax,
        totalAmount: total,
        name: productObj.name,
        unit: productObj.unit,
        origin: productObj.origin,
        incomingDate: orderDate,
        amount: amount,
        total: total
      });
    });
    
    const saleId = "SAL-" + Date.now() + Math.random().toString(36).substring(2, 5);
    const totalAmount = cartItems.reduce((sum, item) => sum + item.amount, 0);
    const totalTax = cartItems.reduce((sum, item) => sum + item.tax, 0);
    const totalSum = totalAmount + totalTax;
    
    const newSale = {
      id: saleId,
      date: orderDate,
      partner: schoolName,
      partnerId: partnerObj.id,
      items: cartItems,
      amount: totalAmount,
      tax: totalTax,
      total: totalSum,
      totalSupplyValue: totalAmount,
      totalTax: totalTax,
      totalAmount: totalSum,
      status: STATUS_CREDIT,
      printOptionLabel: "off",
      note: "통합발주표 일괄 생성됨"
    };
    
    db.sales.push(newSale);
    salesCreatedCount++;
  }
  
  activeRows.forEach(row => {
    row.status = "이관 완료";
  });
  
  db.uploadedSchoolFiles = window.uploadedSchoolFiles;
  saveDb();
  renderOrderSheetData();
  
  let msg = `성공적으로 선택된 발주 내역을 통해 매출 전표 ${salesCreatedCount}건이 등록되었습니다.\n`;
  if (newPartnersCreated > 0) msg += `- 신규 학교(매출처) ${newPartnersCreated}곳 자동 등록됨\n`;
  if (newProductsCreated > 0) msg += `- 신규 품목(재고) ${newProductsCreated}개 자동 등록됨\n`;
  msg += `- 각 출고량만큼 상품 재고량이 자동차감 처리되었습니다.`;
  alert(msg);
  
  const salesTab = document.querySelector(".menu-item[data-tab='sales']");
  if (salesTab) {
    salesTab.click();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  // --- 통합 발주표 관리 엑셀 업로드 이벤트 바인딩 ---
  const orderSheetDropZone = document.getElementById("order-sheet-drop-zone");
  const orderSheetFileInput = document.getElementById("order-sheet-file-input");
  const orderSheetDateSelect = document.getElementById("order-sheet-date-select");
  const btnOrderSheetImportSales = document.getElementById("btn-order-sheet-import-sales");
  
  if (orderSheetDropZone && orderSheetFileInput) {
    orderSheetDropZone.addEventListener("click", () => {
      orderSheetFileInput.click();
    });
    
    orderSheetDropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      orderSheetDropZone.classList.add("dragover");
      orderSheetDropZone.style.borderColor = "var(--primary-color)";
      orderSheetDropZone.style.background = "rgba(167, 139, 250, 0.08)";
    });
    
    const resetDropZoneStyle = () => {
      orderSheetDropZone.classList.remove("dragover");
      orderSheetDropZone.style.borderColor = "rgba(167, 139, 250, 0.4)";
      orderSheetDropZone.style.background = "rgba(255,255,255,0.02)";
    };
    
    orderSheetDropZone.addEventListener("dragleave", resetDropZoneStyle);
    orderSheetDropZone.addEventListener("dragend", resetDropZoneStyle);
    
    orderSheetDropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      resetDropZoneStyle();
      
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        orderSheetFileInput.files = files;
        const event = new Event('change');
        orderSheetFileInput.dispatchEvent(event);
      }
    });
    
    orderSheetFileInput.addEventListener("change", async (e) => {
      const files = Array.from(e.target.files);
      if (files.length === 0) return;
      
      const pText = orderSheetDropZone.querySelector("p");
      if (pText) pText.textContent = `${files.length}개 파일 분석 중...`;
      
      if (!window.uploadedSchoolFiles) window.uploadedSchoolFiles = [];
      
      let successCount = 0;
      let errorCount = 0;
      let isIntegratedLoaded = false;
      
      // 엑셀 날짜 일련번호 변환 함수
      const formatExcelDate = (excelDate) => {
        if (!excelDate) return "";
        if (typeof excelDate === 'number') {
          // 엑셀 1900년 윤년 버그 보정을 위해 25569를 적용하여 자바스크립트 Date로 변환
          const date = new Date((excelDate - 25569) * 86400 * 1000);
          const tzOffset = date.getTimezoneOffset() * 60000;
          const localDate = new Date(date.getTime() + tzOffset);
          const y = localDate.getFullYear();
          const m = String(localDate.getMonth() + 1).padStart(2, '0');
          const d = String(localDate.getDate()).padStart(2, '0');
          return `${y}-${m}-${d}`;
        }
        let str = String(excelDate).trim();
        if (str.match(/^\d{4}[-./]\d{1,2}[-./]\d{1,2}$/)) {
          return str.replace(/[./]/g, '-');
        }
        const shortMatch = str.match(/^(\d{2})[-./](\d{1,2})[-./](\d{1,2})$/);
        if (shortMatch) {
          return `20${shortMatch[1]}-${shortMatch[2].padStart(2, '0')}-${shortMatch[3].padStart(2, '0')}`;
        }
        return str;
      };
      
      for (const file of files) {
        try {
          const fileData = await readFileAsArrayBuffer(file);
          const workbook = XLSX.read(fileData, { type: 'array' });
          
          let isIntegrated = false;
          let targetSheetName = workbook.SheetNames[0];
          
          // '전체 데이터' 시트가 존재하면 우선적으로 통합 발주표로 판단
          if (workbook.SheetNames.includes("전체 데이터")) {
            isIntegrated = true;
            targetSheetName = "전체 데이터";
          } else {
            // 첫 시트의 상단 데이터 검사하여 통합 발주표 여부 확인
            const tempSheet = workbook.Sheets[workbook.SheetNames[0]];
            const tempRows = XLSX.utils.sheet_to_json(tempSheet, { header: 1, range: 0 });
            for (let r = 0; r < Math.min(10, tempRows.length); r++) {
              const row = tempRows[r] || [];
              const rowStr = row.map(v => String(v || '')).join(' ');
              if (rowStr.includes("납품일자") && rowStr.includes("학교") && rowStr.includes("품목")) {
                isIntegrated = true;
                break;
              }
            }
          }
          
          const sheet = workbook.Sheets[targetSheetName];
          const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
          
          if (isIntegrated) {
            // --- 통합 발주서 파싱 로직 ---
            let headerRowIdx = -1;
            for (let r = 0; r < Math.min(15, rawData.length); r++) {
              const row = rawData[r] || [];
              const rowStr = row.map(v => String(v || '')).join(' ');
              if (rowStr.includes("납품일자") && rowStr.includes("학교") && rowStr.includes("품목")) {
                headerRowIdx = r;
                break;
              }
            }
            
            if (headerRowIdx === -1) {
              throw new Error("통합 발주서 헤더(납품일자, 학교, 품목 등)를 찾을 수 없습니다.");
            }
            
            const headerRow = rawData[headerRowIdx];
            const dateColIdx = headerRow.findIndex(h => String(h || '').trim() === '납품일자');
            const schoolColIdx = headerRow.findIndex(h => String(h || '').trim() === '학교');
            const prodColIdx = headerRow.findIndex(h => String(h || '').trim() === '품목');
            const specColIdx = headerRow.findIndex(h => String(h || '').trim() === '규격/단위' || String(h || '').trim() === '규격');
            const descColIdx = headerRow.findIndex(h => String(h || '').trim() === '속성설명' || String(h || '').trim() === '비고');
            const qtyColIdx = headerRow.findIndex(h => String(h || '').trim() === '수량');
            const priceColIdx = headerRow.findIndex(h => String(h || '').trim().startsWith('단가'));
            const statusColIdx = headerRow.findIndex(h => String(h || '').trim() === '상태');
            
            const parsedRows = [];
            for (let r = headerRowIdx + 1; r < rawData.length; r++) {
              const row = rawData[r] || [];
              if (row.length === 0) continue;
              
              const rawDate = row[dateColIdx];
              const school = String(row[schoolColIdx] || '').trim();
              const productName = String(row[prodColIdx] || '').trim();
              
              if (!rawDate || !school || !productName) continue;
              if (productName.includes("합계") || productName.includes("【합 계】") || productName === "식품명") continue;
              
              const dateStr = formatExcelDate(rawDate);
              let spec = specColIdx !== -1 ? String(row[specColIdx] || '').trim() : '';
              spec = sanitizeExcelUnitAndName(spec);
              
              let desc = descColIdx !== -1 && row[descColIdx] ? String(row[descColIdx]).trim() : '';
              
              const qty = parseFloat(String(row[qtyColIdx] || '0').replace(/,/g, ''));
              let price = parseFloat(String(row[priceColIdx] || '0').replace(/,/g, ''));
              
              if (isNaN(qty) || qty <= 0) continue;
              
              if (isNaN(price) || price === 0) {
                const productObj = db.products.find(p => p.name === productName);
                if (productObj) {
                  price = Number(productObj.salesPrice) || 0;
                } else {
                  price = 0;
                }
              }
              
              const status = statusColIdx !== -1 && row[statusColIdx] ? String(row[statusColIdx]).trim() : "대기";
              
              parsedRows.push({
                date: dateStr,
                school: school,
                product: productName,
                spec: spec,
                qty: qty,
                price: price,
                status: status,
                desc: desc
              });
            }
            
            // 통합 발주서를 로드한 경우, 기존의 개별 학교 목록을 리셋하고 이 통합 발주서만 단독 등록
            window.uploadedSchoolFiles = [{
              fileName: file.name,
              school: "전체 통합 발주",
              rows: parsedRows
            }];
            successCount++;
            isIntegratedLoaded = true;
            break; // 통합 발주서의 경우 루프 종료
          } else {
            // --- 개별 학교 발주서 파싱 로직 ---
            let year = new Date().getFullYear();
            let mealType = "중식";
            let schoolName = "";
            
            for (let r = 0; r < Math.min(10, rawData.length); r++) {
              const row = rawData[r] || [];
              for (let c = 0; c < row.length; c++) {
                const val = String(row[c] || '').trim();
                if (val.includes('기간 :') || val.includes('기간:')) {
                  const yearMatch = val.match(/\b(20\d{2})\b/);
                  const mealMatch = val.match(/\((조식|중식|석식)\)/);
                  if (yearMatch) year = parseInt(yearMatch[1]);
                  if (mealMatch) mealType = mealMatch[1];
                }
                if (val.includes('[발송]')) {
                  const schoolMatch = val.match(/\[발송\]\s*:\s*([^\s]+)/);
                  if (schoolMatch) {
                    schoolName = schoolMatch[1].replace(/초등학교|중학교|고등학교/g, m => m).trim();
                    if (schoolName.includes('동해삼육고등학교')) {
                      schoolName = `${schoolName}(${mealType})`;
                    }
                  }
                }
              }
            }
            
            if (!schoolName) {
              const fileMatch = file.name.match(/\(([^)]+)\)/);
              if (fileMatch) {
                const name = fileMatch[1].trim();
                if (name.includes('임원초')) schoolName = '임원초등학교';
                else if (name.includes('오저')) schoolName = '오저초등학교';
                else if (name.includes('삼척중')) schoolName = '삼척중학교';
                else schoolName = name;
              } else {
                schoolName = file.name.replace(/\.xlsx?$/, '').trim();
              }
            }
            
            let headerRowIdx = -1;
            for (let r = 0; r < Math.min(15, rawData.length); r++) {
              const row = rawData[r] || [];
              if (row.includes('식품명') || row.includes('품목명') || row.includes('품목')) {
                headerRowIdx = r;
                break;
              }
            }
            
            if (headerRowIdx === -1) {
              throw new Error("식품명 헤더 행을 찾을 수 없습니다.");
            }
            
            const headerRow = rawData[headerRowIdx];
            const prodNameColIdx = headerRow.findIndex(h => h === '식품명' || h === '품목명' || h === '품목');
            const specColIdx = headerRow.findIndex(h => h === '속성설명');
            const unitColIdx = headerRow.findIndex(h => h === '단위' || h === '규격/단위' || h === '규격');
            
            const dateCols = [];
            headerRow.forEach((val, cIdx) => {
              if (!val) return;
              const strVal = String(val).trim();
              const dateMatch = strVal.match(/^(\d{1,2})\.(\d{1,2})$/);
              if (dateMatch) {
                const m = dateMatch[1].padStart(2, '0');
                const d = dateMatch[2].padStart(2, '0');
                const dateStr = `${year}-${m}-${d}`;
                dateCols.push({ index: cIdx, dateStr: dateStr });
              }
            });
            
            if (dateCols.length === 0) {
              throw new Error("유효한 납품일자 열(MM.DD)을 찾을 수 없습니다.");
            }
            
            const parsedRows = [];
            for (let r = headerRowIdx + 1; r < rawData.length; r++) {
              const row = rawData[r] || [];
              const productName = String(row[prodNameColIdx] || '').trim();
              if (!productName || productName.includes('【합계】') || productName.includes('합계') || productName === 'NO' || productName === '식품명') {
                continue;
              }
              
              let spec = '';
              if (unitColIdx !== -1) spec = String(row[unitColIdx] || '').trim();
              if (!spec && specColIdx !== -1) spec = String(row[specColIdx] || '').trim();
              spec = sanitizeExcelUnitAndName(spec);
              
              let desc = '';
              if (specColIdx !== -1) desc = String(row[specColIdx] || '').trim();
              
              dateCols.forEach(col => {
                const val = row[col.index];
                if (val === null || val === undefined || val === '') return;
                
                const valStr = String(val).trim();
                if (valStr === '취소' || valStr === '-') return;
                
                const qty = parseFloat(valStr);
                if (qty > 0) {
                  let productObj = db.products.find(p => p.name === productName);
                  let price = 0;
                  if (productObj) {
                    price = Number(productObj.salesPrice) || 0;
                  }
                  
                  parsedRows.push({
                    date: col.dateStr,
                    school: schoolName,
                    product: productName,
                    spec: spec,
                    qty: qty,
                    price: price,
                    status: "대기",
                    desc: desc
                  });
                }
              });
            }
            
            // 기존 개별 학교 파일 중 같은 파일명이 있으면 교체, 없으면 추가
            const dupIdx = window.uploadedSchoolFiles.findIndex(f => f.fileName === file.name);
            if (dupIdx !== -1) {
              window.uploadedSchoolFiles[dupIdx] = {
                fileName: file.name,
                school: schoolName,
                rows: parsedRows
              };
            } else {
              window.uploadedSchoolFiles.push({
                fileName: file.name,
                school: schoolName,
                rows: parsedRows
              });
            }
            successCount++;
          }
        } catch (err) {
          console.error(`Error parsing file ${file.name}:`, err);
          errorCount++;
        }
      }
      
      orderSheetFileInput.value = "";
      db.uploadedSchoolFiles = window.uploadedSchoolFiles;
      saveDb();
      processUploadedSchoolFiles();
      
      if (pText) {
        pText.textContent = `학교별 발주서 파일들(0601농수산(오저).xlsx 등)을 여기에 여러 개 드래그하거나 클릭하여 다중 선택하세요.`;
      }
      
      let alertMsg = isIntegratedLoaded 
        ? `통합 발주 상세 내역 엑셀 파일이 성공적으로 로드되었습니다.`
        : `발주서 파일 파싱 완료:\n- 성공: ${successCount}건`;
      if (errorCount > 0) alertMsg += `\n- 실패: ${errorCount}건 (상세 내용은 개발자 도구 콘솔을 확인해 주세요)`;
      alert(alertMsg);
    });
  }
  
  setupOrderSheetFilters();
  
  const btnOrderSheetAddRow = document.getElementById("btn-order-sheet-add-row");
  if (btnOrderSheetAddRow) {
    btnOrderSheetAddRow.addEventListener("click", () => {
      // 모든 필터 해제
      Object.keys(window.orderSheetFilters).forEach(k => {
        window.orderSheetFilters[k] = null;
      });
      
      const today = new Date();
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, '0');
      const d = String(today.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;
      
      const newRow = {
        date: dateStr,
        school: "",
        product: "",
        spec: "",
        qty: 0,
        price: 0,
        status: "추가",
        desc: ""
      };
      
      if (!window.uploadedSchoolFiles || window.uploadedSchoolFiles.length === 0) {
        window.uploadedSchoolFiles = [{
          fileName: "수동 등록 발주표",
          school: "수동 등록",
          rows: []
        }];
      }
      
      // 맨 위에 새 행 추가
      window.uploadedSchoolFiles[0].rows.unshift(newRow);
      
      // DB 영구 저장
      db.uploadedSchoolFiles = window.uploadedSchoolFiles;
      saveDb();
      
      // 취합 및 리렌더링
      processUploadedSchoolFiles();
      
      // 새 행의 학교명 입력상자에 포커스 포지셔닝
      setTimeout(() => {
        const firstRow = document.querySelector("#order-sheet-table-rows tr");
        if (firstRow) {
          const input = firstRow.querySelector(".inline-school");
          if (input) input.focus();
        }
      }, 50);
    });
  }
  
  if (btnOrderSheetImportSales) {
    btnOrderSheetImportSales.addEventListener("click", () => {
      importOrderSheetSales();
    });
  }

  // 엑셀 발주서 업로드 이벤트 바인딩 (안전한 DOMContentLoaded 내부 이전)
  const salesExcelFile = document.getElementById("sales-excel-file");
  const excelUploadStatus = document.getElementById("excel-upload-status");

  if (salesExcelFile) {
    salesExcelFile.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      excelUploadStatus.textContent = `${file.name} 분석 중...`;

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
            excelUploadStatus.textContent = "가져오기 실패";
            return;
          }

          uploadedExcelRows = rows;
          excelUploadStatus.textContent = `엑셀 로드됨: ${file.name} (총 ${rows.length}행)`;
          excelUploadStatus.style.color = "var(--success-color)";
          
          const btnLoad = document.getElementById("btn-load-excel-items");
          if (btnLoad) btnLoad.style.display = "inline-block";

          alert("엑셀 파일이 성공적으로 로드되었습니다.\n매출일자와 매출처를 선택하시면 해당 데이터를 자동으로 불러옵니다.");
          
          window.loadItemsFromExcel();
        } catch (err) {
          console.error(err);
          excelUploadStatus.textContent = "에러 발생";
          alert("엑셀 파일 구조 분석 중 문제가 발생했습니다. 파일을 다시 한 번 확인해 주세요.");
        }
      };
      reader.readAsArrayBuffer(file);
    });
  }

  if (window.lucide) window.lucide.createIcons();

  const todayStr = getKstTodayString();
  if(document.getElementById("pur-date")) document.getElementById("pur-date").value = todayStr;
  if(document.getElementById("sales-date")) document.getElementById("sales-date").value = todayStr;
  
  // 입고일의 디폴트 오늘 날짜
  if(document.getElementById("sales-item-incoming")) document.getElementById("sales-item-incoming").value = todayStr;
  if(document.getElementById("pur-item-incoming")) document.getElementById("pur-item-incoming").value = todayStr;
  
  // 매출/매입 일자 변경 시 입고일 및 카트 전체 품목의 입고일 자동 동기화 처리
  const purDateInput = document.getElementById("pur-date");
  const purIncomingInput = document.getElementById("pur-item-incoming");
  if (purDateInput && purIncomingInput) {
    purDateInput.addEventListener("input", () => {
      purIncomingInput.value = purDateInput.value;
      purchaseCart.forEach(item => {
        item.incomingDate = purDateInput.value;
      });
      renderPurCart();
    });
  }
  
  const salesDateInput = document.getElementById("sales-date");
  const salesIncomingInput = document.getElementById("sales-item-incoming");
  if (salesDateInput && salesIncomingInput) {
    const handleSalesDateChange = () => {
      salesIncomingInput.value = salesDateInput.value;
      salesCart.forEach(item => {
        item.incomingDate = salesDateInput.value;
      });
      renderSalesCart();

      // 엑셀 데이터가 로드된 상태이고 수정 모드가 아닐 때 자동 연동
      if (uploadedExcelRows && editingSalesId === null) {
        window.loadItemsFromExcel();
      }
    };
    
    salesDateInput.addEventListener("input", handleSalesDateChange);
    salesDateInput.addEventListener("change", handleSalesDateChange);
  }

  // 매출처 변경 시 엑셀 발주 데이터 자동 연동
  const salesPartnerInput = document.getElementById("sales-partner");
  if (salesPartnerInput) {
    const handleSalesPartnerChange = () => {
      if (uploadedExcelRows && editingSalesId === null) {
        window.loadItemsFromExcel();
      }
    };
    salesPartnerInput.addEventListener("change", handleSalesPartnerChange);
    salesPartnerInput.addEventListener("input", handleSalesPartnerChange);
  }

  // 수동 엑셀 데이터 불러오기 버튼 바인딩
  const btnLoadExcel = document.getElementById("btn-load-excel-items");
  if (btnLoadExcel) {
    btnLoadExcel.addEventListener("click", () => {
      window.loadItemsFromExcel(true);
    });
  }
  
  // 기간별 필터링 날짜 범위 디폴트 지정 (기본값 오늘 날짜)
  if(document.getElementById("pur-filter-start")) document.getElementById("pur-filter-start").value = todayStr;
  if(document.getElementById("pur-filter-end")) document.getElementById("pur-filter-end").value = todayStr;
  if(document.getElementById("sales-filter-start")) document.getElementById("sales-filter-start").value = todayStr;
  if(document.getElementById("sales-filter-end")) document.getElementById("sales-filter-end").value = todayStr;
  
  // 외상대금 기본 날짜 필터 지정 (기본값 오늘 날짜)
  if(document.getElementById("receivable-filter-start")) document.getElementById("receivable-filter-start").value = todayStr;
  if(document.getElementById("receivable-filter-end")) document.getElementById("receivable-filter-end").value = todayStr;

  // 매입 부가세 10% 일괄 적용 버튼 핸들러
  const btnPurApplyTax = document.getElementById("btn-pur-apply-tax");
  if (btnPurApplyTax) {
    btnPurApplyTax.addEventListener("click", () => {
      const allApplied = purchaseCart.every(item => {
        const prodMeta = db.products.find(p => p.name === item.name);
        const isTaxable = !prodMeta || prodMeta.taxType !== TAX_TYPE_EXEMPT;
        return !isTaxable || item.isTaxApplied;
      });
      purchaseCart.forEach((item, idx) => {
        const prodMeta = db.products.find(p => p.name === item.name);
        const isTaxable = !prodMeta || prodMeta.taxType !== TAX_TYPE_EXEMPT;
        if (isTaxable) {
          item.isTaxApplied = !allApplied;
          item.tax = item.isTaxApplied ? Math.floor(item.amount * TAX_RATE) : 0;
        } else {
          item.isTaxApplied = false;
          item.tax = 0;
        }
        item.total = item.amount + item.tax;
      });
      renderPurCart();
    });
  }

  // 매출 부가세 10% 일괄 적용 버튼 핸들러
  const btnSalesApplyTax = document.getElementById("btn-sales-apply-tax");
  if (btnSalesApplyTax) {
    btnSalesApplyTax.addEventListener("click", () => {
      const allApplied = salesCart.every(item => {
        const prodMeta = db.products.find(p => p.name === item.name);
        const isTaxable = !prodMeta || prodMeta.taxType !== TAX_TYPE_EXEMPT;
        return !isTaxable || item.isTaxApplied;
      });
      salesCart.forEach((item, idx) => {
        const prodMeta = db.products.find(p => p.name === item.name);
        const isTaxable = !prodMeta || prodMeta.taxType !== TAX_TYPE_EXEMPT;
        if (isTaxable) {
          item.isTaxApplied = !allApplied;
          item.tax = item.isTaxApplied ? Math.floor(item.amount * TAX_RATE) : 0;
        } else {
          item.isTaxApplied = false;
          item.tax = 0;
        }
        item.total = item.amount + item.tax;
      });
      renderSalesCart();
    });
  }

  // 라벨 인쇄 3D 토글 스위치 이벤트 처리
  const toggleWrapper = document.getElementById("label-print-toggle-wrapper");
  const inputToggle = document.getElementById("sales-label-print-toggle");
  if (toggleWrapper && inputToggle) {
    const track = toggleWrapper.querySelector(".toggle-track");
    const textEl = toggleWrapper.querySelector(".toggle-text");
    
    toggleWrapper.addEventListener("click", () => {
      if (inputToggle.value === "on") {
        inputToggle.value = "off";
        track.className = "toggle-track off";
        textEl.textContent = "OFF";
      } else {
        inputToggle.value = "on";
        track.className = "toggle-track on";
        textEl.textContent = "ON";
      }
    });
  }

  // 폼 리셋 시 토글 스위치 상태 동기화 처리 및 부가세 상태 초기화
  const formSalesBill = document.getElementById("form-sales-bill");
  if (formSalesBill) {
    formSalesBill.addEventListener("reset", () => {
      if (inputToggle) {
        inputToggle.value = "on";
        const track = toggleWrapper ? toggleWrapper.querySelector(".toggle-track") : null;
        const textEl = toggleWrapper ? toggleWrapper.querySelector(".toggle-text") : null;
        if (track) track.className = "toggle-track on";
        if (textEl) textEl.textContent = "ON";
      }
      salesCart = [];
      resetSalesTaxState();
      renderSalesCart();
    });
  }

  const formPurchaseBill = document.getElementById("form-purchase-bill");
  if (formPurchaseBill) {
    formPurchaseBill.addEventListener("reset", () => {
      purchaseCart = [];
      resetPurTaxState();
      renderPurCart();
    });
  }


  // 견적서 기본 설정 및 초기값 부여
  if (document.getElementById("est-date")) document.getElementById("est-date").value = todayStr;
  if (document.getElementById("est-serial")) {
    document.getElementById("est-serial").value = Math.floor(Math.random() * 1000) + "-" + Math.floor(Math.random() * 1000);
  }

  updateDashboard();
  renderHqList();
  renderEmployeeList();
  renderBankList();
  renderPartners();
  renderProducts();
  renderSelectOptions();
  renderPurchaseList();
  renderSalesList();
  renderReceivablesAndPayables();
  prefillEstimateSupplier();
  renderEstimatesList();

  const cancelEditBtn = document.getElementById("btn-sales-cancel-edit");
  if (cancelEditBtn) {
    cancelEditBtn.addEventListener("click", () => {
      window.cancelEditSales();
    });
  }

  const cancelPurEditBtn = document.getElementById("btn-purchase-cancel-edit");
  if (cancelPurEditBtn) {
    cancelPurEditBtn.addEventListener("click", () => {
      window.cancelEditPurchase();
    });
  }

  const cancelEstEditBtn = document.getElementById("btn-estimate-cancel-edit");
  if (cancelEstEditBtn) {
    cancelEstEditBtn.addEventListener("click", () => {
      window.cancelEditEstimate();
    });
  }

  // --- 저장 전용 및 저장/출력 분리 리스너 바인딩 ---
  const btnSalesSaveOnly = document.getElementById("btn-sales-save-only");
  if (btnSalesSaveOnly) {
    btnSalesSaveOnly.addEventListener("click", () => {
      shouldPrintSales = false;
      document.getElementById("form-sales-bill").requestSubmit();
    });
  }
  const btnSalesSubmit = document.getElementById("btn-sales-submit");
  if (btnSalesSubmit) {
    btnSalesSubmit.addEventListener("click", () => {
      shouldPrintSales = true;
    });
  }

  const btnPurchaseSaveOnly = document.getElementById("btn-purchase-save-only");
  if (btnPurchaseSaveOnly) {
    btnPurchaseSaveOnly.addEventListener("click", () => {
      shouldPrintPurchase = false;
      document.getElementById("form-purchase-bill").requestSubmit();
    });
  }
  const btnPurchaseSubmit = document.getElementById("btn-purchase-submit");
  if (btnPurchaseSubmit) {
    btnPurchaseSubmit.addEventListener("click", () => {
      shouldPrintPurchase = true;
    });
  }

  const btnEstimateSaveOnly = document.getElementById("btn-estimate-save-only");
  if (btnEstimateSaveOnly) {
    btnEstimateSaveOnly.addEventListener("click", () => {
      shouldPrintEstimate = false;
      document.getElementById("form-estimate").requestSubmit();
    });
  }
  const btnEstimateSubmit = document.getElementById("btn-estimate-submit");
  if (btnEstimateSubmit) {
    btnEstimateSubmit.addEventListener("click", () => {
      shouldPrintEstimate = true;
    });
  }

  // --- 14. 실시간 클라우드 공유 및 인증 처리 ---
  const authOverlay = document.getElementById("auth-overlay");
  const formAuth = document.getElementById("form-auth");
  const authErrorMsg = document.getElementById("auth-error-msg");
  const authUsername = document.getElementById("auth-username");
  const authPassword = document.getElementById("auth-password");
  const authRegisterFields = document.getElementById("auth-register-fields");
  const authCompanyName = document.getElementById("auth-company-name");
  const authUserFullname = document.getElementById("auth-user-fullname");
  const authSubtitle = document.getElementById("auth-subtitle");
  const btnAuthSubmit = document.getElementById("btn-auth-submit");
  const authModeMsg = document.getElementById("auth-mode-msg");
  const btnAuthToggleMode = document.getElementById("btn-auth-toggle-mode");

  let isRegisterMode = false;

  if (btnAuthToggleMode) {
    btnAuthToggleMode.addEventListener("click", () => {
      isRegisterMode = !isRegisterMode;
      authErrorMsg.style.display = "none";
      
      if (isRegisterMode) {
        authRegisterFields.style.display = "flex";
        authSubtitle.textContent = "실시간 클라우드 공유 회사 신규 개설";
        btnAuthSubmit.textContent = "가입 및 개설 완료";
        authModeMsg.textContent = "이미 계정이 있으신가요?";
        btnAuthToggleMode.textContent = "기존 계정 로그인";
        authCompanyName.required = true;
        authUserFullname.required = true;
      } else {
        authRegisterFields.style.display = "none";
        authSubtitle.textContent = "회사 통합 업무 재무 관리 시스템 로그인";
        btnAuthSubmit.textContent = "로그인 완료";
        authModeMsg.textContent = "아직 회사 계정이 없으신가요?";
        btnAuthToggleMode.textContent = "신규 개설 및 가입";
        authCompanyName.required = false;
        authUserFullname.required = false;
        authCompanyName.value = "";
        authUserFullname.value = "";
      }
    });
  }

  if (formAuth) {
    formAuth.addEventListener("submit", async (e) => {
      e.preventDefault();
      authErrorMsg.style.display = "none";

      const username = authUsername.value.trim();
      const password = authPassword.value;

      if (isRegisterMode) {
        const companyName = authCompanyName.value.trim();
        const name = authUserFullname.value.trim();

        try {
          const response = await fetch("/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password, companyName, name })
          });
          const data = await response.json();
          if (response.ok) {
            alert("회원가입 및 회사 개설이 성공하였습니다. 로그인해 주세요!");
            btnAuthToggleMode.click();
          } else {
            authErrorMsg.textContent = data.error || "회원가입에 실패했습니다.";
            authErrorMsg.style.display = "block";
          }
        } catch (err) {
          authErrorMsg.textContent = "네트워크 오류가 발생했습니다.";
          authErrorMsg.style.display = "block";
        }
      } else {
        try {
          const response = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
          });
          const data = await response.json();
          if (response.ok) {
            localStorage.setItem("erp_jwt_token", data.token);
            localStorage.setItem("erp_user_info", JSON.stringify(data.user));
            
            updateLoginStatusUI(data.user);
            updateCloudSyncStatusUI();
            authOverlay.style.display = "none";
            
            await smartSync();
            alert(`${data.user.companyName}의 ERP 원장이 동기화되었습니다.`);
          } else {
            authErrorMsg.textContent = data.error || "로그인 정보가 올바르지 않습니다.";
            authErrorMsg.style.display = "block";
          }
        } catch (err) {
          authErrorMsg.textContent = "네트워크 오류가 발생했습니다.";
          authErrorMsg.style.display = "block";
        }
      }
    });
  }

  function updateLoginStatusUI(user) {
    const userDisplay = document.getElementById("user-display-name");
    if (userDisplay && user) {
      userDisplay.textContent = `${user.companyName} [${user.name} 님]`;
    }
  }

  function updateCloudSyncStatusUI() {
    const statusEl = document.getElementById("cloud-sync-status");
    if (!statusEl) return;
    
    const token = localStorage.getItem("erp_jwt_token");
    if (token) {
      statusEl.innerHTML = `
        <span style="display: inline-block; width: 8px; height: 8px; background: #10b981; border-radius: 50%;"></span>
        <span style="color: #10b981;">실시간 클라우드 동기화 활성화됨</span>
      `;
    } else {
      statusEl.innerHTML = `
        <span style="display: inline-block; width: 8px; height: 8px; background: #ef4444; border-radius: 50%;"></span>
        <span style="color: #ef4444;">로컬 오프라인 모드</span>
      `;
    }
  }

  const btnCloudSync = document.getElementById("btn-cloud-sync");
  if (btnCloudSync) {
    btnCloudSync.addEventListener("click", async () => {
      const token = localStorage.getItem("erp_jwt_token");
      if (!token) {
        const authOverlay = document.getElementById("auth-overlay");
        if (authOverlay) {
          authOverlay.style.display = "flex";
        }
      } else {
        alert("클라우드와 실시간 동기화를 시작합니다.");
        await smartSync();
        updateCloudSyncStatusUI();
      }
    });
  }

  const btnLogout = document.getElementById("btn-logout");
  if (btnLogout) {
    btnLogout.addEventListener("click", () => {
      if (confirm("로그아웃 하시겠습니까? 로컬 변경 사항 중 서버에 반영되지 않은 내역이 유실될 수 있습니다.")) {
        localStorage.removeItem("erp_jwt_token");
        localStorage.removeItem("erp_user_info");
        location.reload();
      }
    });
  }

  async function checkAuth() {
    const token = localStorage.getItem("erp_jwt_token");
    if (!token) {
      authOverlay.style.display = "flex";
      updateCloudSyncStatusUI();
      return;
    }
    
    try {
      const response = await fetch("/api/auth/me", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        updateLoginStatusUI(data.user);
        updateCloudSyncStatusUI();
        authOverlay.style.display = "none";
        await smartSync();
      } else {
        localStorage.removeItem("erp_jwt_token");
        localStorage.removeItem("erp_user_info");
        authOverlay.style.display = "flex";
        updateCloudSyncStatusUI();
      }
    } catch (err) {
      console.warn("인증 확인 실패 (오프라인 모드 우선 작동):", err);
      const userInfoStr = localStorage.getItem("erp_user_info");
      if (userInfoStr) {
        const user = JSON.parse(userInfoStr);
        updateLoginStatusUI(user);
        authOverlay.style.display = "none";
      } else {
        authOverlay.style.display = "flex";
      }
      updateCloudSyncStatusUI();
    }
  }

  checkAuth();

  // --- 실시간 자동 데이터 동기화 감지 타이머 및 포커스 이벤트 ---
  function startAutoSyncTimer() {
    // 15초마다 백그라운드 폴링 실행
    setInterval(async () => {
      const token = localStorage.getItem("erp_jwt_token");
      if (!token || isSyncing) return;
      
      const isUserEditing = (
        editingSalesId !== null || 
        editingPurchaseId !== null || 
        editingEstimateId !== null ||
        salesCart.length > 0 ||
        purchaseCart.length > 0
      );
      
      if (!isUserEditing) {
        console.log("백그라운드 자동 스마트 동기화 실행 중...");
        await smartSync();
      }
    }, 15000);

    // 창에 다시 포커스가 왔을 때 자동 실행
    window.addEventListener("focus", async () => {
      const token = localStorage.getItem("erp_jwt_token");
      if (!token || isSyncing) return;

      const isUserEditing = (
        editingSalesId !== null || 
        editingPurchaseId !== null || 
        editingEstimateId !== null ||
        salesCart.length > 0 ||
        purchaseCart.length > 0
      );

      if (!isUserEditing) {
        console.log("포커스 획득에 따른 스마트 동기화 실행 중...");
        await smartSync();
      }
    });

    // 브라우저 닫거나 나갈 때 실시간 강제 업로드
    window.addEventListener("beforeunload", () => {
      const token = localStorage.getItem("erp_jwt_token");
      if (token && !isSyncing) {
        // 동기 응답 방해를 최소화하도록 백그라운드로 전송 트리거
        syncToCloud();
      }
    });
  }

  startAutoSyncTimer();
  
  processUploadedSchoolFiles();

  // 이지폼 거래처 엑셀 일괄 이관 처리기
  window.handleEasyFormPartnerExcel = function(input) {
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const reader = new FileReader();
    
    reader.onload = function(e) {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (rows.length < 2) {
          alert("가져올 거래처 데이터가 엑셀 파일 내에 존재하지 않습니다.");
          input.value = "";
          return;
        }
        
        const headerRow = rows[0].map(cell => String(cell || '').trim().replace(/\s+/g, ''));
        
        function findColIndex(names) {
          return headerRow.findIndex(col => names.some(name => col.includes(name)));
        }
        
        const idxBizNo = findColIndex(['등록번호', '사업자번호', '사업자등록번호', '등록']);
        const idxName = findColIndex(['상호', '회사명', '업체명', '거래처명', '법인명']);
        const idxOwner = findColIndex(['대표자', '대표', '성명', '대표자명', '대표자성명']);
        const idxAddress = findColIndex(['사업장주소', '주소', '소재지', '배송주소']);
        const idxPhone = findColIndex(['전화번호', '전화', '연락처', '핸드폰', '담당자전화', '담당자HP']);
        const idxType = findColIndex(['회사구분', '구분', '유형', '거래처구분']);
        
        if (idxName === -1) {
          alert("엑셀 파일 내에서 '상호' 또는 '회사명' 열을 찾을 수 없습니다. 헤더명을 확인해 주세요.");
          input.value = "";
          return;
        }
        
        let importCount = 0;
        let updateCount = 0;
        
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;
          
          let pName = String(row[idxName] || '').trim();
          if (!pName) continue;
          
          let pBizNo = idxBizNo !== -1 ? String(row[idxBizNo] || '').trim() : '';
          let pOwner = idxOwner !== -1 ? String(row[idxOwner] || '').trim() : '';
          let pAddress = idxAddress !== -1 ? String(row[idxAddress] || '').trim() : '';
          let pPhone = idxPhone !== -1 ? String(row[idxPhone] || '').trim() : '';
          let pRawType = idxType !== -1 ? String(row[idxType] || '').trim() : '';
          
          pBizNo = pBizNo.replace(/[^0-9]/g, '');
          if (pBizNo.length === 10) {
            pBizNo = pBizNo.substring(0, 3) + '-' + pBizNo.substring(3, 5) + '-' + pBizNo.substring(5);
          }
          
          let pType = '혼합';
          if (pRawType.includes('매입')) {
            pType = '매입처';
          } else if (pRawType.includes('매출')) {
            pType = '매출처';
          }
          
          let existingIndex = db.partners.findIndex(p => 
            (p.name && p.name.trim() === pName) || 
            (pBizNo && p.bizNo && p.bizNo.replace(/-/g, '') === pBizNo.replace(/-/g, ''))
          );
          
          if (existingIndex !== -1) {
            const existing = db.partners[existingIndex];
            existing.bizNo = pBizNo || existing.bizNo;
            existing.owner = pOwner || existing.owner;
            existing.address = pAddress || existing.address;
            existing.phone = pPhone || existing.phone;
            existing.type = pType || existing.type;
            updateCount++;
          } else {
            const newCode = "PTN-" + String(db.partners.length + 1).padStart(3, '0');
            db.partners.push({
              code: newCode,
              name: pName,
              bizNo: pBizNo,
              owner: pOwner,
              address: pAddress,
              phone: pPhone,
              type: pType
            });
            importCount++;
          }
        }
        
        saveDb();
        renderPartners();
        renderSelectOptions();
        
        alert(`이지폼 거래처 이관 완료!\n- 신규 등록: ${importCount}건\n- 기존 정보 업데이트: ${updateCount}건`);
        
      } catch (err) {
        console.error(err);
        alert("엑셀 파일을 파싱하는 도중 에러가 발생했습니다. 파일 형식을 확인해 주세요.");
      } finally {
        input.value = "";
      }
    };
    
    reader.readAsArrayBuffer(file);
  };

  // 이지폼 물품 엑셀 일괄 이관 처리기
  window.handleEasyFormProductExcel = function(input) {
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const reader = new FileReader();
    
    reader.onload = function(e) {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (rows.length < 2) {
          alert("가져올 물품 데이터가 엑셀 파일 내에 존재하지 않습니다.");
          input.value = "";
          return;
        }
        
        const headerRow = rows[0].map(cell => String(cell || '').trim().replace(/\s+/g, ''));
        
        function findColIndex(names) {
          return headerRow.findIndex(col => names.some(name => col.includes(name)));
        }
        
        const idxCode = findColIndex(['물품코드', '코드', '품목코드', '상품코드']);
        const idxName = findColIndex(['물품명', '물품명칭', '품목명', '상품명', '이름', '품명']);
        const idxUnit = findColIndex(['규격', '단위', '규격(단위)', '용량']);
        const idxOrigin = findColIndex(['원산지', '산지', '원산지명']);
        const idxPurchasePrice = findColIndex(['구매단가', '매입단가', '매입가', '구매가']);
        const idxSalesPrice = findColIndex(['판매단가', '매출단가', '매출가', '판매가', '단가']);
        const idxTaxType = findColIndex(['면세여부', '면세', '과세구분', '과세여부', '면세상품']);
        const idxStock = findColIndex(['현재재고', '재고', '수량', '재고수량', '적정재고']);
        
        if (idxName === -1) {
          alert("엑셀 파일 내에서 '물품명' 또는 '품목명' 열을 찾을 수 없습니다. 헤더명을 확인해 주세요.");
          input.value = "";
          return;
        }
        
        let importCount = 0;
        let updateCount = 0;
        
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;
          
          let pName = String(row[idxName] || '').trim();
          if (!pName) continue;
          
          let pCode = idxCode !== -1 ? String(row[idxCode] || '').trim() : '';
          let pUnit = idxUnit !== -1 ? String(row[idxUnit] || '').trim() : 'EA';
          let pOrigin = idxOrigin !== -1 ? String(row[idxOrigin] || '').trim() : '국내산';
          let pPurchasePrice = idxPurchasePrice !== -1 ? parseInt(String(row[idxPurchasePrice] || '').replace(/[^0-9]/g, '')) || 0 : 0;
          let pSalesPrice = idxSalesPrice !== -1 ? parseInt(String(row[idxSalesPrice] || '').replace(/[^0-9]/g, '')) || 0 : 0;
          let pRawTax = idxTaxType !== -1 ? String(row[idxTaxType] || '').trim() : '';
          let pStock = idxStock !== -1 ? parseInt(String(row[idxStock] || '').replace(/[^0-9]/g, '')) || 0 : 0;
          
          let pTaxType = '과세';
          if (pRawTax.includes('면세') || pRawTax === '1' || pRawTax.toLowerCase() === 'true' || pRawTax === 'Y' || pRawTax === 'y') {
            pTaxType = '면세';
          }
          
          let existingIndex = db.products.findIndex(p => p.name && p.name.trim() === pName);
          
          if (existingIndex !== -1) {
            const existing = db.products[existingIndex];
            existing.code = pCode || existing.code;
            existing.unit = pUnit || existing.unit;
            existing.origin = pOrigin || existing.origin;
            existing.purchasePrice = pPurchasePrice || existing.purchasePrice;
            existing.salesPrice = pSalesPrice || existing.salesPrice;
            existing.taxType = pTaxType || existing.taxType;
            existing.stock = pStock || existing.stock;
            updateCount++;
          } else {
            if (!pCode) {
              pCode = "PRD" + String(db.products.length + 1).padStart(3, '0');
            }
            db.products.push({
              code: pCode,
              name: pName,
              unit: pUnit,
              origin: pOrigin,
              purchasePrice: pPurchasePrice,
              salesPrice: pSalesPrice,
              taxType: pTaxType,
              stock: pStock
            });
            importCount++;
          }
        }
        
        saveDb();
        renderProducts();
        
        alert(`이지폼 물품 이관 완료!\n- 신규 등록: ${importCount}건\n- 기존 정보 업데이트: ${updateCount}건`);
        
      } catch (err) {
        console.error(err);
        alert("엑셀 파일을 파싱하는 도중 에러가 발생했습니다. 파일 형식을 확인해 주세요.");
      } finally {
        input.value = "";
      }
    };
    
    reader.readAsArrayBuffer(file);
  };

});
