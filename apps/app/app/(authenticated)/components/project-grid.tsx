import type { Tables } from "@repo/database";

interface ProjectGridProperties {
  readonly projects: Pick<Tables<"projects">, "id" | "name" | "description">[];
}

export const ProjectGrid = ({ projects }: ProjectGridProperties) => (
  <div className="grid auto-rows-min gap-4 md:grid-cols-3">
    {projects.map((project) => (
      <div
        className="flex aspect-video flex-col justify-end rounded-xl bg-muted/50 p-4"
        key={project.id}
      >
        <p className="font-medium">{project.name}</p>
        {project.description && (
          <p className="text-muted-foreground text-sm">{project.description}</p>
        )}
      </div>
    ))}
  </div>
);
