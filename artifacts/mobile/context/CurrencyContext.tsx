import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQueryClient } from "@tanstack/react-query";
import { settingsApi } from "@/services/api";
import { setCurrencyConfig, formatCurrency, type Currency } from "@/utils/format";

interface CurrencyCtx {
  currency: Currency;
  usdRate: number;
  setCurrency: (c: Currency) => void;
  toggle: () => void;
  format: (amountCDF: number) => string;
  /** Bumps on any currency/rate change so consumers re-render. */
  version: number;
}

const Ctx = createContext<CurrencyCtx | null>(null);
const STORAGE_KEY = "currency";

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>("CDF");
  const [usdRate, setUsdRate] = useState(2850);
  const [version, setVersion] = useState(0);
  const qc = useQueryClient();

  const apply = useCallback((c: Currency, rate: number) => {
    setCurrencyConfig(c, rate);
    setVersion((v) => v + 1);
    // Re-render every mounted price display by refetching their data.
    qc.invalidateQueries();
  }, [qc]);

  // Load saved currency + latest rate on mount.
  useEffect(() => {
    (async () => {
      const saved = (await AsyncStorage.getItem(STORAGE_KEY)) as Currency | null;
      let rate = 2850;
      try {
        const pub = await settingsApi.public();
        if (pub?.usdRate) rate = pub.usdRate;
      } catch { /* keep default */ }
      const c = saved === "USD" ? "USD" : "CDF";
      setCurrencyState(c);
      setUsdRate(rate);
      apply(c, rate);
    })();
  }, [apply]);

  const setCurrency = useCallback((c: Currency) => {
    setCurrencyState(c);
    AsyncStorage.setItem(STORAGE_KEY, c).catch(() => {});
    apply(c, usdRate);
  }, [usdRate, apply]);

  const toggle = useCallback(() => setCurrency(currency === "CDF" ? "USD" : "CDF"), [currency, setCurrency]);

  return (
    <Ctx.Provider value={{ currency, usdRate, setCurrency, toggle, format: formatCurrency, version }}>
      {children}
    </Ctx.Provider>
  );
}

export function useCurrency(): CurrencyCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCurrency must be used within CurrencyProvider");
  return c;
}
