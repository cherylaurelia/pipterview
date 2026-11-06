"use client";

import { DialRoot, useDialKit } from "dialkit";
import "dialkit/styles.css";
import { useEffect } from "react";
import { tuning } from "./tuning";

// A live panel for dialling in the island's look (DialKit), shown only with ?tune in the address. Each dial scales part
// of the scene from its designed value (1); "Copy" in the panel gives the values to keep, which go into tuning.ts.

export default function WorldTuner() {
  const v = useDialKit("Island", {
    air: { haze: [1, 0, 3, 0.05], shafts: [1, 0, 3, 0.05], clouds: [1, 0, 3, 0.05] },
    meadow: { gusts: [1, 0, 3, 0.05] },
    light: { bloom: [1, 0, 3, 0.05], exposure: [1, 0.6, 1.6, 0.02] },
    camera: { follow: [1, 0.3, 2.5, 0.05] },
  });
  useEffect(() => {
    Object.assign(tuning, { ...v.air, ...v.meadow, ...v.light, ...v.camera });
  }, [v]);
  return <DialRoot position="top-right" productionEnabled />;
}
