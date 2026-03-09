import type { Metadata } from "next";
import { BacktestShell } from "@/components/backtest/BacktestShell";

export const metadata: Metadata = {
  title: "Backtest",
  description:
    "Evaluate model calibration against 16 years of historical NCAA tournament results using Brier Score analysis.",
  openGraph: {
    title: "Backtest | March Madness Predictor",
    description:
      "Validate bracket prediction model against historical tournament data.",
  },
};

export default function BacktestPage() {
  return <BacktestShell />;
}
