import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@repo/design-system/components/ui/breadcrumb";
import { Separator } from "@repo/design-system/components/ui/separator";
import { SidebarTrigger } from "@repo/design-system/components/ui/sidebar";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";

interface HeaderProps {
  readonly children?: ReactNode;
  readonly page: string;
  /** Parent pages, outermost first. */
  readonly trail?: { label: string; href: string }[];
}

export const Header = ({ trail = [], page, children }: HeaderProps) => (
  <header className="flex h-16 shrink-0 items-center justify-between gap-2 pr-4 md:pr-6">
    <div className="flex min-w-0 items-center gap-2 px-4 md:px-6">
      <SidebarTrigger className="-ml-1" />
      <Separator className="mr-2 h-4" orientation="vertical" />
      <Breadcrumb className="min-w-0">
        <BreadcrumbList className="font-mono text-[11px] uppercase tracking-[0.18em]">
          {trail.map((item) => (
            <Fragment key={item.href}>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink asChild>
                  <Link href={item.href}>{item.label}</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
            </Fragment>
          ))}
          <BreadcrumbItem className="min-w-0">
            <BreadcrumbPage className="truncate font-semibold text-signal-ink">
              {page}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    </div>
    {children}
  </header>
);
