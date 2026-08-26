"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  TemplateLayoutSettings,
  type TemplateLayoutSettingsHandle,
} from "@/components/dashboard/template-layout-settings";
import { OrientationToggle } from "@/components/dashboard/orientation-toggle";
import { TemplateMenuFields } from "@/components/dashboard/template-menu-fields";
import {
  TemplateAudioTab,
  TemplateHubTabBar,
  TemplatePlaylistTab,
  TemplateTargetTab,
  type TemplateHubTab,
} from "@/components/dashboard/template-editor-hub";
import { useMockSession } from "@/components/providers/mock-session-provider";
import { useMockStore } from "@/components/providers/mock-data-provider";
import { Button } from "@/components/ui/button";
import {
  canEditDesigner,
  canPublishMenus,
  filterScreensForUser,
} from "@/lib/access";
import {
  DEFAULT_MENU_DISPLAY_CONFIG,
  mergeDisplayConfig,
} from "@/lib/display/menu-board-theme";
import {
  nominalResolution,
  orientationHint,
} from "@/lib/display/orientation";
import { useApiAuthToken } from "@/lib/api/auth-token";
import { publishTemplatePackage } from "@/lib/data/menus";
import { listAudioPlaylists } from "@/lib/data/audio-playlists";
import { listPlaylists } from "@/lib/data/playlists";
import { listScreenGroups } from "@/lib/data/screen-groups";
import { listScreensFromApi } from "@/lib/data/tenant";
import type { AudioPlaylist } from "@/lib/api/audio-playlists";
import type { ScreenGroup } from "@/lib/api/screen-groups";
import type { Playlist, Screen, ScreenOrientation } from "@/lib/types/schema";

export default function TemplateEditPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-5xl p-4 text-sm text-muted-foreground">
          Loading template…
        </div>
      }
    >
      <TemplateEditPageInner />
    </Suspense>
  );
}

function TemplateEditPageInner() {
  const params = useParams<{ templateId: string }>();
  const searchParams = useSearchParams();
  const queryMenuId = searchParams.get("menuId");
  const { session, role } = useMockSession();
  const { templates, menus, menuItems, screens: storeScreens } = useMockStore();
  const { getApiToken } = useApiAuthToken();

  const layoutRef = useRef<TemplateLayoutSettingsHandle>(null);

  const [tab, setTab] = useState<TemplateHubTab>("layout");
  const [publishing, setPublishing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [orientation, setOrientation] =
    useState<ScreenOrientation>("landscape");
  const [categories, setCategories] = useState<string[]>([
    ...DEFAULT_MENU_DISPLAY_CONFIG.categories,
  ]);
  const [selectedMenuId, setSelectedMenuId] = useState(queryMenuId ?? "");

  const [audioPlaylists, setAudioPlaylists] = useState<AudioPlaylist[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [groups, setGroups] = useState<ScreenGroup[]>([]);
  const [liveScreens, setLiveScreens] = useState<Screen[]>([]);

  const [audioPlaylistId, setAudioPlaylistId] = useState("");
  const [audioVolume, setAudioVolume] = useState(0.5);
  const [audioLoop, setAudioLoop] = useState(true);
  const [audioMuted, setAudioMuted] = useState(false);
  const [playlistId, setPlaylistId] = useState("");
  const [slideDuration, setSlideDuration] = useState(12);
  const [slideSortOrder, setSlideSortOrder] = useState<number | "">("");
  const [selectedScreens, setSelectedScreens] = useState<string[]>([]);
  const [screenGroupId, setScreenGroupId] = useState("");

  const template = templates.find((t) => t.id === params.templateId);
  const orgMenus = useMemo(
    () => menus.filter((m) => m.organizationId === session.organization.id),
    [menus, session.organization.id],
  );

  useEffect(() => {
    if (!template) return;
    setOrientation(template.orientation || "landscape");
    setAudioPlaylistId(template.audioPlaylistId ?? "");
    setAudioVolume(template.audioVolume ?? 0.5);
    setAudioLoop(template.audioLoop ?? true);
    setAudioMuted(template.audioMuted ?? false);
    setPlaylistId(template.playlistId ?? "");
    setSlideDuration(template.playlistItemDurationSeconds ?? 12);
    const merged = mergeDisplayConfig(template.displayConfig);
    setCategories(
      merged.categories.length
        ? [...merged.categories]
        : [...DEFAULT_MENU_DISPLAY_CONFIG.categories],
    );
  }, [template?.id]);

  useEffect(() => {
    if (queryMenuId) {
      setSelectedMenuId(queryMenuId);
      return;
    }
    setSelectedMenuId((current) => current || orgMenus[0]?.id || "");
  }, [queryMenuId, orgMenus]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const token = await getApiToken();
        if (!token) return;
        const [audio, pls, walls, scr] = await Promise.all([
          listAudioPlaylists(token).catch(() => ({
            audioPlaylists: [] as AudioPlaylist[],
          })),
          listPlaylists(token).catch(() => ({ playlists: [] as Playlist[] })),
          listScreenGroups(token).catch(() => ({
            screenGroups: [] as ScreenGroup[],
          })),
          listScreensFromApi(token).catch(() => [] as Screen[]),
        ]);
        if (cancelled) return;
        setAudioPlaylists(audio.audioPlaylists);
        setPlaylists(pls.playlists);
        setGroups(walls.screenGroups);
        setLiveScreens(scr);
      } catch {
        /* library lists are optional for the editor */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getApiToken]);

  const items = useMemo(
    () =>
      selectedMenuId
        ? menuItems
            .filter((i) => i.menuId === selectedMenuId)
            .sort((a, b) => a.sortOrder - b.sortOrder)
        : [],
    [selectedMenuId, menuItems],
  );

  const visibleScreens = filterScreensForUser(
    liveScreens.length ? liveScreens : storeScreens,
    session.user,
  ).filter((s) => s.locationId && s.status !== "pairing");
  const canPublish = canPublishMenus(role);
  const selectedMenu = orgMenus.find((m) => m.id === selectedMenuId);

  if (!canEditDesigner(role)) {
    return (
      <div className="mx-auto max-w-5xl">
        <PageHeader title="Templates" description="Access denied." />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <PageHeader title="Template not found" />
        <Button variant="outline" render={<Link href="/dashboard/templates" />}>
          Back to templates
        </Button>
      </div>
    );
  }

  if (template.isGlobal) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <PageHeader
          title="Read-only global template"
          description="Duplicate this template from the gallery to customize the board."
        />
        <Button variant="outline" render={<Link href="/dashboard/templates" />}>
          Back to gallery
        </Button>
      </div>
    );
  }

  async function handlePublish() {
    if (!canPublish || !template) return;
    setError(null);
    setStatus(null);
    if (!selectedScreens.length && !screenGroupId) {
      setTab("target");
      setError("Select at least one screen or a video wall, then Publish.");
      return;
    }
    setPublishing(true);
    try {
      const token = await getApiToken();
      if (!token) throw new Error("Missing API auth token");
      const displayConfig = mergeDisplayConfig({
        ...layoutRef.current?.getConfig(),
        categories:
          categories.length > 0
            ? categories
            : [...DEFAULT_MENU_DISPLAY_CONFIG.categories],
      });
      const result = await publishTemplatePackage(
        template.id,
        {
          displayConfig,
          resolution: nominalResolution(orientation),
          orientation,
          audioPlaylistId: audioPlaylistId || null,
          audioVolume,
          audioLoop,
          audioMuted,
          playlistId: playlistId || null,
          playlistItemDurationSeconds: playlistId ? slideDuration : null,
          playlistItemSortOrder:
            playlistId && slideSortOrder !== "" ? slideSortOrder : null,
          screenIds: selectedScreens,
          screenGroupId: screenGroupId || null,
          menuId: selectedMenuId || null,
          changeSummary: `Published ${template.name} from template editor`,
        },
        token,
      );
      const mismatched = result.orientationMismatchScreenIds ?? [];
      setStatus(
        `Published v${result.version} to ${result.screenIds.length} screen${
          result.screenIds.length === 1 ? "" : "s"
        }.` +
          (mismatched.length
            ? ` ${mismatched.length} of them ${
                mismatched.length === 1 ? "is" : "are"
              } set to the other orientation — check the Target tab.`
            : ""),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setPublishing(false);
    }
  }

  function toggleScreen(id: string) {
    setSelectedScreens((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function handleGroupChange(id: string) {
    setScreenGroupId(id);
    if (!id) return;
    const group = groups.find((g) => g.id === id);
    if (!group) return;
    const memberIds = group.members.map((m) => m.screenId);
    setSelectedScreens((prev) =>
      Array.from(new Set([...prev, ...memberIds])),
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <PageHeader
        title={`Template · ${template.name}`}
        description={
          selectedMenu
            ? `Fieldwise menu board for “${selectedMenu.name}”. Appearance, categories, items, audio, and screens publish together.`
            : "Fieldwise menu board — appearance, categories, items, audio, and screen targets in one Publish."
        }
        actions={
          <>
            <Button
              variant="outline"
              render={<Link href="/dashboard/templates" />}
            >
              Gallery
            </Button>
            {canPublish ? (
              <Button
                onClick={() => void handlePublish()}
                disabled={publishing}
              >
                {publishing ? "Publishing…" : "Publish"}
              </Button>
            ) : null}
          </>
        }
      />

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {status ? (
        <p className="text-sm text-muted-foreground" role="status">
          {status}
        </p>
      ) : null}

      <TemplateHubTabBar tab={tab} onChange={setTab} />

      {tab === "layout" ? (
        <>
          <div className="space-y-3 rounded-xl border border-border p-4">
            <div>
              <h2 className="text-sm font-semibold">Screen shape</h2>
              <p className="text-xs text-muted-foreground">
                No pixel size needed — the layout stretches to fill whatever
                resolution the TV reports.
              </p>
            </div>
            <OrientationToggle
              value={orientation}
              onChange={setOrientation}
              hint={orientationHint(orientation)}
            />
          </div>
          <TemplateLayoutSettings
            ref={layoutRef}
            config={template.displayConfig}
            items={items}
            categories={categories}
            orientation={orientation}
            onPublish={() => void handlePublish()}
            publishing={publishing}
          />
        </>
      ) : null}

      {tab === "menu" ? (
        <TemplateMenuFields
          organizationId={session.organization.id}
          menus={orgMenus}
          selectedMenuId={selectedMenuId}
          categories={categories}
          items={items}
          getApiToken={getApiToken}
          onMenuChange={setSelectedMenuId}
          onCategoriesChange={setCategories}
        />
      ) : null}

      {tab === "audio" ? (
        <TemplateAudioTab
          audioPlaylists={audioPlaylists}
          audioPlaylistId={audioPlaylistId}
          audioVolume={audioVolume}
          audioLoop={audioLoop}
          audioMuted={audioMuted}
          onChange={(patch) => {
            if (patch.audioPlaylistId !== undefined) {
              setAudioPlaylistId(patch.audioPlaylistId);
            }
            if (patch.audioVolume !== undefined) setAudioVolume(patch.audioVolume);
            if (patch.audioLoop !== undefined) setAudioLoop(patch.audioLoop);
            if (patch.audioMuted !== undefined) setAudioMuted(patch.audioMuted);
          }}
        />
      ) : null}

      {tab === "playlist" ? (
        <TemplatePlaylistTab
          playlists={playlists}
          playlistId={playlistId}
          durationSeconds={slideDuration}
          sortOrder={slideSortOrder}
          templateId={template.id}
          onChange={(patch) => {
            if (patch.playlistId !== undefined) setPlaylistId(patch.playlistId);
            if (patch.durationSeconds !== undefined) {
              setSlideDuration(patch.durationSeconds);
            }
            if (patch.sortOrder !== undefined) setSlideSortOrder(patch.sortOrder);
          }}
        />
      ) : null}

      {tab === "target" ? (
        <TemplateTargetTab
          screens={visibleScreens}
          groups={groups}
          selectedScreenIds={selectedScreens}
          screenGroupId={screenGroupId}
          templateOrientation={orientation}
          onToggleScreen={toggleScreen}
          onGroupChange={handleGroupChange}
        />
      ) : null}
    </div>
  );
}
