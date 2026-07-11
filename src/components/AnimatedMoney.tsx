"use client";

import { useAnimatedNumber } from "@/lib/useAnimatedNumber";
import { money } from "@/lib/format";

export function AnimatedMoney({
  value,
  currency,
  prefix = "",
}: {
  value: number;
  currency?: string;
  prefix?: string;
}) {
  const display = useAnimatedNumber(value);
  return (
    <>
      {prefix}
      {money(display, currency)}
    </>
  );
}
