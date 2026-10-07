"use server";

import { createClient } from "@repo/database/server";
import { keys } from "@repo/next-config/keys";
import { redirect } from "next/navigation";
import { z } from "zod";
import { safeRedirectPath } from "./redirect";

export interface AuthFormState {
  email?: string;
  error?: string;
  message?: string;
}

const email = z.email("Enter a valid email address.");
const password = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(72, "Password must be at most 72 characters.");

const signInSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password."),
});

const signUpSchema = z.object({
  fullName: z.string().trim().min(1, "Enter your name.").max(120),
  email,
  password,
});

const updatePasswordSchema = z
  .object({ password, confirmPassword: z.string() })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match.",
  });

const field = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
};

const callbackUrl = (next: string) => {
  const url = new URL("/auth/callback", keys().NEXT_PUBLIC_APP_URL);
  url.searchParams.set("next", next);
  return url.toString();
};

export const signIn = async (
  _previousState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> => {
  const parsed = signInSchema.safeParse({
    email: field(formData, "email"),
    password: field(formData, "password"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message,
      email: field(formData, "email"),
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: error.message, email: parsed.data.email };
  }

  redirect(safeRedirectPath(field(formData, "next")));
};

export const signUp = async (
  _previousState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> => {
  const parsed = signUpSchema.safeParse({
    fullName: field(formData, "fullName"),
    email: field(formData, "email"),
    password: field(formData, "password"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message,
      email: field(formData, "email"),
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: callbackUrl("/"),
    },
  });

  if (error) {
    return { error: error.message, email: parsed.data.email };
  }

  // No session means email confirmation is enabled in Supabase Auth.
  if (!data.session) {
    return {
      message: "Check your email to confirm your account.",
      email: parsed.data.email,
    };
  }

  redirect("/");
};

export const requestPasswordReset = async (
  _previousState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> => {
  const parsed = email.safeParse(field(formData, "email"));

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message,
      email: field(formData, "email"),
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: callbackUrl("/update-password"),
  });

  if (error) {
    return { error: error.message, email: parsed.data };
  }

  // Same message whether or not the account exists, to avoid leaking emails.
  return {
    message: "If an account exists for that email, a reset link is on its way.",
    email: parsed.data,
  };
};

export const updatePassword = async (
  _previousState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> => {
  const parsed = updatePasswordSchema.safeParse({
    password: field(formData, "password"),
    confirmPassword: field(formData, "confirmPassword"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return { error: error.message };
  }

  redirect("/");
};

export const signOut = async () => {
  const supabase = await createClient();
  await supabase.auth.signOut();

  redirect("/sign-in");
};
