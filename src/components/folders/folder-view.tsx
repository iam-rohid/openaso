"use client";

import { useQuery } from "@tanstack/react-query";
import { FolderXIcon, HomeIcon, MoreHorizontalIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AddAppDialog } from "@/components/apps/add-app-dialog";
import { AppCard } from "@/components/apps/app-card";
import { PageHeader } from "@/components/layout/page-header";
import { CountrySelect } from "@/components/shared/country-select";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { useAfterMenuClose } from "@/hooks/use-after-menu-close";
import { useCountry, withCountry } from "@/hooks/use-country";
import { useTRPC } from "@/trpc/react";
import { FolderDialog } from "./folder-dialog";
import { FolderGlyph } from "./folder-glyph";
import { useDeleteFolder } from "./use-delete-folder";

export function FolderView({ folderId }: { folderId: number }) {
  const trpc = useTRPC();
  const [country] = useCountry();
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const folder = useQuery({ ...trpc.folders.get.queryOptions({ id: folderId }), retry: false });
  const tracked = useQuery(trpc.apps.tracked.queryOptions({ country }));
  const deleteFolder = useDeleteFolder();
  const menu = useAfterMenuClose();
  const folderApps = tracked.data?.filter((app) => app.folderId === folderId) ?? [];

  if (folder.isError) {
    return (
      <div className="flex min-h-svh flex-col">
        <PageHeader>
          <h1 className="text-sm font-semibold">Folder</h1>
        </PageHeader>
        <main className="mx-auto w-full max-w-6xl flex-1 p-6">
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FolderXIcon />
              </EmptyMedia>
              <EmptyTitle>Folder not found</EmptyTitle>
              <EmptyDescription>{folder.error.message}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild variant="outline">
                <Link href={withCountry("/", country)}>Back to My Apps</Link>
              </Button>
            </EmptyContent>
          </Empty>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh flex-col">
      <PageHeader>
        <Breadcrumb className="min-w-0">
          <BreadcrumbList className="flex-nowrap">
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href={withCountry("/", country)} className="flex items-center gap-1.5">
                  <HomeIcon className="size-4" /> Home
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem className="min-w-0">
              {folder.data ? (
                <BreadcrumbPage className="flex min-w-0 items-center gap-2 font-semibold">
                  <FolderGlyph color={folder.data.color} className="size-4 shrink-0" />
                  <h1 className="truncate">{folder.data.name}</h1>
                </BreadcrumbPage>
              ) : (
                <Skeleton className="h-5 w-32" />
              )}
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="ml-auto flex items-center gap-2">
          <CountrySelect />
          <Button className="bg-indigo-600 text-white hover:bg-indigo-500" onClick={() => setAddOpen(true)}>
            Add App <PlusIcon />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" disabled={!folder.data}>
                <MoreHorizontalIcon />
                <span className="sr-only">Folder actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-48" onCloseAutoFocus={menu.onCloseAutoFocus}>
              <DropdownMenuItem onSelect={() => menu.defer(() => setEditOpen(true))}>
                <PencilIcon /> Edit folder…
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => deleteFolder.mutate({ id: folderId })}>
                <Trash2Icon /> Delete folder
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </PageHeader>

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 p-6">
        {tracked.isLoading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        )}

        {tracked.data && folderApps.length === 0 && (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FolderGlyph color={folder.data?.color ?? "gray"} />
              </EmptyMedia>
              <EmptyTitle>This folder is empty</EmptyTitle>
              <EmptyDescription>
                Add an app here, or use <strong>Move to folder</strong> from an app’s menu in the sidebar.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button className="bg-indigo-600 text-white hover:bg-indigo-500" onClick={() => setAddOpen(true)}>
                Add App <PlusIcon />
              </Button>
            </EmptyContent>
          </Empty>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {folderApps.map((app) => (
            <AppCard key={app.id} app={app} href={withCountry(`/apps/${app.id}`, country)} />
          ))}
        </div>
      </main>
      <AddAppDialog open={addOpen} onOpenChange={setAddOpen} folderId={folderId} />
      {folder.data && <FolderDialog open={editOpen} onOpenChange={setEditOpen} target={{ folder: folder.data }} />}
    </div>
  );
}
