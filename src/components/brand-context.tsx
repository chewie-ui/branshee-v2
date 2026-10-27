"use client";

import { createContext, useContext, type ReactNode } from "react";

/** Nom de la marque visitée (« Branshee » ou « Skydev ») pour les textes des composants client. */
const BrandName = createContext("Branshee");

export function BrandNameProvider({ name, children }: { name: string; children: ReactNode }) {
  return <BrandName.Provider value={name}>{children}</BrandName.Provider>;
}

export const useBrandName = () => useContext(BrandName);
