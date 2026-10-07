"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { useActionState } from "react";
import { updatePassword } from "../actions";
import { FormStatus } from "./form-status";

export const UpdatePassword = () => {
  const [state, formAction, pending] = useActionState(updatePassword, {});

  return (
    <form action={formAction} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="password">Contraseña nueva</Label>
        <Input
          autoComplete="new-password"
          id="password"
          minLength={8}
          name="password"
          required
          type="password"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
        <Input
          autoComplete="new-password"
          id="confirmPassword"
          minLength={8}
          name="confirmPassword"
          required
          type="password"
        />
      </div>
      <FormStatus state={state} />
      <Button disabled={pending} type="submit">
        {pending ? "Guardando..." : "Actualizar contraseña"}
      </Button>
    </form>
  );
};
