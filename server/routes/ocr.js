const express = require('express');
const router = express.Router();
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const { authMiddleware } = require('../middleware/authMiddleware');

// 메모리 스토리지에 파일 보관
const upload = multer({ storage: multer.memoryStorage() });

router.use(authMiddleware);

// Y축 범위 오차 한계를 이용해 흩어진 단어들을 하나의 가로 행(Line)으로 묶는 알고리즘
function reconstructLines(fields) {
  if (!fields || fields.length === 0) return [];
  
  // boundingPoly의 좌상단 y축 좌표 기준으로 정렬
  const sorted = [...fields].sort((a, b) => {
    const yA = a.boundingPoly.vertices[0].y;
    const yB = b.boundingPoly.vertices[0].y;
    return yA - yB;
  });
  
  const lines = [];
  let currentLine = [];
  let currentY = -999;
  const Y_THRESHOLD = 12; // 12픽셀 내외의 단어는 같은 행으로 취급
  
  for (const field of sorted) {
    const y = field.boundingPoly.vertices[0].y;
    const x = field.boundingPoly.vertices[0].x;
    
    if (currentLine.length === 0) {
      currentLine.push({ x, text: field.inferText });
      currentY = y;
    } else if (Math.abs(y - currentY) <= Y_THRESHOLD) {
      currentLine.push({ x, text: field.inferText });
    } else {
      // 줄바꿈 발생: 기존 라인은 X축 기준으로 정렬하여 가로 글자 조합
      currentLine.sort((a, b) => a.x - b.x);
      lines.push(currentLine.map(item => item.text).join(" "));
      
      // 새 라인 시작
      currentLine = [{ x, text: field.inferText }];
      currentY = y;
    }
  }
  
  if (currentLine.length > 0) {
    currentLine.sort((a, b) => a.x - b.x);
    lines.push(currentLine.map(item => item.text).join(" "));
  }
  
  return lines;
}

// OCR 텍스트 라인 파싱 로직
function parseOcrText(text, lines) {
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
  let invoiceDate = new Date().toISOString().substring(0, 10);
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
      
      // 대안 매칭 (순서 꼬였을 때 보완)
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
  
  return {
    bizNo,
    partnerName,
    invoiceDate,
    items: parsedItems
  };
}

// 클라우드 고성능 OCR API 연동 엔드포인트
router.post('/scan', upload.single('file'), async (req, res) => {
  const ocrApiUrl = process.env.CLOVA_OCR_API_URL;
  const ocrSecretKey = process.env.CLOVA_OCR_SECRET_KEY;

  if (!req.file) {
    return res.status(400).json({ error: "분석할 이미지 파일이 누락되었습니다." });
  }

  // Clova OCR API 설정이 없는 경우 프론트엔드 Tesseract 폴백 지시
  if (!ocrApiUrl || !ocrSecretKey) {
    return res.json({
      success: false,
      fallback: true,
      message: "서버에 고성능 OCR 환경변수(CLOVA_OCR_API_URL)가 설정되어 있지 않아, 로컬 Tesseract.js 모드로 가동합니다."
    });
  }

  try {
    const form = new FormData();
    const jsonMessage = JSON.stringify({
      images: [{
        format: req.file.mimetype.split('/')[1] || 'jpg',
        name: 'invoice'
      }],
      requestId: 'smart-erp-' + Date.now(),
      version: 'V2',
      timestamp: Date.now()
    });

    form.append('message', jsonMessage);
    form.append('file', req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype
    });

    // 네이버 클로바 OCR API 호출
    const response = await axios.post(ocrApiUrl, form, {
      headers: {
        'X-OCR-SECRET': ocrSecretKey,
        ...form.getHeaders()
      },
      timeout: 10000 // 10초 타임아웃
    });

    if (!response.data || !response.data.images || response.data.images.length === 0) {
      throw new Error("올바르지 않은 OCR 응답 데이터 구조입니다.");
    }

    const ocrImage = response.data.images[0];
    if (ocrImage.uid && ocrImage.fields) {
      // 1. 단어들로 나누어진 텍스트를 Y축 기반 행(Line)으로 복원
      const lines = reconstructLines(ocrImage.fields);
      const fullText = lines.join('\n');

      // 2. 복원된 텍스트와 가로행들로 품목 및 거래처 추출
      const parsedData = parseOcrText(fullText, lines);

      return res.json({
        success: true,
        fallback: false,
        bizNo: parsedData.bizNo,
        partnerName: parsedData.partnerName,
        invoiceDate: parsedData.invoiceDate,
        items: parsedData.items,
        rawText: fullText
      });
    } else {
      throw new Error("OCR 판독 결과 문자 정보(fields)가 없습니다.");
    }
  } catch (err) {
    console.error("Clova OCR API Error:", err.message);
    res.json({
      success: false,
      fallback: true,
      message: "클라우드 OCR API 통신에 실패하여 로컬 Tesseract.js 모드로 전환합니다."
    });
  }
});

module.exports = router;
