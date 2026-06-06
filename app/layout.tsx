import type { Metadata } from 'next'
import { Noto_Sans_KR } from 'next/font/google'
import './globals.css'
import { AudioProviderWrapper } from '@/components/AudioProviderWrapper'

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

                function isDynamicApiInspectorNoise(args) {
                  var text = Array.prototype.slice.call(args).map(function (arg) {
                    if (typeof arg === 'string') return arg;
                    if (arg && typeof arg.message === 'string') return arg.message;
                    return '';
                  }).join('\\n');

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

                function removeInjectedUserSelect(root) {
                  if (!root || root.nodeType !== 1) return;
                  var nodes = [root];
                  if (root.querySelectorAll) {
                    nodes = nodes.concat(Array.prototype.slice.call(root.querySelectorAll('[style*="user-select"]')));
                  }

                  for (var i = 0; i < nodes.length; i += 1) {
                    var node = nodes[i];
                    if (!node.style) continue;
                    if (node.style.userSelect === 'auto') node.style.removeProperty('user-select');
                    if (node.style.webkitUserSelect === 'auto') node.style.removeProperty('-webkit-user-select');
                    if (node.getAttribute('style') === '') node.removeAttribute('style');
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
        <AudioProviderWrapper>{children}</AudioProviderWrapper>
      </body>
    </html>
  )
}
