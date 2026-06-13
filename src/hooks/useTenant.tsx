import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string | null;
  accent_color: string | null;
  is_active: boolean;
}

interface TenantContextType {
  tenant: Tenant | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType>({ tenant: null, loading: true, refresh: async () => {} });

// Lovable preview / lovableproject.com hosts are NEVER a tenant subdomain —
// they're the SaaS host. On those hosts we fall back to BeBright by slug
// so the existing app keeps theming correctly while you develop.
const SAAS_HOST_PATTERNS = [
  /\.lovable\.app$/i,
  /\.lovableproject\.com$/i,
  /^localhost$/i,
  /^127\.0\.0\.1$/,
];

function isSaasHost(host: string): boolean {
  return SAAS_HOST_PATTERNS.some((rx) => rx.test(host));
}

function applyBranding(t: Tenant | null) {
  const root = document.documentElement;
  if (t?.primary_color) root.style.setProperty("--tenant-brand", t.primary_color);
  if (t?.accent_color) root.style.setProperty("--tenant-accent", t.accent_color);
  if (t?.name) document.title = `${t.name} Planner`;
}

async function fetchTenant(): Promise<Tenant | null> {
  const host = window.location.hostname;
  const params = new URLSearchParams(window.location.search);
  const slugOverride = params.get("tenant"); // ?tenant=acme for dev/testing

  let lookupHost: string | null = null;
  let lookupSlug: string | null = null;

  if (slugOverride) {
    lookupSlug = slugOverride;
  } else if (isSaasHost(host)) {
    // SaaS host — default to BeBright until super-admin console picks one
    lookupSlug = "bebright";
  } else {
    lookupHost = host;
  }

  const { data, error } = await supabase.rpc("resolve_tenant", {
    _host: lookupHost,
    _slug: lookupSlug,
  });
  if (error) {
    console.warn("[tenant] resolve failed", error.message);
    return null;
  }
  return (data?.[0] as Tenant) ?? null;
}

export function TenantProvider({ children }: { children: ReactNode }) {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const t = await fetchTenant();
    setTenant(t);
    applyBranding(t);
  };

  useEffect(() => {
    let mounted = true;
    fetchTenant().then((t) => {
      if (!mounted) return;
      setTenant(t);
      applyBranding(t);
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <TenantContext.Provider value={{ tenant, loading, refresh }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  return useContext(TenantContext);
}
