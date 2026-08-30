import Image from "next/image";
import LoginForm from "@/components/LoginForm";

// Degradê único para a tela toda: mesmo tom de azul escuro do logo,
// com o clarinho concentrado no canto superior direito — igual ao
// fundo já presente na imagem do logo, só que espalhado pela tela
// inteira, para não sobrar nenhuma "quebra" ao redor da imagem.
const FUNDO_DEGRADE =
  "radial-gradient(140% 120% at 90% 8%, #234270 0%, #0e2040 32%, #050f1f 68%, #040c19 100%)";

export default function LoginPage() {
  return (
    <main
      className="h-screen w-full overflow-hidden grid grid-cols-1 md:grid-cols-[7fr_3fr]"
      style={{ background: FUNDO_DEGRADE }}
    >
      {/* Lado esquerdo: logo em destaque, se fundindo com o fundo da tela */}
      <div className="relative flex items-center justify-center px-8 py-6 md:py-0 overflow-hidden">
        <div
          className="relative h-full w-full max-w-[760px] max-h-[88vh] aspect-square"
          style={{
            WebkitMaskImage:
              "radial-gradient(ellipse 62% 62% at 50% 50%, #000 55%, transparent 92%)",
            maskImage:
              "radial-gradient(ellipse 62% 62% at 50% 50%, #000 55%, transparent 92%)",
            WebkitMaskRepeat: "no-repeat",
            maskRepeat: "no-repeat",
            WebkitMaskSize: "100% 100%",
            maskSize: "100% 100%",
          }}
        >
          <Image
            src="/logo-allied.png"
            alt="Grupo J.Macedo Eletrônica / Allied"
            fill
            sizes="(min-width: 768px) 65vw, 85vw"
            className="object-contain"
            priority
          />
        </div>
      </div>

      {/* Lado direito: formulário de login, sem linha nem cor separando do fundo */}
      <div className="relative flex items-center px-8 md:px-10 py-6 overflow-hidden">
        <div className="relative w-full">
          <h1 className="text-2xl font-semibold text-white mb-1.5">Entrar</h1>
          <p className="text-sm text-allied-silver/60 mb-8">
            Use seu login no padrão <span className="text-allied-silver/80">nome.sobrenome</span>
          </p>

          <LoginForm />

          <p className="text-left text-[11px] text-allied-silver/40 mt-8">
            Acesso restrito. Em caso de dúvidas, procure o administrador do sistema.
          </p>
        </div>
      </div>
    </main>
  );
}
