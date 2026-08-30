const AUTH_EMAIL_DOMAIN =
  process.env.NEXT_PUBLIC_AUTH_EMAIL_DOMAIN || "jmacedoallied.internal";

/**
 * Remove acentos, espaços e caracteres especiais para gerar um
 * identificador de usuário a partir de nome + sobrenome.
 * Ex: "João" + "Silva Santos" -> "joao.silvasantos"
 */
export function slugifyNome(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos (marcas diacríticas)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "");
}

export function gerarUsuario(nome: string, sobrenome: string): string {
  const n = slugifyNome(nome);
  const s = slugifyNome(sobrenome);
  return s ? `${n}.${s}` : n;
}

/**
 * O Supabase Auth exige um e-mail para login. Como o login do sistema
 * é feito por "usuário" (nome.sobrenome) e não por e-mail, criamos um
 * e-mail técnico interno só para identificar a conta no Supabase Auth.
 * O e-mail de contato de verdade fica salvo em public.usuarios.email.
 */
export function usuarioParaEmailTecnico(usuario: string): string {
  return `${usuario}@${AUTH_EMAIL_DOMAIN}`;
}

export const SENHA_PADRAO = "Allied001";

export const CARGOS = [
  "Diretor",
  "Gerente",
  "Supervisor",
  "Técnico",
  "Estoque",
  "Operacional",
] as const;

export type Cargo = (typeof CARGOS)[number];
