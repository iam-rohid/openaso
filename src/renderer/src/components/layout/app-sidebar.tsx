import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckIcon,
  ChevronRightIcon,
  CompassIcon,
  ExternalLinkIcon,
  FolderInputIcon,
  FolderOpenIcon,
  FolderOutputIcon,
  FolderPlusIcon,
  HomeIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useLocation, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AddAppDialog } from "@/components/apps/add-app-dialog";
import { FolderDialog, type FolderDialogTarget } from "@/components/folders/folder-dialog";
import { FolderGlyph } from "@/components/folders/folder-glyph";
import { useDeleteFolder } from "@/components/folders/use-delete-folder";
import { AppIcon } from "@/components/shared/app-icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
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
  SidebarMenuSub,
  SidebarRail,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useCountry } from "@/hooks/use-country";
import { useAfterMenuClose } from "@/hooks/use-after-menu-close";
import { useLocalStorageState } from "@/hooks/use-local-storage-state";
import { cn } from "@/lib/utils";
import { type RouterOutputs, useTRPC } from "@/trpc/react";
import { ThemeToggle } from "./theme-toggle";

type TrackedApp = RouterOutputs["apps"]["tracked"][number];
type Folder = RouterOutputs["folders"]["list"][number];

const BADGE_HOVER_HIDE =
  "group-hover/menu-item:opacity-0 group-has-[[data-state=open]]/menu-item:opacity-0 group-has-[button:focus-visible]/menu-item:opacity-0";
const ACTION_ON_HOVER =
  "group-hover/menu-item:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100 md:opacity-0";

export function AppSidebar() {
  const trpc = useTRPC();
  const pathname = useLocation({ select: (l) => l.pathname });
  const params = useParams({ strict: false });
  const [country] = useCountry();
  const [addOpen, setAddOpen] = useState(false);
  const [folderDialog, setFolderDialog] = useState<{ open: boolean; target: FolderDialogTarget }>({
    open: false,
    target: {},
  });
  const openFolderDialog = (target: FolderDialogTarget) => setFolderDialog({ open: true, target });

  const tracked = useQuery(trpc.apps.tracked.queryOptions({ country }));
  const folders = useQuery(trpc.folders.list.queryOptions({ country }));
  const looseApps = tracked.data?.filter((app) => app.folderId == null) ?? [];
  const isEmpty = tracked.data?.length === 0 && folders.data?.length === 0;

  // Folders default to expanded; only explicit collapses are stored.
  const [expanded, setExpanded] = useLocalStorageState<Record<string, boolean>>("openaso:folders-expanded", {});
  const isExpanded = (id: number) => expanded[id] ?? true;
  const setFolderExpanded = (id: number, open: boolean) => setExpanded((prev) => ({ ...prev, [id]: open }));

  // Reveal the folder holding whatever is being viewed.
  const activeFolderId =
    tracked.data?.find((app) => app.id === params.appId)?.folderId ??
    (params.folderId ? Number(params.folderId) : null);
  useEffect(() => {
    if (activeFolderId != null && expanded[activeFolderId] === false) setFolderExpanded(activeFolderId, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFolderId]);

  const rowProps = { folders: folders.data ?? [], onNewFolder: openFolderDialog };

  return (
    <>
      <Sidebar collapsible="offcanvas">
        {/* Empty on purpose: on macOS it clears the traffic lights and drags the window. */}
        <SidebarHeader />

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname === "/"}>
                    <Link to="/">
                      <HomeIcon /> <span>Home</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname === "/explore"}>
                    <Link to="/explore">
                      <CompassIcon /> <span>Keyword Explorer</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>My Apps</SidebarGroupLabel>
            <Tooltip>
              <TooltipTrigger asChild>
                <SidebarGroupAction className="right-10" onClick={() => openFolderDialog({})}>
                  <FolderPlusIcon /> <span className="sr-only">New folder</span>
                </SidebarGroupAction>
              </TooltipTrigger>
              <TooltipContent>New folder</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <SidebarGroupAction onClick={() => setAddOpen(true)}>
                  <PlusIcon /> <span className="sr-only">Add app</span>
                </SidebarGroupAction>
              </TooltipTrigger>
              <TooltipContent>Add app</TooltipContent>
            </Tooltip>
            <SidebarGroupContent>
              <SidebarMenu>
                {(tracked.isLoading || folders.isLoading) &&
                  Array.from({ length: 3 }).map((_, i) => (
                    <SidebarMenuItem key={i}>
                      <SidebarMenuSkeleton showIcon />
                    </SidebarMenuItem>
                  ))}
                {isEmpty && (
                  <p className="text-muted-foreground px-2 py-1.5 text-xs">
                    No apps yet. Add one to start tracking keywords.
                  </p>
                )}
                {tracked.data &&
                  folders.data?.map((folder) => {
                    const apps = tracked.data.filter((app) => app.folderId === folder.id);
                    return (
                      <FolderRow
                        key={folder.id}
                        folder={folder}
                        open={isExpanded(folder.id)}
                        onOpenChange={(open) => setFolderExpanded(folder.id, open)}
                        onEdit={() => openFolderDialog({ folder })}
                      >
                        {apps.map((app) => (
                          <AppRow key={app.id} app={app} {...rowProps} />
                        ))}
                      </FolderRow>
                    );
                  })}
                {looseApps.map((app) => (
                  <AppRow key={app.id} app={app} {...rowProps} />
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
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <AddAppDialog open={addOpen} onOpenChange={setAddOpen} />
      <FolderDialog
        open={folderDialog.open}
        onOpenChange={(open) => setFolderDialog((prev) => ({ ...prev, open }))}
        target={folderDialog.target}
      />
    </>
  );
}

/** Sidebar folder: the whole row toggles its apps; the hover menu opens, edits or deletes it. */
function FolderRow({
  folder,
  open,
  onOpenChange,
  onEdit,
  children,
}: {
  folder: Folder;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  const pathname = useLocation({ select: (l) => l.pathname });
  const deleteFolder = useDeleteFolder();
  const menu = useAfterMenuClose();

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        aria-expanded={open}
        isActive={pathname === `/folders/${folder.id}`}
        onClick={() => onOpenChange(!open)}
      >
        <ChevronRightIcon className={cn("text-muted-foreground transition-transform", open && "rotate-90")} />
        <FolderGlyph color={folder.color} />
        <span className="truncate">{folder.name}</span>
      </SidebarMenuButton>
      {folder.appCount > 0 && <SidebarMenuBadge className={BADGE_HOVER_HIDE}>{folder.appCount}</SidebarMenuBadge>}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuAction className={ACTION_ON_HOVER}>
            <MoreHorizontalIcon />
            <span className="sr-only">Folder actions</span>
          </SidebarMenuAction>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start" className="min-w-48" onCloseAutoFocus={menu.onCloseAutoFocus}>
          <DropdownMenuItem asChild>
            <Link to="/folders/$folderId" params={{ folderId: String(folder.id) }}>
              <FolderOpenIcon /> Open folder
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => menu.defer(onEdit)}>
            <PencilIcon /> Edit folder…
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => deleteFolder.mutate({ id: folder.id })}>
            <Trash2Icon /> Delete folder
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {open && (
        <SidebarMenuSub className="mr-0 ml-3 pr-0 pl-1.5">
          {children}
          {folder.appCount === 0 && <li className="text-muted-foreground px-2 py-1 text-xs">Empty</li>}
        </SidebarMenuSub>
      )}
    </SidebarMenuItem>
  );
}

function AppRow({
  app,
  folders,
  onNewFolder,
}: {
  app: TrackedApp;
  folders: Folder[];
  onNewFolder: (target: FolderDialogTarget) => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const params = useParams({ strict: false });
  const [country] = useCountry();
  const menu = useAfterMenuClose();

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries(trpc.apps.pathFilter()),
      queryClient.invalidateQueries(trpc.folders.pathFilter()),
    ]);
  const untrack = useMutation(
    trpc.apps.untrack.mutationOptions({
      onSuccess: async (_, { id }) => {
        await invalidate();
        toast.success("App removed");
        if (params.appId === id) void navigate({ to: "/" });
      },
    }),
  );
  const move = useMutation(
    trpc.apps.moveToFolder.mutationOptions({
      onSuccess: invalidate,
      onError: (err) => toast.error(err.message),
    }),
  );

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        size="lg"
        isActive={params.appId === app.id}
      >
        <Link to="/apps/$appId" params={{ appId: app.id }}>
          <AppIcon src={app.iconUrl} name={app.name} size={32} />
          <div className="grid min-w-0 flex-1 text-left leading-tight">
            <span className="truncate text-sm font-medium">{app.name}</span>
            <span className="text-muted-foreground truncate text-xs">{app.developer}</span>
          </div>
        </Link>
      </SidebarMenuButton>
      {app.keywordCount > 0 && <SidebarMenuBadge className={BADGE_HOVER_HIDE}>{app.keywordCount}</SidebarMenuBadge>}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuAction className={ACTION_ON_HOVER}>
            <MoreHorizontalIcon />
            <span className="sr-only">More</span>
          </SidebarMenuAction>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start" className="min-w-48" onCloseAutoFocus={menu.onCloseAutoFocus}>
          <DropdownMenuItem asChild>
            <a href={`https://apps.apple.com/${country.toLowerCase()}/app/id${app.id}`} target="_blank" rel="noreferrer">
              <ExternalLinkIcon /> View on App Store
            </a>
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <FolderInputIcon /> Move to folder
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="min-w-48">
              {folders.map((folder) => (
                <DropdownMenuItem
                  key={folder.id}
                  disabled={app.folderId === folder.id}
                  onClick={() => move.mutate({ id: app.id, folderId: folder.id })}
                >
                  <FolderGlyph color={folder.color} />
                  <span className="flex-1 truncate">{folder.name}</span>
                  {app.folderId === folder.id && <CheckIcon />}
                </DropdownMenuItem>
              ))}
              {folders.length > 0 && <DropdownMenuSeparator />}
              <DropdownMenuItem onSelect={() => menu.defer(() => onNewFolder({ appId: app.id }))}>
                <FolderPlusIcon /> New folder…
              </DropdownMenuItem>
              {app.folderId != null && (
                <DropdownMenuItem onClick={() => move.mutate({ id: app.id, folderId: null })}>
                  <FolderOutputIcon /> Remove from folder
                </DropdownMenuItem>
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => untrack.mutate({ id: app.id })}>
            <Trash2Icon /> Remove app
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
}
