import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Allied | Grupo J.Macedo",
  description: "Sistema de controle - Grupo J.Macedo Eletrônica / Allied",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (localStorage.getItem('allied-tema') === 'light') {
                  document.documentElement.classList.add('light');
                }
                if (localStorage.getItem('allied-cor-padrao') === '0') {
                  var accent = localStorage.getItem('allied-cor-accent');
                  var accent2 = localStorage.getItem('allied-cor-accent2');
                  if (accent && accent2) {
                    document.documentElement.style.setProperty('--accent', accent);
                    document.documentElement.style.setProperty('--accent2', accent2);
                    var n = parseInt(accent2.replace('#', ''), 16);
                    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
                    document.documentElement.style.setProperty('--accent-glow', 'rgba(' + r + ',' + g + ',' + b + ',0.28)');
                  }
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
