"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import Link from "next/link";
import { useActionState } from "react";
import { signUp } from "../actions";
import { FormStatus } from "./form-status";

export const SignUp = () => {
  const [state, formAction, pending] = useActionState(signUp, {});

  return (
    <form action={formAction} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="fullName">Nombre</Label>
        <Input
          autoComplete="name"
          id="fullName"
          name="fullName"
          placeholder="Ana García"
          required
        />
      </div>
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
        <Label htmlFor="password">Contraseña</Label>
        <Input
          autoComplete="new-password"
          id="password"
          minLength={8}
          name="password"
          required
          type="password"
        />
      </div>
      <FormStatus state={state} />
      <Button disabled={pending} type="submit">
        {pending ? "Creando cuenta..." : "Crear cuenta"}
      </Button>
      <p className="text-center text-muted-foreground text-sm">
        ¿Ya tienes cuenta?{" "}
        <Link className="underline underline-offset-4" href="/sign-in">
          Entrar
        </Link>
      </p>
    </form>
  );
};
