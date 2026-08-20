/**
 * Menu / item / template / publish mutations.
 * Live FastAPI when enabled; otherwise mock store.
 */

import {
  createMenuApi,
  createMenuItemApi,
  createTemplateApi,
  deleteMenuApi,
  deleteMenuItemApi,
  deleteTemplateApi,
  duplicateTemplateApi,
  listMenuItemsApi,
  listMenusApi,
  listTemplatesApi,
  publishMenuApi,
  updateMenuApi,
  updateMenuItemApi,
  updateTemplateApi,
} from "@/lib/api/menus";
import { useLiveApi } from "@/lib/api/config";
import {
  createMenu as createMenuMock,
  createMenuItem as createMenuItemMock,
  createTemplate as createTemplateMock,
  deleteMenu as deleteMenuMock,
  deleteMenuItem as deleteMenuItemMock,
  deleteTemplate as deleteTemplateMock,
  duplicateTemplate as duplicateTemplateMock,
  hydrateTenantData,
  publishMenu as publishMenuMock,
  removeMenuItemLocal,
  removeMenuLocal,
  removeTemplateLocal,
  updateMenu as updateMenuMock,
  updateMenuItem as updateMenuItemMock,
  updateTemplate as updateTemplateMock,
  upsertMenu,
  upsertMenuItem,
  upsertScreen,
  upsertTemplate,
  getMockStoreSnapshot,
} from "@/lib/mock-api/store";
import type { Menu, MenuItem, Template } from "@/lib/types/schema";

type Token = string;

export async function refreshMenusFromApi(token: Token) {
  const [menus, menuItems, templates] = await Promise.all([
    listMenusApi(token),
    listMenuItemsApi(token),
    listTemplatesApi(token),
  ]);
  hydrateTenantData({ menus, menuItems, templates });
  return { menus, menuItems, templates };
}

export async function createMenu(
  input: { organizationId: string; name: string },
  token?: Token | null,
): Promise<Menu> {
  if (useLiveApi() && token) {
    const menu = await createMenuApi(token, input);
    upsertMenu(menu);
    return menu;
  }
  return createMenuMock(input);
}

export async function updateMenu(
  menuId: string,
  patch: Partial<Pick<Menu, "name">>,
  token?: Token | null,
): Promise<Menu> {
  if (useLiveApi() && token) {
    const menu = await updateMenuApi(token, menuId, patch);
    upsertMenu(menu);
    return menu;
  }
  return updateMenuMock(menuId, patch);
}

export async function deleteMenu(
  menuId: string,
  token?: Token | null,
): Promise<void> {
  if (useLiveApi() && token) {
    await deleteMenuApi(token, menuId);
    removeMenuLocal(menuId);
    return;
  }
  deleteMenuMock(menuId);
}

export async function createMenuItem(
  input: {
    menuId: string;
    organizationId: string;
    name: string;
    price: number;
    description?: string;
    category?: string;
    available?: boolean;
  },
  token?: Token | null,
): Promise<MenuItem> {
  if (useLiveApi() && token) {
    const item = await createMenuItemApi(token, input);
    upsertMenuItem(item);
    return item;
  }
  return createMenuItemMock(input);
}

export async function updateMenuItem(
  itemId: string,
  patch: Partial<
    Pick<
      MenuItem,
      "name" | "price" | "description" | "category" | "available" | "sortOrder"
    >
  >,
  token?: Token | null,
): Promise<MenuItem> {
  if (useLiveApi() && token) {
    const item = await updateMenuItemApi(token, itemId, patch);
    upsertMenuItem(item);
    return item;
  }
  return updateMenuItemMock(itemId, patch);
}

export async function deleteMenuItem(
  itemId: string,
  token?: Token | null,
): Promise<void> {
  if (useLiveApi() && token) {
    await deleteMenuItemApi(token, itemId);
    removeMenuItemLocal(itemId);
    return;
  }
  deleteMenuItemMock(itemId);
}

export async function publishMenu(
  input: { menuId: string; templateId: string; screenIds: string[] },
  token?: Token | null,
): Promise<Menu> {
  if (useLiveApi() && token) {
    const menu = await publishMenuApi(token, input);
    upsertMenu(menu);
    // Reflect active menu/template on local screens until next full sync.
    const snap = getMockStoreSnapshot();
    for (const id of input.screenIds) {
      const screen = snap.screens.find((s) => s.id === id);
      if (!screen) continue;
      upsertScreen({
        ...screen,
        activeMenuId: menu.id,
        activeTemplateId: input.templateId,
      });
    }
    return menu;
  }
  return publishMenuMock(input);
}

export async function createTemplate(
  input: { organizationId: string; name: string; description?: string },
  token?: Token | null,
): Promise<Template> {
  if (useLiveApi() && token) {
    const template = await createTemplateApi(token, input);
    upsertTemplate(template);
    return template;
  }
  return createTemplateMock(input);
}

export async function updateTemplate(
  templateId: string,
  patch: Partial<
    Pick<Template, "name" | "description" | "canvasJson" | "displayConfig">
  >,
  token?: Token | null,
): Promise<Template> {
  if (useLiveApi() && token) {
    const template = await updateTemplateApi(token, templateId, patch);
    upsertTemplate(template);
    return template;
  }
  return updateTemplateMock(templateId, patch);
}

export async function duplicateTemplate(
  input: { templateId: string; organizationId: string },
  token?: Token | null,
): Promise<Template> {
  if (useLiveApi() && token) {
    const template = await duplicateTemplateApi(token, input);
    upsertTemplate(template);
    return template;
  }
  return duplicateTemplateMock(input);
}

export async function deleteTemplate(
  templateId: string,
  token?: Token | null,
): Promise<void> {
  if (useLiveApi() && token) {
    await deleteTemplateApi(token, templateId);
    removeTemplateLocal(templateId);
    return;
  }
  deleteTemplateMock(templateId);
}
