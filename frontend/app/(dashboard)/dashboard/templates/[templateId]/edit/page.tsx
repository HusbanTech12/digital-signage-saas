"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import {
  VisualEditor,
  type VisualEditorHandle,
} from "@/components/designer/visual-editor";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  TemplateLayoutSettings,
  type TemplateLayoutSettingsHandle,
} from "@/components/dashboard/template-layout-settings";
import { OrientationToggle } from "@/components/dashboard/orientation-toggle";
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
import type { DesignerCanvasJson } from "@/lib/designer/canvas-io";
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
          Loading designer…
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
  const menuId = searchParams.get("menuId");
  const { session, role } = useMockSession();
  const { templates, menus, menuItems, screens: storeScreens } = useMockStore();
  const { getApiToken } = useApiAuthToken();

  const editorRef = useRef<VisualEditorHandle>(null);
  const layoutRef = useRef<TemplateLayoutSettingsHandle>(null);

  const [tab, setTab] = useState<TemplateHubTab>("layout");
  const [publishing, setPublishing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [orientation, setOrientation] =
    useState<ScreenOrientation>("landscape");

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
  const menu = menuId
    ? menus.find(
        (m) =>
          m.id === menuId && m.organizationId === session.organization.id,
      )
    : undefined;

  useEffect(() => {
    if (!template) return;
    setOrientation(template.orientation || "landscape");
    setAudioPlaylistId(template.audioPlaylistId ?? "");
    setAudioVolume(template.audioVolume ?? 0.5);
    setAudioLoop(template.audioLoop ?? true);
    setAudioMuted(template.audioMuted ?? false);
    setPlaylistId(template.playlistId ?? "");
    setSlideDuration(template.playlistItemDurationSeconds ?? 12);
  }, [template?.id]);

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
        /* library lists are optional for the canvas */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getApiToken]);

  const items = useMemo(
    () =>
      menu
        ? menuItems
            .filter((i) => i.menuId === menu.id)
            .sort((a, b) => a.sortOrder - b.sortOrder)
        : menuItems
            .filter((i) => i.organizationId === session.organization.id)
            .slice(0, 12),
    [menu, menuItems, session.organization.id],
  );

  const orgTemplates = useMemo(
    () =>
      templates.filter(
        (t) => !t.isGlobal && t.organizationId === session.organization.id,
      ),
    [templates, session.organization.id],
  );

  const visibleScreens = filterScreensForUser(
    liveScreens.length ? liveScreens : storeScreens,
    session.user,
  ).filter((s) => s.locationId && s.status !== "pairing");
  const isPremium = template?.displayConfig?.layout === "premium";
  const canPublish = canPublishMenus(role);

  if (!canEditDesigner(role)) {
    return (
      <div className="mx-auto max-w-5xl">
        <PageHeader title="Designer" description="Access denied." />
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
          description="Duplicate this template from the gallery to customize the TV layout."
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
      if (isPremium) setTab("target");
      else editorRef.current?.openPanel("target");
      setError("Select at least one screen or a video wall, then Publish.");
      return;
    }
    setPublishing(true);
    try {
      const token = await getApiToken();
      if (!token) throw new Error("Missing API auth token");
      const canvasJson = !isPremium
        ? editorRef.current?.getJson() ?? undefined
        : undefined;
      const displayConfig = isPremium
        ? layoutRef.current?.getConfig()
        : undefined;
      const result = await publishTemplatePackage(
        template.id,
        {
          canvasJson,
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
          menuId: menu?.id ?? null,
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

  const screenSetupPanel = (
    <div className="space-y-3 rounded-xl border border-border p-4">
      <div>
        <h2 className="text-sm font-semibold">Screen shape</h2>
        <p className="text-xs text-muted-foreground">
          No pixel size needed — the layout stretches to fill whatever
          resolution the TV reports. Included in Publish with the rest of the
          package.
        </p>
      </div>
      <OrientationToggle
        value={orientation}
        onChange={setOrientation}
        hint={orientationHint(orientation)}
      />
    </div>
  );

  const audioPanel = (
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
  );

  const playlistPanel = (
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
  );

  const targetPanel = (
    <TemplateTargetTab
      screens={visibleScreens}
      groups={groups}
      selectedScreenIds={selectedScreens}
      screenGroupId={screenGroupId}
      templateOrientation={orientation}
      onToggleScreen={toggleScreen}
      onGroupChange={handleGroupChange}
    />
  );

  if (!isPremium) {
    return (
      <div className="-m-4 md:-m-6">
        <VisualEditor
          key={template.id}
          ref={editorRef}
          templateId={template.id}
          templateName={
            menu ? `${template.name} · ${menu.name}` : template.name
          }
          initialJson={template.canvasJson as DesignerCanvasJson}
          orientation={orientation}
          onOrientationChange={setOrientation}
          menuItems={items}
          templates={orgTemplates}
          publishing={publishing}
          statusMessage={status}
          errorMessage={error}
          onPublish={canPublish ? () => void handlePublish() : undefined}
          hubPanels={{
            setup: screenSetupPanel,
            audio: audioPanel,
            playlist: playlistPanel,
            target: targetPanel,
          }}
          headerActions={
            <Button
              variant="outline"
              size="sm"
              render={<Link href="/dashboard/templates" />}
            >
              Gallery
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <PageHeader
        title={`Template · ${template.name}`}
        description={
          menu
            ? `Publishing hub for menu “${menu.name}”. Layout, audio, rotation, and screens go out together.`
            : "Publishing hub — layout, background audio, playlist rotation, and screen targets in one Publish."
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
          {screenSetupPanel}
          <TemplateLayoutSettings
            ref={layoutRef}
            config={template.displayConfig}
            items={items}
            onPublish={() => void handlePublish()}
            publishing={publishing}
          />
        </>
      ) : null}

      {tab === "audio" ? audioPanel : null}
      {tab === "playlist" ? playlistPanel : null}
      {tab === "target" ? targetPanel : null}
    </div>
  );
}
