# Framework & Library Research Report

> Research date: 2026-03-27
> Target: Household accounting web app

---

## 1. Next.js App Router (v16, latest stable)

### 1.1 Critical Breaking Change: middleware.ts -> proxy.ts

Next.js 16 (Oct 2025)에서 `middleware.ts`가 `proxy.ts`로 **rename** 되었다. 기능은 동일하지만 이름과 런타임이 변경됨.

- **파일명**: `proxy.ts` (프로젝트 루트 또는 `src/` 내)
- **export 함수명**: `proxy` (기존 `middleware` -> `proxy`)
- **런타임**: **Node.js** (Edge runtime 아님! 이전 middleware는 Edge가 기본이었음)
- `middleware.ts`는 아직 동작하지만 deprecated이며 향후 삭제 예정

```ts
// proxy.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  return NextResponse.redirect(new URL('/home', request.url))
}

export const config = {
  matcher: '/about/:path*',
}
```

마이그레이션 codemod 제공: `npx @next/codemod@canary upgrade latest`

### 1.2 Project Structure (v16.2.1)

```
src/
├── app/
│   ├── layout.tsx          # Root layout (필수)
│   ├── page.tsx            # / route
│   ├── loading.tsx         # Suspense fallback
│   ├── error.tsx           # Error boundary
│   ├── not-found.tsx       # 404 UI
│   ├── (auth)/             # Route group - URL에 미포함
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx      # Dashboard용 nested layout
│   │   ├── page.tsx
│   │   └── transactions/
│   │       ├── page.tsx
│   │       └── [id]/page.tsx
│   ├── api/                # Route Handlers
│   │   └── upload/
│   │       └── route.ts
│   └── auth/
│       └── callback/
│           └── route.ts    # OAuth callback
├── lib/
│   ├── supabase/
│   │   ├── client.ts       # Browser client
│   │   ├── server.ts       # Server client
│   │   └── proxy.ts        # Proxy용 client (token refresh)
│   └── utils.ts
├── components/
│   ├── ui/                 # 공통 UI 컴포넌트
│   └── features/           # Feature별 컴포넌트
└── proxy.ts                # Next.js Proxy (구 middleware)
```

**핵심 컨벤션:**
- `_folderName`: Private folder (라우팅에서 제외)
- `(folderName)`: Route group (URL 경로에 미포함, 레이아웃 분리용)
- `[param]`: Dynamic route segment
- route가 public이 되려면 반드시 `page.tsx` 또는 `route.ts`가 있어야 함

### 1.3 Server Components vs Client Components

**기본값은 Server Component.** `'use client'` 디렉티브를 명시해야만 Client Component가 됨.

| 기준 | Server Component | Client Component |
|------|-----------------|-----------------|
| 데이터 페칭 | DB, API 직접 호출 | fetch 또는 SWR/React Query |
| 시크릿 | 환경변수 사용 가능 | NEXT_PUBLIC_ prefix만 |
| JS 번들 | 클라이언트 번들에 미포함 | 포함 |
| useState/useEffect | 사용 불가 | 사용 가능 |
| onClick 등 이벤트 | 사용 불가 | 사용 가능 |
| browser API | 사용 불가 | localStorage, window 등 사용 가능 |

**핵심 패턴:**

1. **Server Component에서 데이터 fetch -> Client Component에 props로 전달**
```tsx
// app/transactions/page.tsx (Server Component)
import TransactionList from '@/components/features/TransactionList'
import { getTransactions } from '@/lib/data'

export default async function Page() {
  const transactions = await getTransactions()
  return <TransactionList initialData={transactions} />
}
```

2. **Client Component boundary를 최대한 작게 유지** (`'use client'`를 인터랙티브한 leaf 컴포넌트에만)

3. **Interleaving 패턴** - Client Component의 children으로 Server Component 전달 가능
```tsx
// Modal (Client) 안에 Cart (Server) 삽입 가능
<Modal>
  <Cart />  {/* Server Component */}
</Modal>
```

4. **Context Provider** - Client Component로 만들어서 layout에서 children 감싸기

5. **환경 오염 방지**: `server-only` / `client-only` 패키지로 잘못된 import 방지

### 1.4 Route Handlers (API Routes)

`app/api/` 디렉토리에 `route.ts` 파일로 생성. Web standard Request/Response API 사용.

```ts
// app/api/upload/route.ts
export async function POST(request: Request) {
  const formData = await request.formData()
  const file = formData.get('file') as File
  // Supabase Storage에 업로드하는 로직
  return Response.json({ success: true })
}
```

- Next.js 15+에서 GET Route Handler는 **기본적으로 캐시되지 않음** (v14는 캐시됨이 기본이었음)
- `zod-form-data`로 FormData 유효성 검사 권장

### 1.5 Proxy (Auth Protection)

```ts
// proxy.ts
import { updateSession } from '@/lib/supabase/proxy'
import { type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

**보안 주의사항:**
- Proxy에서는 **optimistic check만** (쿠키에서 세션 읽기)
- 실제 authorization은 각 Server Function/Route Handler 내에서 수행
- DB 조회는 성능 문제를 야기하므로 proxy에서 하지 않는 것이 원칙이나, Supabase의 `getClaims()`는 JWT 로컬 검증이므로 OK

### 1.6 Next.js 16 기타 주요 변경점

- **Turbopack이 기본 번들러** (webpack은 `--webpack` 플래그로 opt-out)
- **React 19.2**: View Transitions, `useEffectEvent()`, `<Activity/>`
- **Cache Components**: `"use cache"` 디렉티브 (opt-in)
- **React Compiler** 안정화 (자동 memoization, opt-in)
- **`params`, `searchParams`는 반드시 `await`** 필요 (async params)
- **`cookies()`, `headers()`, `draftMode()`도 async** 필요
- **Node.js 20.9+ 필수** (Node 18 지원 종료)
- **TypeScript 5+ 필수**

### 1.7 Image Upload Handling

가계부 앱에서 영수증 이미지 업로드 시 두 가지 접근:

**방법 1: Supabase Storage (권장)**
- 클라이언트에서 직접 Supabase Storage에 업로드
- RLS 정책으로 접근 제어
- 이미지 트랜스포메이션 지원 (Pro Plan)

**방법 2: Route Handler를 통한 중계**
```ts
// app/api/upload/route.ts
export async function POST(request: Request) {
  const formData = await request.formData()
  const file = formData.get('receipt') as File
  const buffer = Buffer.from(await file.arrayBuffer())
  // Supabase Storage에 업로드
}
```

---

## 2. Supabase with Next.js (@supabase/ssr)

### 2.1 Critical: API Key 변경

2025년 11월부터 새 프로젝트는 새로운 키 포맷 사용:
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_...`) - 기존 anon key 대체
- `SUPABASE_SECRET_KEY` (`sb_secret_...`) - 기존 service_role key 대체
- 기존 키와 동일한 방식으로 작동, 하위 호환성 유지

### 2.2 Client Creation Patterns (공식 예제 기반)

**Browser Client** (`lib/supabase/client.ts`):
```ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  )
}
```

**Server Client** (`lib/supabase/server.ts`):
```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Server Component에서 호출 시 무시 가능
            // proxy가 세션 refresh를 처리하므로
          }
        },
      },
    },
  )
}
```

**Proxy Client** (`lib/supabase/proxy.ts`):
```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // createServerClient와 getClaims() 사이에 코드를 넣지 말 것!
  const { data } = await supabase.auth.getClaims()
  const user = data?.claims

  if (
    !user &&
    !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/auth')
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // 반드시 supabaseResponse를 그대로 반환해야 함!
  return supabaseResponse
}
```

**핵심 규칙:**
- 반드시 `getAll()`과 `setAll()`만 사용 (`get`, `set`, `remove` 사용 금지)
- 클라이언트를 전역 변수에 저장하지 말 것 (매 요청마다 새로 생성)
- 서버 코드에서는 `getUser()`가 아닌 `getClaims()` 사용 권장 (JWT 로컬 검증, 더 빠름)
- `getUser()`는 매번 Auth 서버에 요청하므로 세션 무효화 확인이 필요한 경우에만 사용
- `getSession()`은 서버 코드에서 절대 신뢰하지 말 것

### 2.3 Google OAuth Setup

**Google Cloud Console:**
1. Google Auth Platform에서 OAuth 클라이언트 ID 생성 (Web application 타입)
2. Authorized JavaScript origins에 앱 URL 추가
3. Authorized redirect URIs에 Supabase 콜백 URL 추가
4. 필요 스코프: `openid`, `userinfo.email`, `userinfo.profile`

**Supabase Dashboard:**
- Authentication > Providers > Google에서 Client ID, Client Secret 설정
- Site URL 및 Redirect URLs 설정

**PKCE Flow 구현 (서버사이드, 권장):**
```ts
// login action
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: 'http://example.com/auth/callback',
  },
})
if (data.url) redirect(data.url)
```

**Callback Route Handler** (`app/auth/callback/route.ts`):
```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  let next = searchParams.get('next') ?? '/'

  if (!next.startsWith('/')) next = '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const forwardedHost = request.headers.get('x-forwarded-host')
      const isLocalEnv = process.env.NODE_ENV === 'development'

      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`)
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      } else {
        return NextResponse.redirect(`${origin}${next}`)
      }
    }
  }

  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
```

### 2.4 RLS Policy Patterns (가계부 앱용)

**기본 스키마 예시:**
```sql
-- 사용자별 가계부 테이블
create table transactions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null default auth.uid(),
  amount bigint not null,          -- 센트/원 단위 정수!
  currency text not null default 'KRW',
  category text,
  description text,
  transaction_date date not null default current_date,
  type text check (type in ('income', 'expense')) not null,
  receipt_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS 활성화 (필수!)
alter table transactions enable row level security;

-- SELECT: 본인 데이터만 조회
create policy "Users can view own transactions"
on transactions for select
to authenticated
using ( (select auth.uid()) = user_id );

-- INSERT: 본인으로만 생성 + null 체크
create policy "Users can insert own transactions"
on transactions for insert
to authenticated
with check (
  auth.uid() is not null
  and (select auth.uid()) = user_id
);

-- UPDATE: 본인 데이터만 수정
create policy "Users can update own transactions"
on transactions for update
to authenticated
using ( (select auth.uid()) = user_id )
with check ( (select auth.uid()) = user_id );

-- DELETE: 본인 데이터만 삭제
create policy "Users can delete own transactions"
on transactions for delete
to authenticated
using ( (select auth.uid()) = user_id );
```

**RLS 베스트 프랙티스:**
- `auth.uid()`를 `(select auth.uid())`로 감싸면 쿼리 플래너 캐싱에 유리
- `raw_user_meta_data`는 유저가 수정 가능하므로 인증 데이터로 사용 금지
- `raw_app_meta_data`는 서버에서만 수정 가능하므로 authorization 데이터에 적합
- 모든 exposed 스키마의 테이블에 RLS 반드시 활성화
- `TO` 절로 역할(authenticated, anon)을 명시하여 불필요한 policy 평가 방지

### 2.5 TypeScript Type Generation

```bash
# 리모트 DB에서 타입 생성
npx supabase gen types typescript --project-id <project-id> > lib/database.types.ts

# 로컬 DB에서 타입 생성
npx supabase gen types typescript --local > lib/database.types.ts
```

```ts
import { createClient } from '@/lib/supabase/server'
import { Database } from '@/lib/database.types'

// 타입 안전한 클라이언트
const supabase = await createClient()

// 자동 완성 및 타입 추론
const { data } = await supabase
  .from('transactions')
  .select('*')
  .eq('type', 'expense')
// data는 Database['public']['Tables']['transactions']['Row'][] 타입

// JSON 컬럼 커스텀 타입 (v2.48.0+)
// -> 및 ->> 연산자에서 타입 추론 가능
```

---

## 3. Tailwind CSS v4

### 3.1 핵심 패러다임 전환: CSS-First Configuration

v4의 가장 큰 변화는 **`tailwind.config.js` -> CSS 파일로 설정 이동**이다.

```css
/* app/globals.css */
@import "tailwindcss";

/* 커스텀 테마 확장 */
@theme {
  --color-primary: oklch(0.60 0.15 250);
  --color-expense: oklch(0.65 0.20 25);
  --color-income: oklch(0.70 0.18 150);
  --font-sans: 'Pretendard', system-ui, sans-serif;
  --breakpoint-3xl: 1920px;
}
```

- `@import "tailwindcss"` 한 줄로 시작 (`@tailwind` 디렉티브 불필요)
- `@theme` 디렉티브로 유틸리티 클래스 생성과 연결된 CSS 변수 정의
- `tailwind.config.js` 없이도 동작 (zero config)
- 내부적으로 Lightning CSS 사용, `@import` 규칙 번들링

### 3.2 @theme 네임스페이스

| 네임스페이스 | 생성되는 유틸리티 | 예시 |
|---|---|---|
| `--color-*` | `bg-*`, `text-*`, `border-*` 등 | `--color-primary: ...` |
| `--font-*` | `font-*` | `--font-sans: ...` |
| `--breakpoint-*` | `sm:`, `md:` 등 반응형 variant | `--breakpoint-sm: 40rem` |
| `--spacing-*` | `px-*`, `py-*`, `gap-*`, `w-*` 등 | `--spacing: 0.25rem` (기본 단위) |
| `--radius-*` | `rounded-*` | `--radius-lg: 0.5rem` |
| `--shadow-*` | `shadow-*` | `--shadow-card: ...` |
| `--animate-*` | `animate-*` | `--animate-fade-in: ...` |

**기본 테마 전체 교체:**
```css
@theme {
  --color-*: initial;  /* 기본 컬러 전부 제거 */
  --color-white: #fff;
  --color-primary: oklch(0.60 0.15 250);
  /* 필요한 색상만 정의 */
}
```

**기본 테마 전체 리셋:**
```css
@theme {
  --*: initial;  /* 모든 기본값 제거 */
  /* 처음부터 직접 정의 */
}
```

### 3.3 Dark Mode

**방법 1: System preference (기본값)**
```css
@import "tailwindcss";
/* 별도 설정 불필요 - prefers-color-scheme 미디어 쿼리 사용 */
```

**방법 2: Class-based (토글 제어)**
```css
@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));
```

**방법 3: data attribute**
```css
@import "tailwindcss";
@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *));
```

**시스템 감지 + 수동 토글 조합 (가장 흔한 패턴):**
```js
// class 기반 설정 시
document.documentElement.classList.toggle(
  'dark',
  localStorage.theme === 'dark' ||
    (!('theme' in localStorage) &&
      window.matchMedia('(prefers-color-scheme: dark)').matches)
)
```

**v4 새 기능: `color-scheme` 유틸리티**
- `scheme-light`, `scheme-dark`, `scheme-light-dark`
- 다크모드에서 스크롤바 등 브라우저 네이티브 UI 색상도 제어 가능

**권장: `next-themes` 라이브러리 사용** (공식 예제에서도 사용)

### 3.4 반응형 디자인

기본 breakpoint (변경 가능):
- `sm`: 40rem (640px)
- `md`: 48rem (768px)
- `lg`: 64rem (1024px)
- `xl`: 80rem (1280px)
- `2xl`: 96rem (1536px)

**Mobile-first 원칙 동일:**
```html
<!-- 모바일: 1열, md 이상: 2열, lg 이상: 3열 -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
```

### 3.5 v3 -> v4 마이그레이션 주요 변경

- `tailwind.config.js` -> CSS `@theme` (마이그레이션 도구 제공)
- `@tailwind base/components/utilities` -> `@import "tailwindcss"`
- `darkMode: 'class'` -> `@custom-variant dark (&:where(.dark, .dark *))`
- CSS 변수가 `--color-*` 네임스페이스로 자동 노출
- Cascade layers, `@property`, `color-mix()` 등 최신 CSS 기능 활용
- **마이그레이션 도구**: `npx @tailwindcss/upgrade` 로 대부분 자동 전환

---

## 4. TypeScript Strict Mode for Financial Data

### 4.1 핵심 원칙: 정수(integer) 기반 금액 처리

JavaScript의 `number`(IEEE 754)는 `0.1 + 0.2 !== 0.3` 문제가 있다. 가계부 앱에서는 **반드시** 부동소수점을 피해야 한다.

**방법 1: 최소 단위 정수 저장 (Stripe 방식, 가장 권장)**

```ts
// 금액을 원(또는 센트) 단위 정수로 처리
// DB 컬럼: amount bigint
// 1000원 = 1000 (KRW는 소수점 없음)
// $10.50 = 1050 cents (USD는 소수점 2자리)

type Currency = 'KRW' | 'USD' | 'JPY'

interface Money {
  /** 최소 통화 단위의 정수값 (KRW: 원, USD: 센트) */
  amount: bigint  // 또는 number (KRW 범위에서는 안전)
  currency: Currency
}

const CURRENCY_DECIMALS: Record<Currency, number> = {
  KRW: 0,
  JPY: 0,
  USD: 2,
}

function formatMoney(money: Money): string {
  const decimals = CURRENCY_DECIMALS[money.currency]
  const value = Number(money.amount) / Math.pow(10, decimals)
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: money.currency,
  }).format(value)
}

function addMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) {
    throw new Error('Currency mismatch')
  }
  return { amount: a.amount + b.amount, currency: a.currency }
}
```

**KRW 전용이라면 number도 안전**: KRW는 소수점이 없고, `Number.MAX_SAFE_INTEGER`(9,007,199,254,740,991)이면 약 9천조 원까지 안전하게 표현 가능. 그래도 bigint를 쓰는 것이 방어적.

**방법 2: Dinero.js (라이브러리)**

```ts
import { dinero, add, toDecimal } from 'dinero.js'
import { KRW } from '@dinero.js/currencies'

const price = dinero({ amount: 50000, currency: KRW })
const tax = dinero({ amount: 5000, currency: KRW })
const total = add(price, tax)

toDecimal(total) // "55000"
```

- 불변(immutable) 연산, tree-shakeable
- v2는 아직 alpha 상태 (2026년 기준)
- 프로덕션에서는 v1 또는 직접 정수 처리가 더 안정적

**방법 3: decimal.js (복잡한 계산이 필요할 때)**

```ts
import Decimal from 'decimal.js'

const a = new Decimal('0.1')
const b = new Decimal('0.2')
a.plus(b).toString() // "0.3" (정확)
```

### 4.2 DB 스키마와의 정합

```sql
-- PostgreSQL: bigint로 저장
create table transactions (
  id uuid primary key default gen_random_uuid(),
  amount bigint not null,        -- 최소 단위 정수
  currency text not null default 'KRW',
  -- ...
);
```

Supabase gen types가 `bigint` -> `number`로 매핑하는데, TypeScript에서 더 엄격하게 하려면:

```ts
// database.types.ts 생성 후 커스텀 타입으로 래핑
import { Database } from './database.types'

type TransactionRow = Database['public']['Tables']['transactions']['Row']

// Branded type으로 금액 타입 안전성 강화
type MoneyAmount = number & { readonly __brand: 'MoneyAmount' }

function toMoneyAmount(value: number): MoneyAmount {
  if (!Number.isInteger(value)) {
    throw new Error('Money amount must be an integer')
  }
  return value as MoneyAmount
}

interface TypedTransaction extends Omit<TransactionRow, 'amount'> {
  amount: MoneyAmount
}
```

### 4.3 Type-Safe Supabase Queries

```ts
import { Database } from '@/lib/database.types'

// 타입이 자동 추론됨
const { data, error } = await supabase
  .from('transactions')
  .select('id, amount, category, transaction_date, type')
  .gte('transaction_date', '2026-01-01')
  .order('transaction_date', { ascending: false })

// data: Pick<TransactionRow, 'id' | 'amount' | ...>[] | null

// Insert도 타입 체크
const { error: insertError } = await supabase
  .from('transactions')
  .insert({
    amount: 15000,
    category: 'food',
    type: 'expense',
    description: '점심',
    // user_id는 DB default (auth.uid())로 자동 설정
  })
```

---

## 5. 종합 아키텍처 권장사항

### 기술 스택 버전

| 기술 | 버전 | 비고 |
|------|------|------|
| Next.js | 16.x | proxy.ts, Turbopack 기본 |
| React | 19.2 | View Transitions, useEffectEvent |
| @supabase/ssr | latest | getClaims(), publishable key |
| @supabase/supabase-js | latest | v2.48.0+ JSON 타입 추론 |
| Tailwind CSS | 4.x | CSS-first config, @theme |
| TypeScript | 5.x+ | strict mode |
| Node.js | 20.9+ | Next.js 16 요구사항 |

### 주요 주의사항 요약

1. **middleware.ts -> proxy.ts**: Next.js 16에서 필수 마이그레이션
2. **@supabase/auth-helpers는 deprecated**: 반드시 `@supabase/ssr` 사용
3. **anon key -> publishable key**: 새 프로젝트는 새 키 포맷
4. **getClaims() > getUser()**: proxy/서버에서는 getClaims 우선 (성능)
5. **tailwind.config.js -> @theme**: v4에서 CSS-first 설정
6. **금액은 반드시 정수**: DB bigint + TypeScript integer 검증
7. **async params/cookies**: Next.js 16에서 반드시 await 필요

---

## Sources

### Next.js
- [App Router Docs](https://nextjs.org/docs/app)
- [Project Structure](https://nextjs.org/docs/app/getting-started/project-structure)
- [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)
- [Route Handlers and Middleware](https://nextjs.org/docs/15/app/getting-started/route-handlers-and-middleware)
- [Next.js 16 Blog Post](https://nextjs.org/blog/next-16)
- [Proxy (formerly Middleware)](https://nextjs.org/docs/app/getting-started/proxy)
- [Authentication Guide](https://nextjs.org/docs/app/guides/authentication)
- [Middleware to Proxy Migration](https://nextjs.org/docs/messages/middleware-to-proxy)

### Supabase
- [Setting up Server-Side Auth for Next.js](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [Creating a Supabase Client for SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- [Login with Google](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Generating TypeScript Types](https://supabase.com/docs/guides/api/rest/generating-types)
- [API Key Changes Discussion](https://github.com/orgs/supabase/discussions/29260)
- [getClaims vs getUser](https://supabase.com/docs/reference/javascript/auth-getclaims)
- [Storage Buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals)

### Tailwind CSS
- [Tailwind CSS v4.0 Announcement](https://tailwindcss.com/blog/tailwindcss-v4)
- [Dark Mode](https://tailwindcss.com/docs/dark-mode)
- [Theme Variables](https://tailwindcss.com/docs/theme)
- [Upgrade Guide](https://tailwindcss.com/docs/upgrade-guide)
- [color-scheme Utilities](https://tailwindcss.com/docs/color-scheme)

### TypeScript/Money
- [Building a Type-Safe Money Library](https://dev.to/thesmilingsloth/building-a-type-safe-money-handling-library-in-typescript-3o44)
- [Dinero.js](https://github.com/dinerojs/dinero.js)
- [Financial Precision in JavaScript](https://dev.to/benjamin_renoux/financial-precision-in-javascript-handle-money-without-losing-a-cent-1chc)

### Code Reference
- [Vercel/Next.js with-supabase example](https://github.com/vercel/next.js/tree/canary/examples/with-supabase) - proxy.ts 패턴 포함
