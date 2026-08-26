"use client";
import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const statusData = [{ name: "Radicados", value: 42 }, { name: "Instrucción", value: 31 }, { name: "Audiencia", value: 18 }, { name: "Decisión", value: 15 }, { name: "Recurso", value: 9 }];
const chamberData = [{ name: "Penal", value: 38 }, { name: "Civil", value: 31 }, { name: "Laboral", value: 24 }, { name: "Admin.", value: 22 }];
const colors = ["#153b5c", "#b38a3c", "#527ba3", "#91a4b7", "#d1b16f"];

function useClientReady() { const [ready, setReady] = useState(false); useEffect(() => setReady(true), []); return ready; }
export function StatusChart() { const ready = useClientReady(); return <div className="h-64 min-w-0">{ready ? <ResponsiveContainer width="100%" height="100%"><BarChart data={statusData} margin={{ left: -22, right: 10 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e6eaee" /><XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip cursor={{ fill: "#f3f5f7" }} /><Bar dataKey="value" fill="#183d61" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer> : <div className="h-full animate-pulse rounded bg-slate-100" />}</div>; }
export function ChamberChart() { const ready = useClientReady(); return <div className="h-64 min-w-0">{ready ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={chamberData} dataKey="value" nameKey="name" innerRadius={54} outerRadius={88} paddingAngle={3}>{chamberData.map((item, i) => <Cell key={item.name} fill={colors[i]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer> : <div className="mx-auto size-56 animate-pulse rounded-full bg-slate-100" />}</div>; }
