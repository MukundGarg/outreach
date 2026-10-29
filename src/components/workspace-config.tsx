'use client';
import { createContext, useContext } from 'react';
import { demoEnabled } from '@/lib/demo';

const WorkspaceConfigContext = createContext<{ isDemo: boolean }>({ isDemo: demoEnabled });

export function WorkspaceConfigProvider({
  isDemo,
  children,
}: {
  isDemo: boolean;
  children: React.ReactNode;
}) {
  return (
    <WorkspaceConfigContext.Provider value={{ isDemo }}>
      {children}
    </WorkspaceConfigContext.Provider>
  );
}

export function useWorkspaceConfig() {
  return useContext(WorkspaceConfigContext);
}
