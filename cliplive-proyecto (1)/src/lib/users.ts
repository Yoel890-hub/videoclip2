// Supabase solo admite cuentas con correo. Para poder entrar con un nombre de usuario,
// "Dadito23" se guarda por dentro como "dadito23@usuarios.cliplive.app".
export const USERNAME_DOMAIN = "usuarios.cliplive.app";
const USERNAME_RE = /^[a-zA-Z0-9._-]{3,30}$/;

export type LoginId = { email: string; isUsername: boolean } | { error: string };

export function toLoginEmail(input: string): LoginId {
  const v = input.trim();
  if (v.includes("@")) return { email: v, isUsername: false };
  if (!USERNAME_RE.test(v)) return { error: "El usuario debe tener entre 3 y 30 caracteres: letras, números, punto, guion o guion bajo." };
  return { email: `${v.toLowerCase()}@${USERNAME_DOMAIN}`, isUsername: true };
}

// Nombre para mostrar: el usuario si es una cuenta de usuario, o la parte antes de @.
export function displayName(email?: string | null) {
  if (!email) return "";
  const [local, domain] = email.split("@");
  return domain === USERNAME_DOMAIN ? local : email;
}
