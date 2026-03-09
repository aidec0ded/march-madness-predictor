import { BacktestShell } from "@/components/backtest/BacktestShell";

export const metadata = {
  title: "Backtest | March Madness Predictor",
  description: "Evaluate model calibration against historical tournaments",
};

export default function BacktestPage() {
  return <BacktestShell />;
}
