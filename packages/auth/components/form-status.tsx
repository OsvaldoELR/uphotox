import type { AuthFormState } from "../actions";

export const FormStatus = ({ state }: { state: AuthFormState }) => {
  if (state.error) {
    return (
      <p className="text-destructive text-sm" role="alert">
        {state.error}
      </p>
    );
  }

  if (state.message) {
    return (
      <output className="block text-muted-foreground text-sm">
        {state.message}
      </output>
    );
  }

  return null;
};
