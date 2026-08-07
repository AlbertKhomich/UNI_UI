import { z } from "zod";

export const signInSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required.")
    .email("Enter a valid email address."),
  password: z
    .string()
    .min(1, "Password is required.")
    .max(72, "Password must be at most 72 characters."),
});

export type SignInFormValues = z.infer<typeof signInSchema>;
