"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CompassIcon, HomeIcon, MoreHorizontalIcon, PlusIcon, Trash2Icon, ExternalLinkIcon } from "lucide-react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { AddAppDialog } from "@/components/apps/add-app-dialog";
import { AppIcon } from "@/components/shared/app-icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarRail,
} from "@/components/ui/sidebar";
import { useCountry, withCountry } from "@/hooks/use-country";
import { useTRPC } from "@/trpc/react";
import { ThemeToggle } from "./theme-toggle";

export function AppSidebar() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams<{ appId?: string }>();
  const [country] = useCountry();
  const [addOpen, setAddOpen] = useState(false);

  const tracked = useQuery(trpc.apps.tracked.queryOptions({ country }));
  const untrack = useMutation(
    trpc.apps.untrack.mutationOptions({
      onSuccess: async (_, { id }) => {
        await queryClient.invalidateQueries(trpc.apps.pathFilter());
        toast.success("App removed");
        if (params.appId === id) router.push(withCountry("/", country));
      },
    }),
  );

  return (
    <>
      <Sidebar collapsible="icon" variant="inset">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <Link href={withCountry("/", country)}>
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
                    <span className="text-sm font-bold">A</span>
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">Free Astro</span>
                    <span className="text-muted-foreground truncate text-xs">ASO toolkit</span>
                  </div>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname === "/"} tooltip="Home">
                    <Link href={withCountry("/", country)}>
                      <HomeIcon /> <span>Home</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname === "/explore"} tooltip="Keyword Explorer">
                    <Link href={withCountry("/explore", country)}>
                      <CompassIcon /> <span>Keyword Explorer</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>My Apps</SidebarGroupLabel>
            <SidebarGroupAction title="Add app" onClick={() => setAddOpen(true)}>
              <PlusIcon /> <span className="sr-only">Add app</span>
            </SidebarGroupAction>
            <SidebarGroupContent>
              <SidebarMenu>
                {tracked.isLoading &&
                  Array.from({ length: 3 }).map((_, i) => (
                    <SidebarMenuItem key={i}>
                      <SidebarMenuSkeleton showIcon />
                    </SidebarMenuItem>
                  ))}
                {tracked.data?.length === 0 && (
                  <p className="text-muted-foreground px-2 py-1.5 text-xs group-data-[collapsible=icon]:hidden">
                    No apps yet. Add one to start tracking keywords.
                  </p>
                )}
                {tracked.data?.map((app) => (
                  <SidebarMenuItem key={app.id}>
                    <SidebarMenuButton
                      asChild
                      size="lg"
                      isActive={params.appId === app.id}
                      tooltip={app.name}
                      className="group-data-[collapsible=icon]:p-0!"
                    >
                      <Link href={withCountry(`/apps/${app.id}`, country)}>
                        <AppIcon src={app.iconUrl} name={app.name} size={32} />
                        <div className="grid min-w-0 flex-1 text-left leading-tight">
                          <span className="truncate text-sm font-medium">{app.name}</span>
                          <span className="text-muted-foreground truncate text-xs">{app.developer}</span>
                        </div>
                      </Link>
                    </SidebarMenuButton>
                    {app.keywordCount > 0 && (
                      <SidebarMenuBadge className="group-hover/menu-item:opacity-0 group-has-[[data-state=open]]/menu-item:opacity-0 group-has-[button:focus-visible]/menu-item:opacity-0">
                        {app.keywordCount}
                      </SidebarMenuBadge>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <SidebarMenuAction className="top-3! group-hover/menu-item:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100 md:opacity-0">
                          <MoreHorizontalIcon />
                          <span className="sr-only">More</span>
                        </SidebarMenuAction>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent side="right" align="start" className="min-w-48">
                        <DropdownMenuItem asChild>
                          <a href={`https://apps.apple.com/${country.toLowerCase()}/app/id${app.id}`} target="_blank" rel="noreferrer">
                            <ExternalLinkIcon /> View on App Store
                          </a>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onClick={() => untrack.mutate({ id: app.id })}>
                          <Trash2Icon /> Remove app
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <ThemeToggle />
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Add app"
                variant="outline"
                className="justify-between"
                onClick={() => setAddOpen(true)}
              >
                <span>Add App</span>
                <PlusIcon />
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <AddAppDialog open={addOpen} onOpenChange={setAddOpen} />
    </>
  );
}
