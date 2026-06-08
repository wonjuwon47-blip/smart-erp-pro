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
  let currentHeight = 0;
  
  for (const field of sorted) {
    const vertices = field.boundingPoly.vertices;
    const y = vertices[0].y;
    const x = vertices[0].x;
    const h = (vertices[2] && vertices[0]) ? (vertices[2].y - vertices[0].y) : 15;
    
    // Y축 임계값: 단어 높이의 50%를 기준으로 하되, 최소 12픽셀 보장
    const threshold = Math.max(12, h * 0.5);
    
    if (currentLine.length === 0) {
      currentLine.push({ x, text: field.inferText });
      currentY = y;
      currentHeight = h;
    } else if (Math.abs(y - currentY) <= Math.max(threshold, Math.max(12, currentHeight * 0.5))) {
      currentLine.push({ x, text: field.inferText });
    } else {
      // 줄바꿈 발생: 기존 라인은 X축 기준으로 정렬하여 가로 글자 조합
      currentLine.sort((a, b) => a.x - b.x);
      lines.push(currentLine.map(item => item.text).join(" "));
      
      // 새 라인 시작
      currentLine = [{ x, text: field.inferText }];
      currentY = y;
      currentHeight = h;
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
    const noSpaceLine = line.replace(/\s+/g, "");
    if (noSpaceLine.includes("상호") || noSpaceLine.includes("공급자") || noSpaceLine.includes("상호명")) {
      let lineForPartner = line;
      const rxRecipient = /공\s*급\s*받\s*는\s*\s*자|공\s*급\s*받\s*는\s*자/;
      if (rxRecipient.test(line)) {
        lineForPartner = line.split(rxRecipient)[0];
      }
      
      const clean = lineForPartner
        .replace(/공\s*급\s*자/g, "")
        .replace(/상\s*호\s*명/g, "")
        .replace(/상\s*호/g, "")
        .replace(/[:(]/g, "")
        .trim();
        
      const parts = clean.split(/\s+/).filter(p => p.length > 1);
      if (parts[0]) {
        partnerName = parts[0];
        break;
      }
    }
  }
  
  if (!partnerName) {
    // 공급받는자 키워드가 라인에 있는 경우 상호명 추출에서 제외
    for (let i = 0; i < Math.min(lines.length, 12); i++) {
      const line = lines[i];
      const noSpaceLine = line.replace(/\s+/g, "");
      if (noSpaceLine.includes("공급받는자")) continue;
      
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
        
        // 품목명 토큰 배열의 끝에서부터 단위/규격 성격의 토큰들을 제거
        while (nameTokens.length > 0) {
          const lastToken = nameTokens[nameTokens.length - 1];
          const cleanLast = lastToken.toUpperCase();
          
          const isUnit = 
            /^(EA|BOX|KG|PK|BAG|BTL|CAN|G)$/.test(cleanLast) ||
            /^(EA|BOX|KG|PK|BAG|BTL|CAN|G)\(.*\)$/.test(cleanLast) ||
            /^\(.*\)$/.test(cleanLast) ||
            /^\d+(KG|G|MM|EA|BOX)$/.test(cleanLast);
            
          if (isUnit) {
            nameTokens.pop();
          } else {
            break;
          }
        }
        
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
