interface AuthHeaderProperties {
  readonly description: string;
  readonly title: string;
}

export const AuthHeader = ({ title, description }: AuthHeaderProperties) => (
  <div className="flex flex-col gap-2">
    <h1 className="font-black font-mono text-xl uppercase tracking-wider">
      {title}
    </h1>
    <p className="text-muted-foreground text-sm">{description}</p>
  </div>
);
