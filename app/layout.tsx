import type { Metadata } from 'next'
import { Noto_Sans_KR } from 'next/font/google'
import {
  GOOGLE_SITE_VERIFICATION,
  NAVER_SITE_VERIFICATION,
  SITE_DESCRIPTION,
  SITE_KEYWORDS,
  SITE_NAME,
  SITE_TITLE,
  SITE_URL,
} from '@/lib/seo/site'
import './globals.css'
import { AudioProviderWrapper } from '@/components/AudioProviderWrapper'
import { AuthProvider } from '@/contexts/AuthContext'
import { ConfirmDialogProvider } from '@/components/ui/ConfirmDialog'
import { Toaster } from '@/components/ui/Toaster'

const notoSansKR = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['400', '500', '700', '900'],
  variable: '--font-noto-sans-kr',
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  // 하위 페이지는 자기 제목만 정하면 "제목 | 퀴즈독" 형태로 붙는다.
  title: {
    default: SITE_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  applicationName: SITE_NAME,
  authors: [{ name: '위드현 에듀테크' }],
  creator: '위드현 에듀테크',
  publisher: '위드현 에듀테크',
  icons: {
    icon: '/icon.svg',
  },
  // 배포 도메인이 여러 개(vercel.app 등)여도 검색 결과가 quizdog.kr 하나로 모이게 한다.
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  // 서치콘솔·서치어드바이저에서 받은 소유확인 코드를 환경변수로 넣으면 자동으로 메타태그가 붙는다.
  verification: {
    google: GOOGLE_SITE_VERIFICATION || undefined,
    other: NAVER_SITE_VERIFICATION ? { 'naver-site-verification': NAVER_SITE_VERIFICATION } : {},
  },
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    url: SITE_URL,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: '퀴즈독' }],
    locale: 'ko_KR',
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ['/og-image.png'],
  },
}

/**
 * 검색엔진에 "퀴즈독"이라는 이름과 이 사이트를 연결해 주는 구조화 데이터.
 * 구글이 브랜드명 검색 결과(사이트링크·지식패널)를 만들 때 참고한다.
 */
const structuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: SITE_NAME,
      alternateName: ['QuizDog', '퀴즈 독'],
      legalName: '위드현 에듀테크',
      url: SITE_URL,
      logo: `${SITE_URL}/og-image.png`,
      description: SITE_DESCRIPTION,
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      name: SITE_NAME,
      alternateName: 'QuizDog',
      url: SITE_URL,
      inLanguage: 'ko-KR',
      publisher: { '@id': `${SITE_URL}/#organization` },
    },
    {
      '@type': 'WebApplication',
      '@id': `${SITE_URL}/#webapp`,
      name: SITE_NAME,
      url: SITE_URL,
      applicationCategory: 'EducationalApplication',
      operatingSystem: '웹 브라우저',
      inLanguage: 'ko-KR',
      publisher: { '@id': `${SITE_URL}/#organization` },
    },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko" className={notoSansKR.variable} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                var dynamicApiMessages = [
                  'params are being enumerated. \`params\` is a Promise',
                  'The keys of \`searchParams\` were accessed directly. \`searchParams\` is a Promise',
                  'A searchParam property was accessed directly with \`searchParams.',
                  '\`searchParams\` is a Promise and must be unwrapped'
                ];

                function argsToText(args) {
                  return Array.prototype.slice.call(args).map(function (arg) {
                    if (typeof arg === 'string') return arg;
                    if (arg && typeof arg.message === 'string') return arg.message;
                    return '';
                  }).join('\\n');
                }

                // 일부 브라우저 확장이 하이드레이션 직전에 style="user-select:auto"를 주입한다.
                // 앱이 막을 수 없는 외부 변형이라 이 조합의 경고만 걸러낸다.
                // (user-select와 무관한 진짜 하이드레이션 불일치는 그대로 표시된다.)
                function isExtensionUserSelectHydrationNoise(args) {
                  var text = argsToText(args);
                  if (text.indexOf('user-select') === -1) return false;
                  return (
                    text.indexOf('hydrat') !== -1 ||
                    text.indexOf("didn't match") !== -1 ||
                    text.indexOf('did not match') !== -1
                  );
                }

                function isDynamicApiInspectorNoise(args) {
                  var text = argsToText(args);

                  if (!dynamicApiMessages.some(function (message) { return text.indexOf(message) !== -1; })) {
                    return false;
                  }

                  return (
                    text.indexOf('must be unwrapped') !== -1 ||
                    text.indexOf('Object.keys') !== -1 ||
                    text.indexOf('serializeValue') !== -1 ||
                    text.indexOf('getReactComponentInfo') !== -1 ||
                    text.indexOf('mousemoveListener') !== -1 ||
                    text.indexOf('clickListener') !== -1 ||
                    text.indexOf('buildDOMTree') !== -1
                  );
                }

                function wrapConsoleMethod(method) {
                  var current = console[method];
                  if (!current || current.__quizDogDynamicApiPatched) return;

                  var patched = function () {
                    if (isDynamicApiInspectorNoise(arguments)) return;
                    if (isExtensionUserSelectHydrationNoise(arguments)) return;
                    return current.apply(console, arguments);
                  };
                  patched.__quizDogDynamicApiPatched = true;
                  console[method] = patched;
                }

                function installConsoleFilters() {
                  wrapConsoleMethod('error');
                  wrapConsoleMethod('warn');
                }

                installConsoleFilters();
                var consoleFilterTimer = window.setInterval(installConsoleFilters, 50);

                window.addEventListener('error', function (event) {
                  if (event && isDynamicApiInspectorNoise([event.message || ''])) {
                    event.preventDefault();
                    return false;
                  }
                }, true);

                // style을 CSSOM(node.style.*)으로 건드리면 브라우저가 속성 값 전체를
                // 정규화한다(예: #d9eef5 -> rgb(217, 238, 245)). 그러면 하이드레이션 직전에
                // 서버 HTML과 값이 달라져 React가 mismatch를 띄운다.
                // 따라서 다른 선언의 원본 표기를 그대로 두도록 문자열로만 제거한다.
                function removeInjectedUserSelect(root) {
                  if (!root || root.nodeType !== 1) return;
                  var nodes = [root];
                  if (root.querySelectorAll) {
                    nodes = nodes.concat(Array.prototype.slice.call(root.querySelectorAll('[style*="user-select"]')));
                  }

                  for (var i = 0; i < nodes.length; i += 1) {
                    var node = nodes[i];
                    if (!node.getAttribute) continue;

                    var raw = node.getAttribute('style');
                    if (!raw || raw.indexOf('user-select') === -1) continue;

                    var kept = [];
                    var parts = raw.split(';');
                    for (var j = 0; j < parts.length; j += 1) {
                      var decl = parts[j];
                      if (!decl || !decl.trim()) continue;

                      var sep = decl.indexOf(':');
                      if (sep === -1) { kept.push(decl); continue; }

                      var name = decl.slice(0, sep).trim().toLowerCase();
                      var value = decl.slice(sep + 1).trim().toLowerCase();
                      var isUserSelect = name === 'user-select'
                        || name === '-webkit-user-select'
                        || name === '-moz-user-select'
                        || name === '-ms-user-select';

                      // 주입된 'auto'만 제거하고 나머지는 원문 그대로 유지
                      if (isUserSelect && value === 'auto') continue;
                      kept.push(decl);
                    }

                    var cleaned = kept.join(';').trim();
                    if (cleaned === raw.trim()) continue;
                    if (cleaned === '') node.removeAttribute('style');
                    else node.setAttribute('style', cleaned);
                  }
                }

                removeInjectedUserSelect(document.documentElement);

                var observer = new MutationObserver(function (mutations) {
                  for (var i = 0; i < mutations.length; i += 1) {
                    var mutation = mutations[i];
                    if (mutation.type === 'attributes') {
                      removeInjectedUserSelect(mutation.target);
                    } else if (mutation.type === 'childList') {
                      mutation.addedNodes.forEach(removeInjectedUserSelect);
                    }
                  }
                });

                observer.observe(document.documentElement, {
                  attributes: true,
                  attributeFilter: ['style'],
                  childList: true,
                  subtree: true
                });

                // 확장 프로그램은 보통 DOM 파싱이 끝난 뒤 주입한다.
                // 하이드레이션 전에 한 번 더 훑어 남아 있는 주입을 걷어낸다.
                function sweepInjectedUserSelect() {
                  removeInjectedUserSelect(document.documentElement);
                  if (document.body) removeInjectedUserSelect(document.body);
                }
                document.addEventListener('DOMContentLoaded', sweepInjectedUserSelect);
                document.addEventListener('readystatechange', sweepInjectedUserSelect);

                window.addEventListener('load', function () {
                  window.setTimeout(function () {
                    window.clearInterval(consoleFilterTimer);
                    installConsoleFilters();
                    observer.disconnect();
                  }, 3000);
                }, { once: true });
              })();
            `,
          }}
        />
        {/* 검색엔진용 구조화 데이터 (브랜드명 "퀴즈독" ↔ 이 사이트 연결) */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </head>
      <body className="antialiased">
        <AuthProvider>
          <ConfirmDialogProvider>
            <AudioProviderWrapper>{children}</AudioProviderWrapper>
            {/* 앱 전역 토스트 — 학생 화면(로비/게임)에서도 동작해야 하므로 루트에 마운트 */}
            <Toaster />
          </ConfirmDialogProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
