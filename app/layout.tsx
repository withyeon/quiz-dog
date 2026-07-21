import type { Metadata } from 'next'
import { Noto_Sans_KR } from 'next/font/google'
import './globals.css'
import { AudioProviderWrapper } from '@/components/AudioProviderWrapper'
import { AuthProvider } from '@/contexts/AuthContext'
import { ToastProvider } from '@/components/ui/Toast'
import { ConfirmDialogProvider } from '@/components/ui/ConfirmDialog'

const notoSansKR = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['400', '500', '700', '900'],
  variable: '--font-noto-sans-kr',
})

// 배포 도메인. 실제 도메인으로 NEXT_PUBLIC_SITE_URL 환경변수를 설정하면 OG 이미지가 절대경로로 노출됩니다.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://quizdog.app'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: '퀴즈독 - 강아지와 함께하는 재미있는 퀴즈 게임',
  description: '강아지와 함께하는 재미있는 퀴즈 게임! 교실을 게임으로 바꿔보세요 🐕',
  icons: {
    icon: '/icon.svg',
  },
  openGraph: {
    type: 'website',
    siteName: '퀴즈독',
    title: '퀴즈독 - 강아지와 함께하는 재미있는 퀴즈 게임',
    description: '강아지와 함께하는 재미있는 퀴즈 게임! 교실을 게임으로 바꿔보세요 🐕',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: '퀴즈독' }],
    locale: 'ko_KR',
  },
  twitter: {
    card: 'summary_large_image',
    title: '퀴즈독 - 강아지와 함께하는 재미있는 퀴즈 게임',
    description: '강아지와 함께하는 재미있는 퀴즈 게임! 교실을 게임으로 바꿔보세요 🐕',
    images: ['/og-image.png'],
  },
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
      </head>
      <body className="antialiased">
        <AuthProvider>
          <ToastProvider>
            <ConfirmDialogProvider>
              <AudioProviderWrapper>{children}</AudioProviderWrapper>
            </ConfirmDialogProvider>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
