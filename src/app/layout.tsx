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
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
