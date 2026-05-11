import type { Metadata } from 'next'
import { Noto_Sans_KR } from 'next/font/google'
import './globals.css'
import { AudioProviderWrapper } from '@/components/AudioProviderWrapper'

const notoSansKR = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['400', '500', '700', '900'],
  variable: '--font-noto-sans-kr',
})

export const metadata: Metadata = {
  title: '퀴즈독 - 강아지와 함께하는 재미있는 퀴즈 게임',
  description: '강아지와 함께하는 재미있는 퀴즈 게임! 교실을 게임으로 바꿔보세요 🐕',
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
                    observer.disconnect();
                  }, 1000);
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
