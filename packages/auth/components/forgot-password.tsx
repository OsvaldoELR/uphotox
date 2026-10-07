"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset } from "../actions";
import { FormStatus } from "./form-status";

export const ForgotPassword = () => {
  const [state, formAction, pending] = useActionState(requestPasswordReset, {});

  return (
    <form action={formAction} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          autoComplete="email"
          defaultValue={state.email}
          id="email"
          name="email"
          placeholder="you@example.com"
          required
          type="email"
        />
      </div>
      <FormStatus state={state} />
      <Button disabled={pending} type="submit">
        {pending ? "Sending..." : "Send reset link"}
      </Button>
      <p className="text-center text-muted-foreground text-sm">
        <Link className="underline underline-offset-4" href="/sign-in">
          Back to sign in
        </Link>
      </p>
    </form>
  );
};
