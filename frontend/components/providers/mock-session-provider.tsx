"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useMockStore } from "@/components/providers/mock-data-provider";
import {
  getMockSession,
  readStoredRole,
  ROLE_LABELS,
  writeStoredRole,
} from "@/lib/mock-session";
import type { MockSession, Role } from "@/lib/types/schema";

interface MockSessionContextValue {
  session: MockSession;
  role: Role;
  setRole: (role: Role) => void;
  roleLabel: string;
}

const MockSessionContext = createContext<MockSessionContextValue | null>(null);

export function MockSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [role, setRoleState] = useState<Role>("super_admin");
  const { organizations } = useMockStore();

  useEffect(() => {
    setRoleState(readStoredRole());
  }, []);

  const setRole = useCallback((next: Role) => {
    writeStoredRole(next);
    setRoleState(next);
  }, []);

  const value = useMemo<MockSessionContextValue>(() => {
    const session = getMockSession(role);
    const liveOrg =
      organizations.find((o) => o.id === session.organization.id) ??
      session.organization;
    return {
      session: { ...session, organization: liveOrg },
      role,
      setRole,
      roleLabel: ROLE_LABELS[role],
    };
  }, [role, setRole, organizations]);

  return (
    <MockSessionContext.Provider value={value}>
      {children}
    </MockSessionContext.Provider>
  );
}

export function useMockSession() {
  const ctx = useContext(MockSessionContext);
  if (!ctx) {
    throw new Error("useMockSession must be used within MockSessionProvider");
  }
  return ctx;
}
