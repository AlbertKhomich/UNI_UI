import { compare } from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { signInSchema } from "@/lib/signIn";

export async function authorizeCredentials(credentials: unknown) {
  const parsed = signInSchema.safeParse(credentials);

  if (!parsed.success) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
    select: { id: true, email: true, passwordHash: true },
  });

  if (!user || !(await compare(parsed.data.password, user.passwordHash))) {
    return null;
  }

  return { id: user.id, email: user.email };
}

export const authOptions: NextAuthOptions = {
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: authorizeCredentials,
    }),
  ],
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
