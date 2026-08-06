import { apiFetch } from "@/lib/api/client";
import type { Menu, MenuItem, Template } from "@/lib/types/schema";

type Token = string;

export function listMenusApi(token: Token) {
  return apiFetch<Menu[]>("/api/v1/menus", { token });
}

export function createMenuApi(
  token: Token,
  input: { organizationId: string; name: string },
) {
  return apiFetch<Menu>("/api/v1/menus", { method: "POST", token, body: input });
}

export function updateMenuApi(
  token: Token,
  menuId: string,
  patch: Partial<Pick<Menu, "name">>,
) {
  return apiFetch<Menu>(`/api/v1/menus/${menuId}`, {
    method: "PATCH",
    token,
    body: patch,
  });
}

export function deleteMenuApi(token: Token, menuId: string) {
  return apiFetch<void>(`/api/v1/menus/${menuId}`, { method: "DELETE", token });
}

export function listMenuItemsApi(token: Token) {
  return apiFetch<MenuItem[]>("/api/v1/menu-items", { token });
}

export function createMenuItemApi(
  token: Token,
  input: {
    menuId: string;
    organizationId: string;
    name: string;
    price: number;
    description?: string;
    category?: string;
    available?: boolean;
  },
) {
  return apiFetch<MenuItem>("/api/v1/menu-items", {
    method: "POST",
    token,
    body: input,
  });
}

export function updateMenuItemApi(
  token: Token,
  itemId: string,
  patch: Partial<
    Pick<
      MenuItem,
      "name" | "price" | "description" | "category" | "available" | "sortOrder"
    >
  >,
) {
  return apiFetch<MenuItem>(`/api/v1/menu-items/${itemId}`, {
    method: "PATCH",
    token,
    body: patch,
  });
}

export function deleteMenuItemApi(token: Token, itemId: string) {
  return apiFetch<void>(`/api/v1/menu-items/${itemId}`, {
    method: "DELETE",
    token,
  });
}

export function publishMenuApi(
  token: Token,
  input: { menuId: string; templateId: string; screenIds: string[] },
) {
  return apiFetch<Menu>("/api/v1/menus/publish", {
    method: "POST",
    token,
    body: input,
  });
}

export function listTemplatesApi(token: Token) {
  return apiFetch<Template[]>("/api/v1/templates", { token });
}

export function createTemplateApi(
  token: Token,
  input: { organizationId: string; name: string; description?: string },
) {
  return apiFetch<Template>("/api/v1/templates", {
    method: "POST",
    token,
    body: input,
  });
}

export function updateTemplateApi(
  token: Token,
  templateId: string,
  patch: Partial<Pick<Template, "name" | "description" | "canvasJson">>,
) {
  return apiFetch<Template>(`/api/v1/templates/${templateId}`, {
    method: "PATCH",
    token,
    body: patch,
  });
}

export function duplicateTemplateApi(
  token: Token,
  input: { templateId: string; organizationId: string },
) {
  return apiFetch<Template>("/api/v1/templates/duplicate", {
    method: "POST",
    token,
    body: input,
  });
}

export function deleteTemplateApi(token: Token, templateId: string) {
  return apiFetch<void>(`/api/v1/templates/${templateId}`, {
    method: "DELETE",
    token,
  });
}
