"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import Link from "next/link";
import { useActionState } from "react";
import { signIn } from "../actions";
import { FormStatus } from "./form-status";

interface SignInProperties {
  readonly error?: string;
  readonly next?: string;
}

export const SignIn = ({ next = "/", error }: SignInProperties) => {
  const [state, formAction, pending] = useActionState(signIn, { error });

  return (
    <form action={formAction} className="grid gap-4">
      <input name="next" type="hidden" value={next} />
      <div className="grid gap-2">
        <Label htmlFor="email">Correo</Label>
        <Input
          autoComplete="email"
          defaultValue={state.email}
          id="email"
          name="email"
          placeholder="tu@estudio.com"
          required
          type="email"
        />
      </div>
      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Contraseña</Label>
          <Link
            className="text-muted-foreground text-sm underline-offset-4 hover:underline"
            href="/forgot-password"
          >
            ¿Olvidaste tu contraseña?
          </Link>
        </div>
        <Input
          autoComplete="current-password"
          id="password"
          name="password"
          required
          type="password"
        />
      </div>
      <FormStatus state={state} />
      <Button disabled={pending} type="submit">
        {pending ? "Entrando..." : "Entrar"}
      </Button>
      <p className="text-center text-muted-foreground text-sm">
        ¿No tienes cuenta?{" "}
        <Link className="underline underline-offset-4" href="/sign-up">
          Regístrate
        </Link>
      </p>
    </form>
  );
};
