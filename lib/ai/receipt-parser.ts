/**
 * 멀티모달 LLM을 이용한 영수증 파싱.
 * 사용자의 API 키를 서버사이드에서 사용.
 */

export interface ParsedReceiptItem {
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface ParsedReceipt {
  store_name: string;
  date: string;
  items: ParsedReceiptItem[];
  total: number;
  payment_method: string | null;
}

const RECEIPT_PROMPT = `이 영수증 이미지에서 정보를 추출해주세요. 반드시 아래 JSON 형식으로만 응답하세요:

{
  "store_name": "상호명",
  "date": "YYYY-MM-DD",
  "items": [
    {"name": "품목명", "quantity": 1, "unit_price": 금액, "total_price": 금액}
  ],
  "total": 합계금액,
  "payment_method": "결제수단 또는 null"
}

- 날짜는 YYYY-MM-DD 형식
- 금액은 숫자만 (원 단위, 통화기호 제외)
- 읽을 수 없는 항목은 최대한 추정하되, 불가능하면 "unknown"으로`;

export async function parseReceiptWithAI(
  imageBase64: string,
  mediaType: string,
  apiKey: string,
  provider: "anthropic" | "openai"
): Promise<ParsedReceipt> {
  if (provider === "anthropic") {
    return parseWithClaude(imageBase64, mediaType, apiKey);
  }
  return parseWithOpenAI(imageBase64, mediaType, apiKey);
}

async function parseWithClaude(
  imageBase64: string,
  mediaType: string,
  apiKey: string
): Promise<ParsedReceipt> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5-20250514",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: imageBase64 },
            },
            { type: "text", text: RECEIPT_PROMPT },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || "Claude API 호출 실패");
  }

  const result = await response.json();
  const text = result.content?.[0]?.text || "";
  return extractJSON(text);
}

async function parseWithOpenAI(
  imageBase64: string,
  mediaType: string,
  apiKey: string
): Promise<ParsedReceipt> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: `data:${mediaType};base64,${imageBase64}` },
            },
            { type: "text", text: RECEIPT_PROMPT },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || "OpenAI API 호출 실패");
  }

  const result = await response.json();
  const text = result.choices?.[0]?.message?.content || "";
  return extractJSON(text);
}

function extractJSON(text: string): ParsedReceipt {
  // JSON 블록 추출 (```json ... ``` 또는 순수 JSON)
  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/);
  if (!jsonMatch) throw new Error("영수증 파싱 결과에서 JSON을 찾을 수 없습니다");

  const parsed = JSON.parse(jsonMatch[1]);
  return {
    store_name: parsed.store_name || "알 수 없음",
    date: parsed.date || new Date().toISOString().split("T")[0],
    items: (parsed.items || []).map((item: Record<string, unknown>) => ({
      name: String(item.name || ""),
      quantity: Number(item.quantity) || 1,
      unit_price: Number(item.unit_price) || 0,
      total_price: Number(item.total_price) || 0,
    })),
    total: Number(parsed.total) || 0,
    payment_method: parsed.payment_method || null,
  };
}
