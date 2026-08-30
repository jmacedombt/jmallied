import Link from "next/link";
import UserForm from "@/components/UserForm";

export default function NovoUsuarioPage() {
  return (
    <main className="min-h-screen bg-allied-bg px-6 py-10">
      <div className="max-w-lg mx-auto">
        <Link href="/usuarios" className="text-xs text-allied-silver/60 hover:text-white">
          ← Voltar para usuários
        </Link>
        <h1 className="text-2xl font-semibold text-white mt-3 mb-1">Novo usuário</h1>
        <p className="text-sm text-allied-silver/60 mb-8">
          O usuário (login) é sugerido automaticamente a partir do nome e
          sobrenome. A senha inicial é sempre <strong>Allied001</strong> e a
          troca é obrigatória no primeiro acesso.
        </p>
        <UserForm />
      </div>
    </main>
  );
}
