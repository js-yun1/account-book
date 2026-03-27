/**
 * 기본 계정과목 및 카테고리 템플릿 정의.
 * DB 시드(seed_default_accounts SQL 함수)와 동기화 필요.
 * 이 파일은 클라이언트에서 온보딩 UI 등에 참조용으로 사용.
 */

export const DEFAULT_EXPENSE_ACCOUNTS = [
  { code: "5100", name: "요리" },
  { code: "5200", name: "외식" },
  { code: "5300", name: "주거" },
  { code: "5400", name: "교통" },
  { code: "5500", name: "건강" },
  { code: "5600", name: "여가" },
  { code: "5700", name: "쇼핑" },
  { code: "5800", name: "교육" },
  { code: "5900", name: "경조사" },
  { code: "5950", name: "통신" },
  { code: "5960", name: "보험" },
  { code: "5970", name: "세금" },
  { code: "5980", name: "기타" },
] as const;

export const DEFAULT_INCOME_ACCOUNTS = [
  { code: "4100", name: "근로소득" },
  { code: "4200", name: "부수입" },
  { code: "4300", name: "투자수익" },
] as const;

export const DEFAULT_CATEGORIES = [
  "식료품",
  "생활용품",
  "의류",
  "전자제품",
  "가구/인테리어",
  "의료/약품",
  "교육/도서",
  "문화/여가",
  "교통/주유",
  "공과금",
  "기타",
] as const;
