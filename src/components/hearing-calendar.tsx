"use client";
import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
export function HearingCalendar() { const [date, setDate] = useState<Date | undefined>(); return <Calendar mode="single" selected={date} onSelect={setDate} className="rounded-lg border bg-white" />; }
