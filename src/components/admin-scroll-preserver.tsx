"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const STORAGE_KEY="sigj:admin-scroll";

export function AdminScrollPreserver() {
  const pathname=usePathname();
  const searchParams=useSearchParams();

  useEffect(() => {
    const remember = (event: SubmitEvent) => {
      const form=event.target;
      if (!(form instanceof HTMLFormElement) || !form.closest(".admin-main")) return;
      sessionStorage.setItem(STORAGE_KEY,JSON.stringify({pathname,y:window.scrollY,at:Date.now()}));
    };
    document.addEventListener("submit",remember,true);
    return () => document.removeEventListener("submit",remember,true);
  },[pathname]);

  useEffect(() => {
    if (!searchParams.has("success")&&!searchParams.has("error")) return;
    try {
      const saved=JSON.parse(sessionStorage.getItem(STORAGE_KEY)||"null") as {pathname?:string;y?:number;at?:number}|null;
      if (!saved||saved.pathname!==pathname||typeof saved.y!=="number"||Date.now()-(saved.at??0)>60_000) return;
      requestAnimationFrame(()=>requestAnimationFrame(()=>window.scrollTo({top:saved.y,behavior:"smooth"})));
      sessionStorage.removeItem(STORAGE_KEY);
    } catch { sessionStorage.removeItem(STORAGE_KEY); }
  },[pathname,searchParams]);

  return null;
}
