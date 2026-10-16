import React from "react";
import { Building2 } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { StatCard } from "@/components/app/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/ui";
import { Skeleton } from "@shared/ui";
import { Breadcrumb } from "@shared/ui";
import { SubTabBar } from "@/components/app/SubTabBar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@shared/ui";
import { ListPagination } from "@shared/ui";
import { WORK_SURFACE } from "@shared/ui";
import { cn } from "@/lib/utils";
import {
  DESIGN_SYSTEM_SECTIONS,
  type DesignSystemSectionId,
} from "@/platform/lib/designSystemRegistry";
import { ROUTES } from "@/lib/config/routes";
import {
  DesignSystemActionsDemo,
  DesignSystemFeedbackDemo,
  DesignSystemInputsDemo,
} from "@/platform/components/design-system/DesignSystemGalleryDemos";

function GallerySurface({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section className={cn(WORK_SURFACE, "space-y-4 p-4 sm:p-5")}>
      <h2 className="text-sm font-bold text-foreground text-balance">{title}</h2>
      <div className="flex flex-wrap items-start gap-3">{children}</div>
    </section>
  );
}

function DataDemo(): React.JSX.Element {
  const [page, setPage] = React.useState(1);
  return (
    <div className="grid w-full grid-cols-1 gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          icon={Building2}
          label="StatCard"
          value={42}
          accent="primary"
          trend={12}
          trendLabel="vs prior"
          sparklineData={[12, 18, 15, 22, 28, 24, 30]}
        />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
      <div className="overflow-x-auto max-w-full">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Workspace A</TableCell>
              <TableCell>Active</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
      <ListPagination page={page} total={42} limit={10} onPageChange={setPage} />
    </div>
  );
}

function LayoutDemo(): React.JSX.Element {
  const { t } = useTranslation();
  const [tab, setTab] = React.useState<"one" | "two">("one");
  return (
    <div className="grid w-full grid-cols-1 gap-4">
      <Breadcrumb
        ariaLabel={t("common.breadcrumb")}
        items={[
          { label: t("platform.consoleTitle"), href: ROUTES.platformDashboard },
          { label: t("platform.designSystemTitle"), href: ROUTES.platformDesignSystem },
          { label: t("platform.designSystemLayout") },
        ]}
      />
      <SubTabBar
        tabs={[
          { key: "one", label: "One" },
          { key: "two", label: "Two" },
        ]}
        value={tab}
        onChange={setTab}
        variant="pill"
        panelIdPrefix="design-system-demo"
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Card / PageHeader</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground text-pretty">
          {t("platform.designSystemLayoutHint")}
        </CardContent>
      </Card>
    </div>
  );
}

function OverlaysDemo(): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="space-y-2 text-sm text-muted-foreground text-pretty">
      <p>{t("platform.designSystemOverlaysHint")}</p>
      <p>{t("platform.designSystemCmdHint")}</p>
    </div>
  );
}

const SECTION_RENDERERS: Record<DesignSystemSectionId, () => React.JSX.Element> = {
  actions: DesignSystemActionsDemo,
  inputs: DesignSystemInputsDemo,
  feedback: DesignSystemFeedbackDemo,
  overlays: OverlaysDemo,
  data: DataDemo,
  layout: LayoutDemo,
};

export function DesignSystemGallery(): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="space-y-6 text-start" data-testid="design-system-gallery">
      {DESIGN_SYSTEM_SECTIONS.map((section) => {
        const Renderer = SECTION_RENDERERS[section.id];
        return (
          <GallerySurface key={section.id} title={t(section.labelKey)}>
            <div className="w-full space-y-3">
              <p className="text-3xs font-mono text-muted-foreground">
                {section.primitives.join(" · ")}
              </p>
              <Renderer />
            </div>
          </GallerySurface>
        );
      })}
    </div>
  );
}
