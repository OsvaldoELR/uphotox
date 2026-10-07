interface AuthHeaderProperties {
  readonly description: string;
  readonly title: string;
}

export const AuthHeader = ({ title, description }: AuthHeaderProperties) => (
  <div className="flex flex-col space-y-2 text-center">
    <h1 className="font-semibold text-2xl tracking-tight">{title}</h1>
    <p className="text-muted-foreground text-sm">{description}</p>
  </div>
);
