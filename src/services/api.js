import axios from 'axios';

// API 인스턴스 생성 (동일 오리진 배포이므로 relative path 사용)
const apiClient = axios.create({
  baseURL: '',
  headers: {
    'Content-Type': 'application/json'
  }
});

// 요청 인터셉터: 로컬 스토리지에 토큰이 있을 경우 항상 인증 헤더 주입
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('smart_erp_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 응답 인터셉터: 401 Unauthorized 감지 시 강제 로그아웃 처리
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      console.warn("세션 만료 또는 유효하지 않은 토큰 감지. 자동 로그아웃을 실시합니다.");
      localStorage.removeItem('smart_erp_token');
      localStorage.removeItem('smart_erp_user');
      // SPA 라우팅 또는 화면 리로드 유도
      window.dispatchEvent(new Event('auth-expired'));
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: async (username, password) => {
    const res = await apiClient.post('/api/auth/login', { username, password });
    if (res.data.success && res.data.token) {
      localStorage.setItem('smart_erp_token', res.data.token);
      localStorage.setItem('smart_erp_user', JSON.stringify(res.data.user));
    }
    return res.data;
  },
  register: async (username, password, companyName, name) => {
    const res = await apiClient.post('/api/auth/register', { username, password, companyName, name });
    return res.data;
  },
  me: async () => {
    const res = await apiClient.get('/api/auth/me');
    return res.data;
  },
  logout: () => {
    localStorage.removeItem('smart_erp_token');
    localStorage.removeItem('smart_erp_user');
  }
};

export const partnerApi = {
  getAll: async () => {
    const res = await apiClient.get('/api/erp/partners');
    return res.data;
  },
  create: async (partnerData) => {
    const res = await apiClient.post('/api/erp/partners', partnerData);
    return res.data;
  },
  update: async (id, partnerData) => {
    const res = await apiClient.put(`/api/erp/partners/${id}`, partnerData);
    return res.data;
  },
  delete: async (id) => {
    const res = await apiClient.delete(`/api/erp/partners/${id}`);
    return res.data;
  }
};

export const productApi = {
  getAll: async () => {
    const res = await apiClient.get('/api/erp/products');
    return res.data;
  },
  create: async (productData) => {
    const res = await apiClient.post('/api/erp/products', productData);
    return res.data;
  },
  update: async (id, productData) => {
    const res = await apiClient.put(`/api/erp/products/${id}`, productData);
    return res.data;
  },
  delete: async (id) => {
    const res = await apiClient.delete(`/api/erp/products/${id}`);
    return res.data;
  }
};

export const invoiceApi = {
  getAll: async (type) => {
    const params = type ? { type } : {};
    const res = await apiClient.get('/api/erp/invoices', { params });
    return res.data;
  },
  getById: async (id) => {
    const res = await apiClient.get(`/api/erp/invoices/${id}`);
    return res.data;
  },
  create: async (invoiceData) => {
    const res = await apiClient.post('/api/erp/invoices', invoiceData);
    return res.data;
  },
  update: async (id, invoiceData) => {
    const res = await apiClient.put(`/api/erp/invoices/${id}`, invoiceData);
    return res.data;
  },
  delete: async (id) => {
    const res = await apiClient.delete(`/api/erp/invoices/${id}`);
    return res.data;
  }
};

export const ocrApi = {
  scan: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.post('/api/ocr/scan', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return res.data;
  }
};

export const hqApi = {
  getAll: async () => {
    const res = await apiClient.get('/api/erp/headquarters');
    return res.data;
  },
  create: async (data) => {
    const res = await apiClient.post('/api/erp/headquarters', data);
    return res.data;
  },
  update: async (id, data) => {
    const res = await apiClient.put(`/api/erp/headquarters/${id}`, data);
    return res.data;
  },
  delete: async (id) => {
    const res = await apiClient.delete(`/api/erp/headquarters/${id}`);
    return res.data;
  }
};

export const employeeApi = {
  getAll: async () => {
    const res = await apiClient.get('/api/erp/employees');
    return res.data;
  },
  create: async (data) => {
    const res = await apiClient.post('/api/erp/employees', data);
    return res.data;
  },
  delete: async (id) => {
    const res = await apiClient.delete(`/api/erp/employees/${id}`);
    return res.data;
  }
};

export const bankApi = {
  getAll: async () => {
    const res = await apiClient.get('/api/erp/banks');
    return res.data;
  },
  create: async (data) => {
    const res = await apiClient.post('/api/erp/banks', data);
    return res.data;
  },
  delete: async (id) => {
    const res = await apiClient.delete(`/api/erp/banks/${id}`);
    return res.data;
  }
};

export const estimateApi = {
  getAll: async () => {
    const res = await apiClient.get('/api/erp/estimates');
    return res.data;
  },
  getById: async (id) => {
    const res = await apiClient.get(`/api/erp/estimates/${id}`);
    return res.data;
  },
  create: async (data) => {
    const res = await apiClient.post('/api/erp/estimates', data);
    return res.data;
  },
  update: async (id, data) => {
    const res = await apiClient.put(`/api/erp/estimates/${id}`, data);
    return res.data;
  },
  delete: async (id) => {
    const res = await apiClient.delete(`/api/erp/estimates/${id}`);
    return res.data;
  }
};

export const receivablesApi = {
  getAll: async () => {
    const res = await apiClient.get('/api/erp/receivables-payments');
    return res.data;
  },
  update: async (data) => {
    const res = await apiClient.post('/api/erp/receivables-payments', data);
    return res.data;
  }
};

export const settingsApi = {
  get: async () => {
    const res = await apiClient.get('/api/erp/settings');
    return res.data;
  },
  save: async (data) => {
    const res = await apiClient.post('/api/erp/settings', data);
    return res.data;
  }
};

export const backupApi = {
  export: async () => {
    const res = await apiClient.get('/api/erp/backup/export');
    return res.data;
  },
  import: async (data) => {
    const res = await apiClient.post('/api/erp/backup/import', data);
    return res.data;
  },
  reset: async () => {
    const res = await apiClient.post('/api/erp/backup/reset');
    return res.data;
  }
};

export default apiClient;
